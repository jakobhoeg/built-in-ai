import {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2CallWarning,
  LanguageModelV2Content,
  LanguageModelV2FinishReason,
  LanguageModelV2ProviderDefinedTool,
  LanguageModelV2StreamPart,
  LanguageModelV2ToolCall,
  LoadSettingError,
} from "@ai-sdk/provider";
import {
  AutoTokenizer,
  AutoModelForCausalLM,
  AutoProcessor,
  AutoModelForVision2Seq,
  TextStreamer,
  StoppingCriteria,
  StoppingCriteriaList,
  type PretrainedModelOptions,
  type ProgressInfo,
  type PreTrainedTokenizer,
  type Processor,
  type Tensor,
} from "@huggingface/transformers";
import { convertToTransformersMessages } from "./convert-to-transformers-message";
import type { TransformersMessage } from "./convert-to-transformers-message";
import { decodeSingleSequence } from "./decode-utils";
import type {
  ModelInstance,
  GenerationOptions,
} from "./transformers-js-worker-types";
import {
  buildJsonToolSystemPrompt,
  parseJsonFunctionCalls,
} from "../tool-calling";
import type { ParsedToolCall, ToolDefinition } from "../tool-calling";
import {
  createUnsupportedSettingWarning,
  createUnsupportedToolWarning,
} from "../utils/warnings";
import { isFunctionTool } from "../utils/tool-utils";
import {
  prependSystemPromptToMessages,
  extractSystemPrompt,
} from "../utils/prompt-utils";
import { ToolCallFenceDetector } from "../streaming/tool-call-detector";

declare global {
  interface Navigator {
    gpu?: unknown;
  }
}

export type TransformersJSModelId = string;

export interface TransformersJSModelSettings
  extends Pick<PretrainedModelOptions, "device" | "dtype"> {
  /**
   * Progress callback for model initialization
   */
  initProgressCallback?: (progress: { progress: number }) => void;
  /**
   * Raw progress callback from Transformers.js
   */
  rawInitProgressCallback?: (progress: ProgressInfo) => void;
  /**
   * Whether this is a vision model
   * @default false
   */
  isVisionModel?: boolean;
  /**
   * Optional Web Worker to run the model off the main thread
   */
  worker?: Worker;
}

/**
 * Check if we're running in a browser environment
 */
export function isBrowserEnvironment(): boolean {
  return typeof window !== "undefined";
}

/**
 * Check if we're running in a server environment (Node.js)
 */
export function isServerEnvironment(): boolean {
  return typeof window === "undefined" && typeof process !== "undefined";
}

/**
 * Check if the browser supports TransformersJS with optimal performance
 * Returns true if the browser has WebGPU or WebAssembly support
 * @returns true if the browser supports TransformersJS, false otherwise
 */
export function doesBrowserSupportTransformersJS(): boolean {
  if (!isBrowserEnvironment()) {
    return false;
  }

  // Check for WebGPU support for better performance
  if (typeof navigator !== "undefined" && navigator.gpu) {
    return true;
  }

  // Check for WebAssembly support as fallback
  if (typeof WebAssembly !== "undefined") {
    return true;
  }

  return false;
}

// Simplified config - just extend the settings with modelId
interface ModelConfig extends TransformersJSModelSettings {
  modelId: TransformersJSModelId;
}

class InterruptableStoppingCriteria extends StoppingCriteria {
  interrupted = false;

  interrupt() {
    this.interrupted = true;
  }

  reset() {
    this.interrupted = false;
  }

  _call(input_ids: number[][], scores: number[][]): boolean[] {
    return new Array(input_ids.length).fill(this.interrupted);
  }
}

class CallbackTextStreamer extends TextStreamer {
  private cb: (text: string) => void;

  constructor(tokenizer: PreTrainedTokenizer, cb: (text: string) => void) {
    super(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
    });
    this.cb = cb;
  }

  on_finalized_text(text: string): void {
    this.cb(text);
  }
}

/**
 * Extract tool name from partial fence content for early emission
 * This allows us to emit tool-input-start as soon as we know the tool name
 * Expects JSON format: {"name":"toolName"
 */
function extractToolName(content: string): string | null {
  // For JSON mode: {"name":"toolName"
  const jsonMatch = content.match(/\{\s*"name"\s*:\s*"([^"]+)"/);
  if (jsonMatch) {
    return jsonMatch[1];
  }
  return null;
}

/**
 * Extract the argument section from a streaming tool call fence.
 * Returns the substring after `"arguments":` (best-effort for partial JSON).
 */
