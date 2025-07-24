import {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2CallWarning,
  LanguageModelV2Content,
  LanguageModelV2FinishReason,
  LanguageModelV2StreamPart,
  LoadSettingError,
} from "@ai-sdk/provider";
import { convertToWebLLMMessages } from "./convert-to-webllm-messages";

import {
  AppConfig,
  ChatCompletionRequestStreaming,
  CreateWebWorkerMLCEngine,
  InitProgressReport,
  MLCEngine,
  MLCEngineConfig,
  MLCEngineInterface,
} from "@mlc-ai/web-llm";
import { Availability } from "./types";

declare global {
  interface Navigator {
    gpu?: unknown;
  }
}

export type WebLLMModelId = string;

export interface WebLLMSettings {
  /**
   * Custom app configuration for WebLLM
   */
  appConfig?: AppConfig;
  /**
   * Progress callback for model initialization
   */
  initProgressCallback?: (progress: InitProgressReport) => void;
  /**
   * Engine configuration options
   */
  engineConfig?: MLCEngineConfig;
  /**
   * A web worker instance to run the model in.
   * When provided, the model will run in a separate thread.
   *
   * @default undefined
   */
  worker?: Worker;
}

/**
 * Check if the browser supports WebLLM
 * @returns true if the browser supports WebLLM, false otherwise
 */
export function doesBrowserSupportWebLLM(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return navigator.gpu !== undefined;
}

type WebLLMConfig = {
  provider: string;
  modelId: WebLLMModelId;
  options: WebLLMSettings;
};

