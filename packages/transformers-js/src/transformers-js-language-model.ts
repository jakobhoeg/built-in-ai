import {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2CallWarning,
  LanguageModelV2Content,
  LanguageModelV2FinishReason,
  LanguageModelV2Prompt,
  LanguageModelV2StreamPart,
  LoadSettingError,
  UnsupportedFunctionalityError,
} from "@ai-sdk/provider";
import {
  pipeline,
  TextGenerationPipeline,
  TextGenerationConfig,
  AutoTokenizer,
  AutoModelForCausalLM,
  TextStreamer,
  StoppingCriteria,
  PretrainedModelOptions
} from "@huggingface/transformers";

export type TransformersJSTextModelId = string;

// Combine model settings with text generation config
export interface TransformersJSTextSettings extends PretrainedModelOptions, Partial<TextGenerationConfig> {
  // Additional TransformersJS-specific settings not in PretrainedModelOptions

  /**
   * Custom model cache settings
   * @default true
   */
  cache?: boolean;

  /**
   * Progress callback for model loading
   */
  initProgressCallback?: (progress: { progress: number; status: string; message: string }) => void;
}

type TransformersJSConfig = {
  provider: string;
  modelId: TransformersJSTextModelId;
  options: TransformersJSTextSettings;
};

// Custom TextStreamer for real-time streaming
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

// Interruptable stopping criteria
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

// WebGPU capability checking
async function hasWebGPU(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
      return false;
    }
    const adapter = await (navigator as any).gpu.requestAdapter();
    return !!adapter;
  } catch (e) {
    return false;
  }
}

async function hasFp16(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
      return false;
    }
    const adapter = await (navigator as any).gpu.requestAdapter();
    return adapter?.features.has('shader-f16') || false;
  } catch (e) {
    return false;
  }
}

// Check for basic browser environment (more lenient)
function checkBrowserSupport(): { supported: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (typeof window === 'undefined') {
    return { supported: false, warnings: ['Not running in browser environment'] };
  }

  // These are warnings, not blocking issues
  if (typeof SharedArrayBuffer === 'undefined') {
    warnings.push('SharedArrayBuffer not available - some features may be limited without CORS headers');
  }

  if (typeof crossOriginIsolated !== 'undefined' && !crossOriginIsolated) {
    warnings.push('Cross-origin isolation not enabled - some features may be limited without proper CORS headers');
  }

  return {
    supported: true, // Only block if not in browser at all
    warnings
  };
}

function convertPromptToMessages(prompt: LanguageModelV2Prompt): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];

  for (const message of prompt) {
    switch (message.role) {
      case "system":
        messages.push({
          role: "system",
          content: message.content,
        });
        break;
      case "user":
        const userContent: string[] = [];
        for (const part of message.content) {
          if (part.type === "text") {
            userContent.push(part.text);
          } else if (part.type === "file") {
            throw new UnsupportedFunctionalityError({
              functionality: "file input",
            });
          }
        }
        messages.push({
          role: "user",
          content: userContent.join("\n"),
        });
        break;
      case "assistant":
        let assistantContent = "";
        for (const part of message.content) {
          if (part.type === "text") {
            assistantContent += part.text;
          } else if (part.type === "tool-call") {
            throw new UnsupportedFunctionalityError({
              functionality: "tool calling",
            });
          }
        }
        messages.push({
          role: "assistant",
          content: assistantContent,
        });
        break;
      case "tool":
        throw new UnsupportedFunctionalityError({
          functionality: "tool results",
        });
    }
  }

  return messages;
}