function extractArgumentsContent(content: string): string {
  const match = content.match(/"arguments"\s*:\s*/);
  if (!match || match.index === undefined) {
    return "";
  }

  const startIndex = match.index + match[0].length;
  let result = "";
  let depth = 0;
  let inString = false;
  let escaped = false;
  let started = false;

  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];
    result += char;

    if (!started) {
      if (!/\s/.test(char)) {
        started = true;
        if (char === "{" || char === "[") {
          depth = 1;
        }
      }
      continue;
    }

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === "{" || char === "[") {
        depth += 1;
      } else if (char === "}" || char === "]") {
        if (depth > 0) {
          depth -= 1;
          if (depth === 0) {
            break;
          }
        }
      }
    }
  }

  return result;
}

export class TransformersJSLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2";
  readonly modelId: TransformersJSModelId;
  readonly provider = "transformers-js";

  private readonly config: ModelConfig;
  private modelInstance?: ModelInstance;
  private isInitialized = false;
  private initializationPromise?: Promise<void>;
  private stoppingCriteria = new InterruptableStoppingCriteria();
  private workerReady = false;

  constructor(
    modelId: TransformersJSModelId,
    options: TransformersJSModelSettings = {},
  ) {
    this.modelId = modelId;
    this.config = {
      modelId,
      device: "auto",
      dtype: "auto",
      isVisionModel: false,
      ...options,
    };
  }

  readonly supportedUrls: Record<string, RegExp[]> = {
    // TransformersJS doesn't support URLs natively
  };

  private async getSession(
    onInitProgress?: (progress: { progress: number }) => void,
  ): Promise<ModelInstance> {
    if (this.modelInstance && this.isInitialized) {
      return this.modelInstance;
    }

    if (this.initializationPromise) {
      await this.initializationPromise;
      if (this.modelInstance) {
        return this.modelInstance;
      }
    }

    this.initializationPromise = this._initializeModel(onInitProgress);
    await this.initializationPromise;

    if (!this.modelInstance) {
      throw new LoadSettingError({
        message: "Model initialization failed",
      });
    }

    return this.modelInstance;
  }

  private async _initializeModel(
    onInitProgress?: (progress: { progress: number }) => void,
  ): Promise<void> {
    try {
      const { isVisionModel, device, dtype } = this.config;
      const progress_callback = this.createProgressTracker(onInitProgress);

      // Set device based on environment
      const resolvedDevice = this.resolveDevice(
        device as string,
      ) as PretrainedModelOptions["device"];
      const resolvedDtype = this.resolveDtype(
        dtype as string,
      ) as PretrainedModelOptions["dtype"];

      // Create model instance based on type
      if (isVisionModel) {
        const [processor, model] = await Promise.all([
          AutoProcessor.from_pretrained(this.modelId, { progress_callback }),
          AutoModelForVision2Seq.from_pretrained(this.modelId, {
            dtype: resolvedDtype,
            device: resolvedDevice,
            progress_callback,
          }),
        ]);
        this.modelInstance = [processor, model];
      } else {
        const [tokenizer, model] = await Promise.all([
          AutoTokenizer.from_pretrained(this.modelId, {
            legacy: true,
            progress_callback,
          }),
          AutoModelForCausalLM.from_pretrained(this.modelId, {
            dtype: resolvedDtype,
            device: resolvedDevice,
            progress_callback,
          }),
        ]);
        this.modelInstance = [tokenizer, model];

        // Warm up text models (skip in server environment to reduce initialization time)
        if (isBrowserEnvironment()) {
          const dummyInputs = tokenizer("Hello");
          await model.generate({ ...dummyInputs, max_new_tokens: 1 });
        }
      }

      onInitProgress?.({ progress: 1.0 });
      this.isInitialized = true;
    } catch (error) {
      this.modelInstance = undefined;
      this.isInitialized = false;
      this.initializationPromise = undefined;

      throw new LoadSettingError({
        message: `Failed to initialize TransformersJS model: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  private resolveDevice(device?: string): string {
    if (device && device !== "auto") {
      return device;
    }

    if (isServerEnvironment()) {
      // In server environment, prefer CPU unless explicitly set
      return "cpu";
    }

    // In browser environment, auto-detect WebGPU support
    if (
      isBrowserEnvironment() &&
      typeof navigator !== "undefined" &&
      navigator.gpu
    ) {
      return "webgpu";
    }

    return "cpu";
  }

  private resolveDtype(dtype?: string): string {
    if (dtype && dtype !== "auto") {
      return dtype;
    }

    return "auto";
  }

  private createProgressTracker(
    onInitProgress?: (progress: { progress: number }) => void,
  ) {
    const fileProgress = new Map<string, { loaded: number; total: number }>();

    return (p: ProgressInfo) => {
      // Pass through raw progress
      this.config.rawInitProgressCallback?.(p);

      if (!onInitProgress) return;

      // Type guard to check if p has file property
      const progressWithFile = p as ProgressInfo & {
        file?: string;
        loaded?: number;
        total?: number;
      };
      const file = progressWithFile.file;

      if (!file) return;

      if (p.status === "progress" && file) {
        fileProgress.set(file, {
          loaded: progressWithFile.loaded || 0,
          total: progressWithFile.total || 0,
        });
      } else if (p.status === "done" && file) {
        const prev = fileProgress.get(file);
        if (prev?.total) {
          fileProgress.set(file, { loaded: prev.total, total: prev.total });
        }
      }

      // Calculate overall progress
      let totalLoaded = 0;
      let totalBytes = 0;
      for (const { loaded, total } of fileProgress.values()) {
        if (total > 0) {
          totalLoaded += loaded;
          totalBytes += total;
        }
      }

      if (totalBytes > 0) {
        onInitProgress({ progress: Math.min(1, totalLoaded / totalBytes) });
      }
    };
  }

  private getArgs({
    prompt,
    maxOutputTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    stopSequences,
    responseFormat,
    seed,
    tools,
    toolChoice,
  }: Parameters<LanguageModelV2["doGenerate"]>[0]): {
    messages: TransformersMessage[];
    warnings: LanguageModelV2CallWarning[];
    generationOptions: GenerationOptions;
    functionTools: ToolDefinition[];
  } {
    const warnings: LanguageModelV2CallWarning[] = [];

    // Filter and warn about unsupported tools
    const functionTools: ToolDefinition[] = (tools ?? [])
      .filter(isFunctionTool)
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      }));

    const unsupportedTools = (tools ?? []).filter(
      (tool): tool is LanguageModelV2ProviderDefinedTool =>
        !isFunctionTool(tool),
    );

    for (const tool of unsupportedTools) {
      warnings.push(
        createUnsupportedToolWarning(
          tool,
          "Only function tools are supported by TransformersJS",
        ),
      );
    }

    // Add warnings for unsupported settings
    if (frequencyPenalty != null) {
      warnings.push(
        createUnsupportedSettingWarning(
          "frequencyPenalty",
          "Frequency penalty is not supported by TransformersJS",
        ),
      );
    }

    if (presencePenalty != null) {
      warnings.push(
        createUnsupportedSettingWarning(
          "presencePenalty",
          "Presence penalty is not supported by TransformersJS",
        ),
      );
    }

    if (stopSequences != null) {
      warnings.push(
        createUnsupportedSettingWarning(
          "stopSequences",
          "Stop sequences are not supported by TransformersJS",
        ),
      );
    }

    if (responseFormat?.type === "json") {
      warnings.push(
        createUnsupportedSettingWarning(
          "responseFormat",
          "JSON response format is not supported by TransformersJS",
        ),
      );
    }

    if (seed != null) {
      warnings.push(
        createUnsupportedSettingWarning(
          "seed",
          "Seed is not supported by TransformersJS",
        ),
      );
    }

    if (toolChoice != null) {
      warnings.push(
        createUnsupportedSettingWarning(
          "toolChoice",
          "toolChoice is not supported by TransformersJS",
        ),
      );
    }

    // Convert messages to TransformersJS format
    const messages = convertToTransformersMessages(
      prompt,
      this.config.isVisionModel,
    );

    const generationOptions: GenerationOptions = {
      max_new_tokens: maxOutputTokens || 32768,
      temperature: temperature || 0.7,
      top_p: topP,
      top_k: topK,
      do_sample: temperature !== undefined && temperature > 0,
    };

    return {
      messages,
      warnings,
      generationOptions,
      functionTools,
    };
  }

  /**
   * Check the availability of the TransformersJS model
   */
  public async availability(): Promise<
    "unavailable" | "downloadable" | "available"
  > {
    // If using a worker (browser only), reflect worker readiness instead of main-thread state
    if (this.config.worker && isBrowserEnvironment()) {
      return this.workerReady ? "available" : "downloadable";
    }

    // In server environment, workers are not used
    if (isServerEnvironment() && this.config.worker) {
      // Ignore worker config on server and use main thread
    }

    if (this.isInitialized) {
      return "available";
    }

    return "downloadable";
  }

  /**
   * Creates a session with download progress monitoring
   */
  public async createSessionWithProgress(
    onDownloadProgress?: (progress: { progress: number }) => void,
  ): Promise<TransformersJSLanguageModel> {
    // If a worker is provided and we're in browser environment, initialize the worker
    // (and forward progress) instead of initializing the model on the main thread
    // to avoid double-initialization/downloads.
    if (this.config.worker && isBrowserEnvironment()) {
      await this.initializeWorker(onDownloadProgress);
      return this;
    }

    // In server environment or when no worker is provided, use main thread
    await this._initializeModel(onDownloadProgress);
    return this;
  }

  /**
   * Generates a complete text response using TransformersJS
   */
  public async doGenerate(options: LanguageModelV2CallOptions) {
    const { messages, warnings, generationOptions, functionTools } =
      this.getArgs(options);

    // Use worker if provided and in browser environment
    if (this.config.worker && isBrowserEnvironment()) {
      return this.doGenerateWithWorker(
        messages,
        warnings,
        generationOptions,
        options,
        functionTools,
      );
    }

    // Extract system prompt from messages and build combined prompt with tool calling
    const {
      systemPrompt: originalSystemPrompt,
      messages: messagesWithoutSystem,
    } = extractSystemPrompt(messages);

    const systemPrompt = buildJsonToolSystemPrompt(
      originalSystemPrompt,
      functionTools,
      {
        allowParallelToolCalls: false,
      },
    );

    // Prepend system prompt to messages
    const promptMessages = prependSystemPromptToMessages(
      messagesWithoutSystem,
      systemPrompt,
    );

    // Main thread generation (browser without worker or server environment)
    const [processor, model] = await this.getSession(
      this.config.initProgressCallback,
    );

    try {
      const isVision = this.config.isVisionModel;
      let inputs: {
        input_ids: Tensor;
        attention_mask?: Tensor;
        pixel_values?: Tensor;
      };
      let generatedText: string;
      let inputLength: number = 0;

      if (isVision) {
        // Cast to any for vision models since transformers.js supports vision content arrays too
        // but the type definition is Message[] with content: string
        const { load_image } = await import("@huggingface/transformers");
        const text = processor.apply_chat_template(promptMessages as any, {
          add_generation_prompt: true,
        });
        const imageUrls = promptMessages
          .flatMap((msg) => (Array.isArray(msg.content) ? msg.content : []))
          .filter((part) => part.type === "image")
          .map((part) => part.image);

        // Load images using load_image
        const images = await Promise.all(
          imageUrls.map((url) => load_image(url)),
        );

        inputs = await processor(text, images);
        // Cast to any because transformers.js generate() has complex overload types
        const outputs = await (model.generate as any)({
          ...inputs,
          ...generationOptions,
        });
        generatedText = processor.batch_decode(outputs as Tensor, {
          skip_special_tokens: true,
        })[0];
      } else {
        inputs = processor.apply_chat_template(promptMessages as any, {
          add_generation_prompt: true,
          return_dict: true,
        }) as { input_ids: Tensor; attention_mask?: Tensor };
        // Cast to any because transformers.js generate() has complex overload types
        const outputs = await (model.generate as any)({
          ...inputs,
          ...generationOptions,
        });
        inputLength = inputs.input_ids.data.length;

        // Extract first sequence from outputs
        const outputsAsAny = outputs as any;
        const sequences = outputsAsAny.sequences || outputs;
        const firstSequence = Array.isArray(sequences)
          ? sequences[0]
          : sequences;

        generatedText = decodeSingleSequence(
          processor as PreTrainedTokenizer,
          firstSequence,
          inputLength,
        );
      }

      // Parse JSON tool calls from response
      const { toolCalls, textContent } = parseJsonFunctionCalls(generatedText);

      if (toolCalls.length > 0) {
        const toolCallsToEmit = toolCalls.slice(0, 1);

        const parts: LanguageModelV2Content[] = [];

        if (textContent) {
          parts.push({
            type: "text",
            text: textContent,
          });
        }

        for (const call of toolCallsToEmit) {
          parts.push({
            type: "tool-call",
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            input: JSON.stringify(call.args ?? {}),
          } satisfies LanguageModelV2ToolCall);
        }

        return {
          content: parts,
          finishReason: "tool-calls" as LanguageModelV2FinishReason,
          usage: isVision
            ? {
                inputTokens: undefined,
                outputTokens: undefined,
                totalTokens: undefined,
              }
            : {
                inputTokens: inputLength,
                outputTokens: generatedText.length,
                totalTokens: inputLength + generatedText.length,
              },
          request: { body: { messages: promptMessages, ...generationOptions } },
          warnings,
        };
      }

      const content: LanguageModelV2Content[] = [
        {
          type: "text",
          text: textContent || generatedText,
        },
      ];

      return {
        content,
        finishReason: "stop" as LanguageModelV2FinishReason,
        usage: isVision
          ? {
              inputTokens: undefined,
              outputTokens: undefined,
              totalTokens: undefined,
            }
          : {
              inputTokens: inputLength,
              outputTokens: generatedText.length,
              totalTokens: inputLength + generatedText.length,
            },
        request: { body: { messages: promptMessages, ...generationOptions } },
        warnings,
      };
    } catch (error) {
      throw new Error(
        `TransformersJS generation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  private async doGenerateWithWorker(
    messages: TransformersMessage[],
    warnings: LanguageModelV2CallWarning[],
    generationOptions: GenerationOptions,
    options: LanguageModelV2CallOptions,
    functionTools: ToolDefinition[],
  ) {
    const worker = this.config.worker!;

    await this.initializeWorker();

    const result = await new Promise<{
      text: string;
      toolCalls?: ParsedToolCall[];
    }>((resolve, reject) => {
      const onMessage = (e: MessageEvent) => {
        const msg = e.data;
        if (!msg) return;
        if (msg.status === "complete") {
          worker.removeEventListener("message", onMessage);
          const text = Array.isArray(msg.output)
            ? String(msg.output[0] ?? "")
            : String(msg.output ?? "");
          resolve({
            text,
            toolCalls: msg.toolCalls,
          });
        } else if (msg.status === "error") {
          worker.removeEventListener("message", onMessage);
          reject(new Error(String(msg.data || "Worker error")));
        }
      };
      worker.addEventListener("message", onMessage);
      worker.postMessage({
        type: "generate",
        data: messages,
        generationOptions,
        tools: functionTools.length > 0 ? functionTools : undefined,
      });

      if (options.abortSignal) {
        const onAbort = () => {
          worker.postMessage({ type: "interrupt" });
          options.abortSignal?.removeEventListener("abort", onAbort);
        };
        options.abortSignal.addEventListener("abort", onAbort);
      }
    });

    // Handle tool calls if present
    if (result.toolCalls && result.toolCalls.length > 0) {
      const toolCallsToEmit = result.toolCalls.slice(0, 1);
      const parts: LanguageModelV2Content[] = [];

      // Extract text content from result
      const { textContent } = parseJsonFunctionCalls(result.text);
      if (textContent) {
        parts.push({
          type: "text",
          text: textContent,
        });
      }

      for (const call of toolCallsToEmit) {
        parts.push({
          type: "tool-call",
          toolCallId: call.toolCallId,
          toolName: call.toolName,
          input: JSON.stringify(call.args ?? {}),
        } satisfies LanguageModelV2ToolCall);
      }

      return {
        content: parts,
        finishReason: "tool-calls" as LanguageModelV2FinishReason,
        usage: {
          inputTokens: undefined,
          outputTokens: undefined,
          totalTokens: undefined,
        },
        request: { body: { messages, ...generationOptions } },
        warnings,
      };
    }

    const content: LanguageModelV2Content[] = [
      { type: "text", text: result.text },
    ];
    return {
      content,
      finishReason: "stop" as LanguageModelV2FinishReason,
      usage: {
        inputTokens: undefined,
        outputTokens: undefined,
        totalTokens: undefined,
      },
      request: { body: { messages, ...generationOptions } },
      warnings,
    };
  }

  private async initializeWorker(
    onInitProgress?: (progress: { progress: number }) => void,
  ): Promise<void> {
    if (!this.config.worker) return;

    // If already ready, optionally emit completion progress
    if (this.workerReady) {
      if (onInitProgress) onInitProgress({ progress: 1 });
      return;
    }

    const worker = this.config.worker;

    await new Promise<void>((resolve, reject) => {
      const trackProgress = this.createProgressTracker(onInitProgress);

      const onMessage = (e: MessageEvent) => {
        const msg = e.data;
        if (!msg) return;

        // Forward raw download progress events coming from @huggingface/transformers running in the worker
        if (msg && typeof msg === "object" && "status" in msg) {
          if (msg.status === "ready") {
            worker.removeEventListener("message", onMessage);
            this.workerReady = true;
            if (onInitProgress) onInitProgress({ progress: 1 });
            resolve();
            return;
          }
          if (msg.status === "error") {
            worker.removeEventListener("message", onMessage);
            reject(
              new Error(String(msg.data || "Worker initialization failed")),
            );
            return;
          }

          // Only track file-related messages (raw ProgressInfo events)
          const msgWithFile = msg as ProgressInfo & { file?: string };
          if (msgWithFile.file) trackProgress(msg as ProgressInfo);
        }
      };

      worker.addEventListener("message", onMessage);
      worker.postMessage({
        type: "load",
        data: {
          modelId: this.modelId,
          dtype: this.config.dtype,
          device: this.config.device,
          isVisionModel: this.config.isVisionModel,
        },
      });
    });
  }

  /**
   * Generates a streaming text response using TransformersJS
   */
  public async doStream(options: LanguageModelV2CallOptions) {
    let converted;
    try {
      converted = this.getArgs(options);
    } catch (error) {
      console.error("[TransformersJS Model doStream] getArgs FAILED:", error);
      throw error;
    }

    const { messages, warnings, generationOptions, functionTools } = converted;

    // Use worker if available and in browser environment
    if (this.config.worker && isBrowserEnvironment()) {
      return this.doStreamWithWorker(
        messages,
        warnings,
        generationOptions,
        options,
        functionTools,
      );
    }

    // Extract system prompt from messages and build combined prompt with tool calling
    const {
      systemPrompt: originalSystemPrompt,
      messages: messagesWithoutSystem,
    } = extractSystemPrompt(messages);

    const systemPrompt = buildJsonToolSystemPrompt(
      originalSystemPrompt,
      functionTools,
      {
        allowParallelToolCalls: false,
      },
    );

    // Prepend system prompt to messages
    const promptMessages = prependSystemPromptToMessages(
      messagesWithoutSystem,
      systemPrompt,
    );

    const self = this;
    const textId = "text-0";

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      async start(controller) {
        controller.enqueue({
          type: "stream-start",
          warnings,
        });

        let textStarted = false;
        let finished = false;
        let aborted = false;

        const ensureTextStart = () => {
          if (!textStarted) {
            controller.enqueue({
              type: "text-start",
              id: textId,
            });
            textStarted = true;
          }
        };

        const emitTextDelta = (delta: string) => {
          if (!delta) return;
          ensureTextStart();
          controller.enqueue({
            type: "text-delta",
            id: textId,
            delta,
          });
        };

        const emitTextEndIfNeeded = () => {
          if (!textStarted) return;
          controller.enqueue({
            type: "text-end",
            id: textId,
          });
          textStarted = false;
        };

        const finishStream = (
          finishReason: LanguageModelV2FinishReason,
          inputLength: number = 0,
          outputTokens: number = 0,
        ) => {
          if (finished) return;
          finished = true;
          emitTextEndIfNeeded();
          controller.enqueue({
            type: "finish",
            finishReason,
            usage: {
              inputTokens: inputLength,
              outputTokens,
              totalTokens: inputLength + outputTokens,
            },
          });
          controller.close();
        };

        const abortHandler = () => {
          if (aborted) return;
          aborted = true;
          self.stoppingCriteria.interrupt();
        };

        if (options.abortSignal) {
          options.abortSignal.addEventListener("abort", abortHandler);
        }

        try {
          const [tokenizer, model] = await self.getSession(
            self.config.initProgressCallback,
          );

          const isVision = self.config.isVisionModel;

          // Prepare inputs based on model type
          let inputs: {
            input_ids: Tensor;
            attention_mask?: Tensor;
            pixel_values?: Tensor;
          };

          if (isVision) {
            // For vision models, process images
            const { load_image } = await import("@huggingface/transformers");
            const text = tokenizer.apply_chat_template(promptMessages as any, {
              add_generation_prompt: true,
            });
            const imageUrls = promptMessages
              .flatMap((msg) => (Array.isArray(msg.content) ? msg.content : []))
              .filter((part) => part.type === "image")
              .map((part) => part.image);

            // Load images using load_image
            const images = await Promise.all(
              imageUrls.map((url) => load_image(url)),
            );

            inputs = await tokenizer(text, images);
          } else {
            // Cast to any for vision models since transformers.js supports vision content arrays
            // but the type definition is Message[] with content: string
            inputs = tokenizer.apply_chat_template(promptMessages as any, {
              add_generation_prompt: true,
              return_dict: true,
            }) as { input_ids: Tensor; attention_mask?: Tensor };
          }

          let inputLength = isVision ? 0 : inputs.input_ids.data.length;
          let outputTokens = 0;

          // Use ToolCallFenceDetector for real-time streaming
          const fenceDetector = new ToolCallFenceDetector();
          let accumulatedText = "";

          // Streaming tool call state
          let currentToolCallId: string | null = null;
          let toolInputStartEmitted = false;
          let accumulatedFenceContent = "";
          let streamedArgumentsLength = 0;
          let insideFence = false;
          let toolCallDetected = false; // Add flag to stop processing after tool call

          const streamCallback = (text: string) => {
            if (aborted || toolCallDetected) return; // Stop if tool call detected

            outputTokens++;
            accumulatedText += text;

            // Add chunk to detector
            fenceDetector.addChunk(text);

            // Process buffer using streaming detection
            while (
              fenceDetector.hasContent() &&
              !aborted &&
              !toolCallDetected
            ) {
              const wasInsideFence = insideFence;
              const result = fenceDetector.detectStreamingFence();
              insideFence = result.inFence;

              let madeProgress = false;

              if (!wasInsideFence && result.inFence) {
                if (result.safeContent) {
                  emitTextDelta(result.safeContent);
                  madeProgress = true;
                }

                currentToolCallId = `call_${Date.now()}_${Math.random()
                  .toString(36)
                  .slice(2, 9)}`;
                toolInputStartEmitted = false;
                accumulatedFenceContent = "";
                streamedArgumentsLength = 0;
                insideFence = true;

                continue;
              }

              if (result.completeFence) {
                madeProgress = true;
                if (result.safeContent) {
                  accumulatedFenceContent += result.safeContent;
                }

                if (toolInputStartEmitted && currentToolCallId) {
                  const argsContent = extractArgumentsContent(
                    accumulatedFenceContent,
                  );
                  if (argsContent.length > streamedArgumentsLength) {
                    const delta = argsContent.slice(streamedArgumentsLength);
                    streamedArgumentsLength = argsContent.length;
                    if (delta.length > 0) {
                      controller.enqueue({
                        type: "tool-input-delta",
                        id: currentToolCallId,
                        delta,
                      });
                    }
                  }
                }

                const parsed = parseJsonFunctionCalls(result.completeFence);
                const parsedToolCalls = parsed.toolCalls;
                const selectedToolCalls = parsedToolCalls.slice(0, 1);

                if (selectedToolCalls.length === 0) {
                  emitTextDelta(result.completeFence);
                  if (result.textAfterFence) {
                    emitTextDelta(result.textAfterFence);
                  }

                  currentToolCallId = null;
                  toolInputStartEmitted = false;
                  accumulatedFenceContent = "";
                  streamedArgumentsLength = 0;
                  insideFence = false;
                  continue;
                }

                if (selectedToolCalls.length > 0 && currentToolCallId) {
                  selectedToolCalls[0].toolCallId = currentToolCallId;
                }

                for (const [index, call] of selectedToolCalls.entries()) {
                  const toolCallId =
                    index === 0 && currentToolCallId
                      ? currentToolCallId
                      : call.toolCallId;
                  const toolName = call.toolName;
                  const argsJson = JSON.stringify(call.args ?? {});

                  if (toolCallId === currentToolCallId) {
                    if (!toolInputStartEmitted) {
                      controller.enqueue({
                        type: "tool-input-start",
                        id: toolCallId,
                        toolName,
                      });
                      toolInputStartEmitted = true;
                    }

                    const argsContent = extractArgumentsContent(
                      accumulatedFenceContent,
                    );
                    if (argsContent.length > streamedArgumentsLength) {
                      const delta = argsContent.slice(streamedArgumentsLength);
                      streamedArgumentsLength = argsContent.length;
                      if (delta.length > 0) {
                        controller.enqueue({
                          type: "tool-input-delta",
                          id: toolCallId,
                          delta,
                        });
                      }
                    }
                  } else {
                    controller.enqueue({
                      type: "tool-input-start",
                      id: toolCallId,
                      toolName,
                    });
                    if (argsJson.length > 0) {
                      controller.enqueue({
                        type: "tool-input-delta",
                        id: toolCallId,
                        delta: argsJson,
                      });
                    }
                  }

                  controller.enqueue({
                    type: "tool-input-end",
                    id: toolCallId,
                  });
                  controller.enqueue({
                    type: "tool-call",
                    toolCallId,
                    toolName,
                    input: argsJson,
                    providerExecuted: false,
                  });
                }

                if (result.textAfterFence) {
                  emitTextDelta(result.textAfterFence);
                }

                madeProgress = true;

                // Stop streaming after tool call detected
                toolCallDetected = true;
                self.stoppingCriteria.interrupt();

                currentToolCallId = null;
                toolInputStartEmitted = false;
                accumulatedFenceContent = "";
                streamedArgumentsLength = 0;
                insideFence = false;

                // Break out of the processing loop
                break;
              }

              if (insideFence) {
                if (result.safeContent) {
                  accumulatedFenceContent += result.safeContent;
                  madeProgress = true;

                  const toolName = extractToolName(accumulatedFenceContent);
                  if (toolName && !toolInputStartEmitted && currentToolCallId) {
                    controller.enqueue({
                      type: "tool-input-start",
                      id: currentToolCallId,
                      toolName,
                    });
                    toolInputStartEmitted = true;
                  }

                  if (toolInputStartEmitted && currentToolCallId) {
                    const argsContent = extractArgumentsContent(
                      accumulatedFenceContent,
                    );
                    if (argsContent.length > streamedArgumentsLength) {
                      const delta = argsContent.slice(streamedArgumentsLength);
                      streamedArgumentsLength = argsContent.length;
                      if (delta.length > 0) {
                        controller.enqueue({
                          type: "tool-input-delta",
                          id: currentToolCallId,
                          delta,
                        });
                      }
                    }
                  }
                }

                continue;
              }

              if (!insideFence && result.safeContent) {
                emitTextDelta(result.safeContent);
                madeProgress = true;
              }

              if (!madeProgress) {
                break;
              }
            }
          };

          const streamer = new CallbackTextStreamer(
            tokenizer as PreTrainedTokenizer,
            streamCallback,
          );
          self.stoppingCriteria.reset();

          const stoppingCriteriaList = new StoppingCriteriaList();
          stoppingCriteriaList.extend([self.stoppingCriteria]);

          await model.generate({
            ...inputs,
            ...generationOptions,
            streamer,
            stopping_criteria: stoppingCriteriaList,
          });

          // Emit any remaining buffer content if no tool was detected
          if (fenceDetector.hasContent() && !aborted) {
            emitTextDelta(fenceDetector.getBuffer());
            fenceDetector.clearBuffer();
          }

          // Check if we detected any tool calls
          const { toolCalls } = parseJsonFunctionCalls(accumulatedText);

          const finishReason = toolCalls.length > 0 ? "tool-calls" : "stop";

          finishStream(finishReason, inputLength, outputTokens);
        } catch (error) {
          controller.enqueue({ type: "error", error });
          controller.close();
        } finally {
          if (options.abortSignal) {
            options.abortSignal.removeEventListener("abort", abortHandler);
          }
        }
      },
    });

    return {
      stream,
      request: { body: { messages: promptMessages, ...generationOptions } },
    };
  }

  private async doStreamWithWorker(
    messages: TransformersMessage[],
    warnings: LanguageModelV2CallWarning[],
    generationOptions: GenerationOptions,
    options: LanguageModelV2CallOptions,
    functionTools: ToolDefinition[],
  ) {
    const worker = this.config.worker!;

    await this.initializeWorker();

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      start: (controller) => {
        let isFirst = true;
        const textId = "text-0";
        controller.enqueue({ type: "stream-start", warnings });

        // Use fence detector to filter out tool calls from text stream
        const fenceDetector = new ToolCallFenceDetector();

        const onMessage = (e: MessageEvent) => {
          const msg = e.data;
          if (!msg) return;
          if (msg.status === "start") {
            // no-op
          } else if (
            msg.status === "update" &&
            typeof msg.output === "string"
          ) {
            // Filter out tool call fences from the text stream
            fenceDetector.addChunk(msg.output);

            while (fenceDetector.hasContent()) {
              const result = fenceDetector.detectStreamingFence();

              // Only emit non-fence content as text
              if (!result.inFence && result.safeContent) {
                if (isFirst) {
                  controller.enqueue({ type: "text-start", id: textId });
                  isFirst = false;
                }
                controller.enqueue({
                  type: "text-delta",
                  id: textId,
                  delta: result.safeContent,
                });
              }

              // If we detect a complete fence, don't emit it as text
              if (result.completeFence) {
                // Tool call will be emitted separately in "complete" message
                break;
              }

              if (!result.safeContent && !result.completeFence) {
                break;
              }
            }
          } else if (msg.status === "complete") {
            if (!isFirst) controller.enqueue({ type: "text-end", id: textId });

            // Check for tool calls in the response
            const finishReason =
              msg.toolCalls && msg.toolCalls.length > 0 ? "tool-calls" : "stop";

            // Emit tool calls if present
            if (msg.toolCalls && msg.toolCalls.length > 0) {
              const toolCallsToEmit = msg.toolCalls.slice(0, 1);

              for (const call of toolCallsToEmit) {
                const toolCallId = call.toolCallId;
                const toolName = call.toolName;
                const argsJson = JSON.stringify(call.args ?? {});

                controller.enqueue({
                  type: "tool-input-start",
                  id: toolCallId,
                  toolName,
                });

                if (argsJson.length > 0) {
                  controller.enqueue({
                    type: "tool-input-delta",
                    id: toolCallId,
                    delta: argsJson,
                  });
                }

                controller.enqueue({
                  type: "tool-input-end",
                  id: toolCallId,
                });

                controller.enqueue({
                  type: "tool-call",
                  toolCallId,
                  toolName,
                  input: argsJson,
                  providerExecuted: false,
                });
              }
            }

            controller.enqueue({
              type: "finish",
              finishReason,
              usage: {
                inputTokens: undefined,
                outputTokens: msg.numTokens,
                totalTokens: undefined,
              },
            });
            worker.removeEventListener("message", onMessage);
            controller.close();
          } else if (msg.status === "error") {
            worker.removeEventListener("message", onMessage);
            controller.error(new Error(String(msg.data || "Worker error")));
          }
        };
        worker.addEventListener("message", onMessage);

        if (options.abortSignal) {
          const onAbort = () => {
            worker.postMessage({ type: "interrupt" });
            options.abortSignal?.removeEventListener("abort", onAbort);
          };
          options.abortSignal.addEventListener("abort", onAbort);
        }

        worker.postMessage({
          type: "generate",
          data: messages,
          generationOptions,
          tools: functionTools.length > 0 ? functionTools : undefined,
        });
      },
    });

    return { stream, request: { body: { messages, ...generationOptions } } };
  }
}