export class WebLLMLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2";
  readonly modelId: WebLLMModelId;
  readonly provider = "web-llm";

  private readonly config: WebLLMConfig;
  private engine?: MLCEngineInterface;
  private isInitialized = false;
  private initializationPromise?: Promise<void>;

  constructor(modelId: WebLLMModelId, options: WebLLMSettings = {}) {
    this.modelId = modelId;
    this.config = {
      provider: this.provider,
      modelId,
      options,
    };
  }

  readonly supportedUrls: Record<string, RegExp[]> = {
    // WebLLM doesn't support URLs natively
  };

  /**
   * Check if the model is initialized and ready to use
   * @returns true if the model is initialized, false otherwise
   */
  get isModelInitialized(): boolean {
    return this.isInitialized;
  }

  private async getEngine(
    options?: MLCEngineConfig,
    onInitProgress?: (progress: InitProgressReport) => void,
  ): Promise<MLCEngineInterface> {
    const availability = await this.availability();
    if (availability === "unavailable") {
      throw new LoadSettingError({
        message:
          "WebLLM is not available. This library requires a browser with WebGPU support.",
      });
    }

    if (this.engine && this.isInitialized) return this.engine;

    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      await this.initializationPromise;
      if (this.engine) return this.engine;
    }

    this.initializationPromise = this._initializeEngine(
      options,
      onInitProgress,
    );
    await this.initializationPromise;

    if (!this.engine) {
      throw new LoadSettingError({
        message: "Engine initialization failed",
      });
    }

    return this.engine;
  }

  private async _initializeEngine(
    options?: MLCEngineConfig,
    onInitProgress?: (progress: InitProgressReport) => void,
  ): Promise<void> {
    try {
      // Create engine instance
      const engineConfig = {
        ...this.config.options.engineConfig,
        ...options,
        initProgressCallback:
          onInitProgress || this.config.options.initProgressCallback,
      };

      if (this.config.options.worker) {
        this.engine = await CreateWebWorkerMLCEngine(
          this.config.options.worker,
          this.modelId,
          engineConfig,
        );
      } else {
        this.engine = new MLCEngine(engineConfig);
        // Load the model
        await this.engine.reload(this.modelId);
      }

      this.isInitialized = true;
    } catch (error) {
      // Reset state on error so we can retry
      this.engine = undefined;
      this.isInitialized = false;
      this.initializationPromise = undefined;

      throw new LoadSettingError({
        message: `Failed to initialize WebLLM engine: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
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
        details: "Tool calling is not yet fully implemented",
      });
    }

    if (topK != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "topK",
        details: "topK is not supported by WebLLM",
      });
    }

    if (stopSequences != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "stopSequences",
        details: "Stop sequences may not be fully implemented",
      });
    }

    if (presencePenalty != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "presencePenalty",
        details: "Presence penalty is not fully implemented",
      });
    }

    if (frequencyPenalty != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "frequencyPenalty",
        details: "Frequency penalty is not fully implemented",
      });
    }

    // Convert messages to WebLLM format
    const messages = convertToWebLLMMessages(prompt);

    // Build request options
    const requestOptions: any = {
      messages,
      temperature,
      max_tokens: maxOutputTokens,
      top_p: topP,
      seed,
    };

    // Handle response format
    if (responseFormat?.type === "json") {
      requestOptions.response_format = { type: "json_object" };
    }

    return {
      messages,
      warnings,
      requestOptions,
    };
  }

  /**
   * Generates a complete text response using WebLLM
   * @param options
   * @returns Promise resolving to the generated content with finish reason, usage stats, and any warnings
   * @throws {LoadSettingError} When WebLLM is not available or model needs to be downloaded
   * @throws {UnsupportedFunctionalityError} When unsupported features like file input are used
   */
  public async doGenerate(options: LanguageModelV2CallOptions) {
    const converted = this.getArgs(options);
    const { warnings, requestOptions } = converted;

    const engine = await this.getEngine();

    const abortHandler = async () => {
      await engine.interruptGenerate();
    };

    if (options.abortSignal) {
      options.abortSignal.addEventListener("abort", abortHandler);
    }

    try {
      const response = await engine.chat.completions.create({
        ...requestOptions,
        stream: false,
        ...(options.abortSignal &&
          !this.config.options.worker && { signal: options.abortSignal }),
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new Error("No response choice returned from WebLLM");
      }

      const content: LanguageModelV2Content[] = [];
      if (choice.message.content) {
        content.push({
          type: "text",
          text: choice.message.content,
        });
      }

      let finishReason: LanguageModelV2FinishReason = "stop";
      if (choice.finish_reason === "abort") {
        finishReason = "other";
      }

      return {
        content,
        finishReason,
        usage: {
          inputTokens: response.usage?.prompt_tokens,
          outputTokens: response.usage?.completion_tokens,
          totalTokens: response.usage?.total_tokens,
        },
        request: { body: requestOptions },
        warnings,
      };
    } catch (error) {
      throw new Error(
        `WebLLM generation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    } finally {
      if (options.abortSignal) {
        options.abortSignal.removeEventListener("abort", abortHandler);
      }
    }
  }

  /**
   * Check the availability of the TransformersJS model
   * @returns Promise resolving to "unavailable", "available", or "available-after-download"
   */
  public async availability(): Promise<Availability> {
    if (!doesBrowserSupportWebLLM()) {
      return "unavailable";
    }

    if (this.isInitialized) {
      return "available";
    }

    return "downloadable";
  }

  /**
   * Creates an engine session with download progress monitoring.
   *
   * @example
   * ```typescript
   * const engine = await model.createSessionWithProgress(
   *   (progress) => {
   *     console.log(`Download progress: ${Math.round(progress.loaded * 100)}%`);
   *   }
   * );
   * ```
   *
   * @param onInitProgress Optional callback receiving progress reports during model download
   * @returns Promise resolving to a configured WebLLM engine
   * @throws {LoadSettingError} When WebLLM is not available or model is unavailable
   */
  public async createSessionWithProgress(
    onInitProgress?: (progress: InitProgressReport) => void,
  ): Promise<MLCEngineInterface> {
    return this.getEngine(undefined, onInitProgress);
  }

  /**
   * Generates a streaming text response using WebLLM
   * @param options
   * @returns Promise resolving to a readable stream of text chunks and request metadata
   * @throws {LoadSettingError} When WebLLM is not available or model needs to be downloaded
   * @throws {UnsupportedFunctionalityError} When unsupported features like file input are used
   */
  public async doStream(options: LanguageModelV2CallOptions) {
    const converted = this.getArgs(options);
    const { warnings, requestOptions } = converted;

    const engine = await this.getEngine();
    const useWorker = this.config.options.worker != null;

    const abortHandler = async () => {
      await engine.interruptGenerate();
    };

    if (options.abortSignal) {
      options.abortSignal.addEventListener("abort", abortHandler);
    }

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      async start(controller) {
        let isFirstChunk = true;
        const textId = "text-0";
        // Send stream start event with warnings
        controller.enqueue({
          type: "stream-start",
          warnings,
        });

        try {
          const streamingRequest: ChatCompletionRequestStreaming = {
            ...requestOptions,
            stream: true,
            stream_options: { include_usage: true },
            ...(options.abortSignal &&
              !useWorker && { signal: options.abortSignal }),
          };

          const response =
            await engine.chat.completions.create(streamingRequest);

          for await (const chunk of response) {
            const choice = chunk.choices[0];
            if (!choice) continue;

            if (isFirstChunk && choice.delta.content) {
              controller.enqueue({ type: "text-start", id: textId });
              isFirstChunk = false;
            }

            if (choice.delta.content) {
              controller.enqueue({
                type: "text-delta",
                id: textId,
                delta: choice.delta.content,
              });
            }

            if (choice.finish_reason) {
              controller.enqueue({ type: "text-end", id: textId });

              let finishReason: LanguageModelV2FinishReason = "stop";
              if (choice.finish_reason === "abort") {
                finishReason = "other";
              }

              controller.enqueue({
                type: "finish",
                finishReason,
                usage: {
                  inputTokens: chunk.usage?.prompt_tokens,
                  outputTokens: chunk.usage?.completion_tokens,
                  totalTokens: chunk.usage?.total_tokens,
                },
              });
            }
          }
        } catch (error) {
          // Propagate all other errors.
          controller.error(error);
        } finally {
          if (options.abortSignal) {
            options.abortSignal.removeEventListener("abort", abortHandler);
          }
          controller.close();
        }
      },
    });

    return {
      stream,
      request: { body: requestOptions },
    };
  }
}
