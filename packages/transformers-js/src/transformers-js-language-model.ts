import {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2CallWarning,
  LanguageModelV2Content,
  LanguageModelV2FinishReason,
  LanguageModelV2StreamPart,
  LoadSettingError,
} from "@ai-sdk/provider";
import {
  AutoTokenizer,
  AutoModelForCausalLM,
  AutoProcessor,
  AutoModelForVision2Seq,
  TextStreamer,
  StoppingCriteria,
  type PretrainedModelOptions,
  type ProgressInfo,
} from "@huggingface/transformers";
import { convertToTransformersMessages } from "./convert-to-transformers-message";
import type { ModelInstance, GenerationOptions } from "./transformers-js-worker-types";

declare global {
  interface Navigator {
    gpu?: unknown;
  }
}

export type TransformersJSModelId = string;

export interface TransformersJSModelSettings extends Pick<PretrainedModelOptions, 'device' | 'dtype'> {
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
 * Check if the browser supports TransformersJS
 */
export function doesBrowserSupportTransformersJS(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return true;
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

  _call(input_ids: any, scores: any) {
    return new Array(input_ids.length).fill(this.interrupted);
  }
}

class CallbackTextStreamer extends TextStreamer {
  private cb: (text: string) => void;

  constructor(tokenizer: any, cb: (text: string) => void) {
    super(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
    });
    this.cb = cb;
  }

  on_finalized_text(text: string) {
    this.cb(text);
  }
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

  constructor(modelId: TransformersJSModelId, options: TransformersJSModelSettings = {}) {
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
      if (!doesBrowserSupportTransformersJS()) {
        throw new LoadSettingError({
          message: "TransformersJS is not supported in this environment",
        });
      }

      const { isVisionModel, device, dtype } = this.config;
      const progress_callback = this.createProgressTracker(onInitProgress);

      // Create model instance based on type
      if (isVisionModel) {
        const [processor, model] = await Promise.all([
          AutoProcessor.from_pretrained(this.modelId, { progress_callback }),
          AutoModelForVision2Seq.from_pretrained(this.modelId, {
            dtype: dtype || "auto",
            device: device || "auto",
            progress_callback,
          })
        ]);
        this.modelInstance = [processor, model];
      } else {
        const [tokenizer, model] = await Promise.all([
          AutoTokenizer.from_pretrained(this.modelId, { legacy: true, progress_callback }),
          AutoModelForCausalLM.from_pretrained(this.modelId, {
            dtype: dtype || "auto",
            device: device || "auto",
            progress_callback,
          })
        ]);
        this.modelInstance = [tokenizer, model];

        // Warm up text models
        const dummyInputs = tokenizer("Hello");
        await model.generate({ ...dummyInputs, max_new_tokens: 1 });
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

  private createProgressTracker(onInitProgress?: (progress: { progress: number }) => void) {
    const fileProgress = new Map<string, { loaded: number; total: number }>();

    return (p: ProgressInfo) => {
      // Pass through raw progress
      this.config.rawInitProgressCallback?.(p);

      if (!onInitProgress || !(p as any).file) return;

      const file = (p as any).file;
      if (p.status === "progress" && file) {
        fileProgress.set(file, { loaded: (p as any).loaded || 0, total: (p as any).total || 0 });
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
  }: Parameters<LanguageModelV2["doGenerate"]>[0]) {
    const warnings: LanguageModelV2CallWarning[] = [];

    // Add warnings for unsupported settings
    if (tools && tools.length > 0) {
      warnings.push({
        type: "unsupported-setting",
        setting: "tools",
        details: "Tool calling is not yet supported by TransformersJS",
      });
    }

    if (frequencyPenalty != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "frequencyPenalty",
        details: "Frequency penalty is not supported by TransformersJS",
      });
    }

    if (presencePenalty != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "presencePenalty",
        details: "Presence penalty is not supported by TransformersJS",
      });
    }