export class TransformersJSLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2";
  readonly provider = "transformers-js";
  readonly modelId: TransformersJSTextModelId;
  readonly supportsParallelCalls = false;

  private readonly config: TransformersJSConfig;
  private model: any = null;
  private tokenizer: any = null;
  private isInitialized = false;
  private initializationPromise?: Promise<void>;
  private stoppingCriteria = new InterruptableStoppingCriteria();

  constructor(
    modelId: TransformersJSTextModelId,
    options: TransformersJSTextSettings = {}
  ) {
    this.modelId = modelId;
    this.config = {
      provider: this.provider,
      modelId,
      options: {
        device: "webgpu",
        dtype: "q4f16",
        cache: true,
        ...options,
      },
    };
  }

  get supportedUrls(): Record<string, RegExp[]> {
    // TransformersJS doesn't support URLs natively
    return {};
  }

  private async initializeModel(
    progressCallback?: (progress: { progress: number; status: string; message: string }) => void,
  ): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initializeModel(progressCallback);
    await this.initializationPromise;
    this.isInitialized = true;
  }

  private async _initializeModel(
    progressCallback?: (progress: { progress: number; status: string; message: string }) => void,
  ): Promise<void> {
    try {
      // Check browser support
      const browserSupport = checkBrowserSupport();
      if (!browserSupport.supported) {
        throw new LoadSettingError({
          message: `Browser environment not supported: ${browserSupport.warnings.join(', ')}`,
        });
      }

      // Log warnings but don't block initialization
      if (browserSupport.warnings.length > 0) {
        console.warn('[TransformersJS]', browserSupport.warnings.join('; '));
      }

      // Check WebGPU support if device is webgpu
      if (this.config.options.device === 'webgpu') {
        progressCallback?.({ progress: 5, status: 'loading', message: 'Checking WebGPU support...' });
        const webgpuSupported = await hasWebGPU();
        if (!webgpuSupported) {
          throw new LoadSettingError({
            message: 'WebGPU is not supported on this device. Please use a browser that supports WebGPU or set device to "cpu".',
          });
        }
      }

      progressCallback?.({ progress: 10, status: 'loading', message: 'Initializing model components...' });

      // Track download progress for model
      const progressState = {
        model: { files: new Map(), totalProgress: 0, status: 'pending' },
        tokenizer: { files: new Map(), totalProgress: 0, status: 'pending' },
      };

      const createProgressCallback = (component: 'model' | 'tokenizer') => (progress: any) => {
        const state = progressState[component];

        if (progress.status === 'progress') {
          const file = progress.file || 'unknown';
          const existing = state.files.get(file) || { loaded: 0, total: progress.total };

          if (progress.loaded > existing.loaded) {
            state.files.set(file, {
              loaded: progress.loaded,
              total: progress.total,
            });
          }

          let loadedSum = 0;
          let totalSum = 0;
          for (const { loaded, total } of state.files.values()) {
            loadedSum += loaded;
            totalSum += total;
          }

          state.totalProgress = totalSum > 0 ? (loadedSum / totalSum) * 100 : 0;
          state.status = 'progress';

          // Calculate overall progress (model is ~90%, tokenizer is ~10%)
          const overallProgress = Math.round(
            10 + (progressState.tokenizer.totalProgress * 0.1) + (progressState.model.totalProgress * 0.8)
          );

          progressCallback?.({
            progress: overallProgress,
            status: 'loading',
            message: component === 'model'
              ? `Loading model: ${Math.round(state.totalProgress)}%`
              : `Loading tokenizer: ${Math.round(state.totalProgress)}%`
          });
        } else if (progress.status === 'done') {
          state.totalProgress = 100;
          state.status = 'done';
        }
      };

      progressCallback?.({ progress: 15, status: 'loading', message: 'Loading tokenizer...' });

      // Load tokenizer
      this.tokenizer = await AutoTokenizer.from_pretrained(this.modelId, {
        legacy: true,
        progress_callback: createProgressCallback('tokenizer'),
      });

      progressCallback?.({ progress: 25, status: 'loading', message: 'Loading model...' });

      // Load model
      this.model = await AutoModelForCausalLM.from_pretrained(this.modelId, {
        dtype: this.config.options.dtype,
        device: this.config.options.device,
        progress_callback: createProgressCallback('model'),
      });

      progressCallback?.({ progress: 95, status: 'loading', message: 'Compiling shaders and warming up...' });

      // Warm up model with dummy input to compile shaders
      const dummyInputs = this.tokenizer('Hello');
      await this.model.generate({ ...dummyInputs, max_new_tokens: 1 });

      progressCallback?.({ progress: 100, status: 'ready', message: 'Model ready!' });

    } catch (error) {
      // Reset state on error so we can retry
      this.model = null;
      this.tokenizer = null;
      this.isInitialized = false;
      this.initializationPromise = undefined;

      throw new LoadSettingError({
        message: `Failed to initialize TransformersJS model: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  private async getModels(
    progressCallback?: (progress: { progress: number; status: string; message: string }) => void,
  ): Promise<[any, any]> {
    await this.initializeModel(progressCallback);

    if (!this.tokenizer || !this.model) {
      throw new LoadSettingError({
        message: "Model initialization failed",
      });
    }

    return [this.tokenizer, this.model];
  }

  private getRequestOptions(options: LanguageModelV2CallOptions) {
    const warnings: LanguageModelV2CallWarning[] = [];

    // Check for unsupported settings and add warnings
    if (options.tools && options.tools.length > 0) {
      warnings.push({
        type: "unsupported-setting",
        setting: "tools",
        details: "Tool calling is not yet supported by TransformersJS",
      });
    }

    if (options.presencePenalty) {
      warnings.push({
        type: "unsupported-setting",
        setting: "presencePenalty",
        details: "Presence penalty is not supported by TransformersJS",
      });
    }

    if (options.frequencyPenalty) {
      warnings.push({
        type: "unsupported-setting",
        setting: "frequencyPenalty",
        details: "Frequency penalty is not supported by TransformersJS",
      });
    }

    return { warnings };
  }

  /**
   * Check the availability of the TransformersJS model
   * @returns Promise resolving to "unavailable", "available", or "available-after-download"
   */
  public async availability(): Promise<"unavailable" | "available" | "available-after-download"> {
    const support = checkBrowserSupport();

    if (!support.supported) {
      return "unavailable";
    }

    if (this.isInitialized) {
      return "available";
    }

    return "available-after-download";
  }

  /**
   * Creates a session with download progress monitoring.
   *
   * @example
   * ```typescript
   * const session = await model.createSessionWithProgress(
   *   (progress) => {
   *     console.log(`Download progress: ${Math.round(progress * 100)}%`);
   *   }
   * );
   * ```
   *
   * @param onDownloadProgress Optional callback receiving progress values 0-1 during model download
   * @returns Promise resolving to the initialized model instance
   * @throws {LoadSettingError} When model initialization fails
   */
  public async createSessionWithProgress(
    onDownloadProgress?: (progress: number) => void,
  ): Promise<TransformersJSLanguageModel> {
    // Convert the simple progress callback to the detailed format
    const progressCallback = onDownloadProgress ? (progressData: { progress: number; status: string; message: string }) => {
      // Convert progress percentage to 0-1 range
      const normalizedProgress = progressData.progress / 100;
      onDownloadProgress(normalizedProgress);
    } : undefined;

    await this.initializeModel(progressCallback);
    return this;
  }

  async doGenerate(options: LanguageModelV2CallOptions) {
    const [tokenizer, model] = await this.getModels(this.config.options.initProgressCallback);
    const { warnings } = this.getRequestOptions(options);

    try {
      const messages = convertPromptToMessages(options.prompt);

      // Apply chat template
      const inputs = tokenizer.apply_chat_template(messages, {
        add_generation_prompt: true,
        return_dict: true,
      });

      const generationOptions = {
        ...inputs,
        max_new_tokens: options.maxOutputTokens || this.config.options.max_new_tokens || 256,
        temperature: options.temperature || this.config.options.temperature || 0.7,
        top_p: options.topP || this.config.options.top_p,
        top_k: options.topK || this.config.options.top_k,
        do_sample: (options.temperature !== undefined && options.temperature > 0) ||
          this.config.options.do_sample !== false,
      };

      const outputs = await model.generate(generationOptions);

      // Decode only the new tokens
      const inputLength = inputs.input_ids.data.length;
      const newTokens = outputs[0].slice(inputLength);
      const generatedText = tokenizer.decode(newTokens, { skip_special_tokens: true });

      const content: LanguageModelV2Content[] = [
        {
          type: "text",
          text: generatedText,
        },
      ];

      return {
        content,
        finishReason: "stop" as LanguageModelV2FinishReason,
        usage: {
          inputTokens: inputLength,
          outputTokens: newTokens.length,
          totalTokens: inputLength + newTokens.length,
        },
        warnings,
      };
    } catch (error) {
      throw new Error(
        `TransformersJS generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async doStream(options: LanguageModelV2CallOptions) {
    const { warnings } = this.getRequestOptions(options);

    let isFirstChunk = true;
    let textId = "text-0";
    const self = this; // Capture this context for use inside the stream

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      async start(controller) {
        // Send stream start event with warnings
        controller.enqueue({
          type: "stream-start",
          warnings,
        });

        try {
          // Initialize model with progress reporting
          const [tokenizer, model] = await self.getModels(self.config.options.initProgressCallback);

          const messages = convertPromptToMessages(options.prompt);

          // Apply chat template
          const inputs = tokenizer.apply_chat_template(messages, {
            add_generation_prompt: true,
            return_dict: true,
          });

          let fullResponse = '';
          let startTime: number;
          let numTokens = 0;

          // Create streaming callback
          const streamCallback = (output: string) => {
            startTime ??= performance.now();
            numTokens++;

            if (isFirstChunk) {
              // Send text start event for actual response
              controller.enqueue({
                type: "text-start",
                id: textId,
              });
              isFirstChunk = false;
            }

            fullResponse += output;
            controller.enqueue({
              type: "text-delta",
              id: textId,
              delta: output,
            });
          };

          const streamer = new CallbackTextStreamer(tokenizer, streamCallback);
          self.stoppingCriteria.reset();

          // Handle abort signal
          if (options.abortSignal) {
            options.abortSignal.addEventListener('abort', () => {
              self.stoppingCriteria.interrupt();
            });
          }

          const generationOptions = {
            ...inputs,
            max_new_tokens: options.maxOutputTokens || self.config.options.max_new_tokens || 256,
            temperature: options.temperature || self.config.options.temperature || 0.7,
            top_p: options.topP || self.config.options.top_p,
            top_k: options.topK || self.config.options.top_k,
            do_sample: (options.temperature !== undefined && options.temperature > 0) ||
              self.config.options.do_sample !== false,
            streamer,
            stopping_criteria: self.stoppingCriteria,
          };

          // Generate text with streaming
          const outputs = await model.generate(generationOptions);

          // Send text end event
          if (!isFirstChunk) {
            controller.enqueue({
              type: "text-end",
              id: textId,
            });
          }

          // Calculate token counts
          const inputLength = inputs.input_ids.data.length;
          const outputLength = outputs[0].length - inputLength;

          // Send finish event
          controller.enqueue({
            type: "finish",
            finishReason: "stop" as LanguageModelV2FinishReason,
            usage: {
              inputTokens: inputLength,
              outputTokens: outputLength,
              totalTokens: inputLength + outputLength,
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
      warnings,
    };
  }
}

/**
 * Check if the browser environment supports TransformersJS
 * @returns true if the browser supports TransformersJS, false otherwise
 */
export function isTransformersJSAvailable(): boolean {
  try {
    // Check if we're in a real browser environment (not Node.js or jsdom)
    return typeof window !== "undefined" &&
      typeof document !== "undefined" &&
      typeof navigator !== "undefined" &&
      typeof window.location !== "undefined" &&
      window.location.protocol.startsWith("http") &&
      !(typeof process !== 'undefined' && process?.versions?.node); // Exclude Node.js environments
  } catch {
    return false;
  }
} 