    if (stopSequences != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "stopSequences",
        details: "Stop sequences are not supported by TransformersJS",
      });
    }

    if (responseFormat?.type === "json") {
      warnings.push({
        type: "unsupported-setting",
        setting: "responseFormat",
        details: "JSON response format is not supported by TransformersJS",
      });
    }

    if (seed != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "seed",
        details: "Seed is not supported by TransformersJS",
      });
    }

    // Convert messages to TransformersJS format
    const messages = convertToTransformersMessages(prompt, this.config.isVisionModel);

    const generationOptions: GenerationOptions = {
      max_new_tokens: maxOutputTokens || 256,
      temperature: temperature || 0.7,
      top_p: topP,
      top_k: topK,
      do_sample: temperature !== undefined && temperature > 0,
    };

    return {
      messages,
      warnings,
      generationOptions,
    };
  }

  /**
   * Check the availability of the TransformersJS model
   */
  public async availability(): Promise<"unavailable" | "downloadable" | "available"> {
    if (!doesBrowserSupportTransformersJS()) {
      return "unavailable";
    }

    // If using a worker, reflect worker readiness instead of main-thread state
    if (this.config.worker) {
      return this.workerReady ? "available" : "downloadable";
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
    // If a worker is provided, initialize the worker (and forward progress) instead of
    // initializing the model on the main thread to avoid double-initialization/downloads.
    if (this.config.worker) {
      await this.initializeWorker(onDownloadProgress);
      return this;
    }

    await this._initializeModel(onDownloadProgress);
    return this;
  }

  /**
   * Generates a complete text response using TransformersJS
   */
  public async doGenerate(options: LanguageModelV2CallOptions) {
    const { messages, warnings, generationOptions } = this.getArgs(options);

    // Use worker if available
    if (this.config.worker) {
      return this.doGenerateWithWorker(messages, warnings, generationOptions, options);
    }

    // Main thread generation
    const [processor, model] = await this.getSession(this.config.initProgressCallback);

    try {
      const isVision = this.config.isVisionModel;
      let inputs: any;
      let generatedText: string;

      if (isVision) {
        const text = processor.apply_chat_template(messages, { add_generation_prompt: true });
        const images = messages
          .flatMap(msg => Array.isArray(msg.content) ? msg.content : [])
          .filter(part => part.type === 'image')
          .map(part => part.image);

        inputs = await processor(text, images.length > 0 ? images : undefined);
        const outputs = await model.generate({ ...inputs, ...generationOptions });
        generatedText = processor.batch_decode(outputs as any, { skip_special_tokens: true })[0];
      } else {
        inputs = processor.apply_chat_template(messages, { add_generation_prompt: true, return_dict: true });
        const outputs = await model.generate({ ...inputs, ...generationOptions });
        const inputLength = (inputs as any).input_ids.data.length;
        const newTokens = (outputs as any)[0].slice(inputLength);
        generatedText = processor.decode(newTokens, { skip_special_tokens: true });
      }

      const content: LanguageModelV2Content[] = [
        {
          type: "text",
          text: generatedText,
        },
      ];

      return {
        content,
        finishReason: "stop" as LanguageModelV2FinishReason,
        usage: isVision
          ? { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined }
          : {
            inputTokens: inputs.input_ids.data.length,
            outputTokens: generatedText.length,
            totalTokens: inputs.input_ids.data.length + generatedText.length,
          },
        request: { body: { messages, ...generationOptions } },
        warnings,
      };
    } catch (error) {
      throw new Error(
        `TransformersJS generation failed: ${error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  private async doGenerateWithWorker(
    messages: Array<{ role: string; content: any }>,
    warnings: LanguageModelV2CallWarning[],
    generationOptions: GenerationOptions,
    options: LanguageModelV2CallOptions,
  ) {
    const worker = this.config.worker!;

    await this.initializeWorker();

    const result = await new Promise<string>((resolve, reject) => {
      const onMessage = (e: MessageEvent) => {
        const msg = e.data;
        if (!msg) return;
        if (msg.status === "complete" && Array.isArray(msg.output)) {
          worker.removeEventListener("message", onMessage);
          resolve(String(msg.output[0] ?? ""));
        } else if (msg.status === "error") {
          worker.removeEventListener("message", onMessage);
          reject(new Error(String(msg.data || "Worker error")));
        }
      };
      worker.addEventListener("message", onMessage);
      worker.postMessage({ type: "generate", data: messages, generationOptions });

      if (options.abortSignal) {
        const onAbort = () => {
          worker.postMessage({ type: "interrupt" });
          options.abortSignal?.removeEventListener("abort", onAbort);
        };
        options.abortSignal.addEventListener("abort", onAbort);
      }
    });

    const content: LanguageModelV2Content[] = [{ type: "text", text: result }];
    return {
      content,
      finishReason: "stop" as LanguageModelV2FinishReason,
      usage: { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined },
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
        const msg: any = e.data;
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
            reject(new Error(String(msg.data || "Worker initialization failed")));
            return;
          }

          // Only track file-related messages (raw ProgressInfo events)
          if ((msg as any).file) trackProgress(msg);
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
    const { messages, warnings, generationOptions } = this.getArgs(options);

    if (this.config.worker) {
      return this.doStreamWithWorker(messages, warnings, generationOptions, options);
    }

    const self = this;

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      async start(controller) {
        let isFirstChunk = true;
        const textId = "text-0";

        controller.enqueue({
          type: "stream-start",
          warnings,
        });

        try {
          const [tokenizer, model] = await self.getSession(self.config.initProgressCallback);

          const inputs = tokenizer.apply_chat_template(messages, {
            add_generation_prompt: true,
            return_dict: true,
          });

          let inputLength = (inputs as any).input_ids.data.length;
          let outputTokens = 0;

          const streamCallback = (text: string) => {
            if (isFirstChunk) {
              controller.enqueue({ type: "text-start", id: textId });
              isFirstChunk = false;
            }

            outputTokens++;
            controller.enqueue({
              type: "text-delta",
              id: textId,
              delta: text,
            });
          };

          const streamer = new CallbackTextStreamer(tokenizer, streamCallback);
          self.stoppingCriteria.reset();

          if (options.abortSignal) {
            options.abortSignal.addEventListener("abort", () => {
              self.stoppingCriteria.interrupt();
            });
          }

          await model.generate({
            ...(inputs as any),
            ...generationOptions,
            streamer,
            stopping_criteria: self.stoppingCriteria,
          });

          // Send text end event
          if (!isFirstChunk) {
            controller.enqueue({ type: "text-end", id: textId });
          }

          controller.enqueue({
            type: "finish",
            finishReason: "stop" as LanguageModelV2FinishReason,
            usage: {
              inputTokens: inputLength,
              outputTokens,
              totalTokens: inputLength + outputTokens,
            },
          });
        } catch (error) {
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return {
      stream,
      request: { body: { messages, ...generationOptions } },
    };
  }

  private async doStreamWithWorker(
    messages: Array<{ role: string; content: any }>,
    warnings: LanguageModelV2CallWarning[],
    generationOptions: GenerationOptions,
    options: LanguageModelV2CallOptions,
  ) {
    const worker = this.config.worker!;

    // Ensure worker is ready
    await this.initializeWorker();

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      start: (controller) => {
        let isFirst = true;
        const textId = "text-0";
        controller.enqueue({ type: "stream-start", warnings });

        const onMessage = (e: MessageEvent) => {
          const msg = e.data;
          if (!msg) return;
          if (msg.status === "start") {
            // no-op
          } else if (msg.status === "update" && typeof msg.output === "string") {
            if (isFirst) {
              controller.enqueue({ type: "text-start", id: textId });
              isFirst = false;
            }
            controller.enqueue({ type: "text-delta", id: textId, delta: msg.output });
          } else if (msg.status === "complete") {
            if (!isFirst) controller.enqueue({ type: "text-end", id: textId });
            controller.enqueue({
              type: "finish",
              finishReason: "stop",
              usage: { inputTokens: undefined, outputTokens: msg.numTokens, totalTokens: undefined },
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

        worker.postMessage({ type: "generate", data: messages, generationOptions });
      },
    });

    return { stream, request: { body: { messages, ...generationOptions } } };
  }
}