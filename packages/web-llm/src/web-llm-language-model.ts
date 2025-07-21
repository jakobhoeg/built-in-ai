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
import * as webllm from "@mlc-ai/web-llm";

export type WebLLMModelId = string;

export interface WebLLMSettings {
  /**
   * Custom app configuration for WebLLM
   */
  appConfig?: webllm.AppConfig;
  /**
   * Progress callback for model initialization
   */
  initProgressCallback?: (progress: webllm.InitProgressReport) => void;
  /**
   * Engine configuration options
   */
  engineConfig?: webllm.MLCEngineConfig;
}

/**
 * Check if the browser supports WebLLM (requires WebGPU)
 * @returns true if the browser supports WebLLM, false otherwise
 */
export function doesBrowserSupportWebLLM(): boolean {
  return "gpu" in navigator;
}

/**
 * Check if WebLLM is available
 * @deprecated Use `doesBrowserSupportWebLLM()` instead for clearer naming
 * @returns true if the browser supports WebLLM, false otherwise
 */
export function isWebLLMModelAvailable(): boolean {
  return "gpu" in navigator;
}

type WebLLMConfig = {
  provider: string;
  modelId: WebLLMModelId;
  options: WebLLMSettings;
};

/**
 * Convert AI SDK prompt format to WebLLM message format
 */
function convertToWebLLMMessages(
  prompt: LanguageModelV2Prompt,
): webllm.ChatCompletionMessageParam[] {
  const messages: webllm.ChatCompletionMessageParam[] = [];

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

export class WebLLMLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2";
  readonly modelId: WebLLMModelId;
  readonly provider = "web-llm";

  private readonly config: WebLLMConfig;
  private engine?: webllm.MLCEngineInterface;
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
    options?: webllm.MLCEngineConfig,
    onInitProgress?: (progress: webllm.InitProgressReport) => void,
  ): Promise<webllm.MLCEngineInterface> {
    if (!doesBrowserSupportWebLLM()) {
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

    this.initializationPromise = this._initializeEngine(options, onInitProgress);
    await this.initializationPromise;

    if (!this.engine) {
      throw new LoadSettingError({
        message: "Engine initialization failed",
      });
    }

    return this.engine;
  }

  private async _initializeEngine(
    options?: webllm.MLCEngineConfig,
    onInitProgress?: (progress: webllm.InitProgressReport) => void,
  ): Promise<void> {
    try {
      // Create engine instance
      const engineConfig = {
        ...this.config.options.engineConfig,
        ...options,
        initProgressCallback:
          onInitProgress || this.config.options.initProgressCallback,
      };

      this.engine = new webllm.MLCEngine(engineConfig);

      // Load the model
      await this.engine.reload(this.modelId);
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
        details: "Tool calling is not yet fully supported by WebLLM",
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
        details: "Stop sequences may not be fully supported by WebLLM",
      });
    }

    if (presencePenalty != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "presencePenalty",
        details: "Presence penalty is not supported by WebLLM",
      });
    }

    if (frequencyPenalty != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "frequencyPenalty",
        details: "Frequency penalty is not supported by WebLLM",
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

    try {
      const response = await engine.chat.completions.create({
        ...requestOptions,
        stream: false,
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
        `WebLLM generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
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
    onInitProgress?: (progress: webllm.InitProgressReport) => void,
  ): Promise<webllm.MLCEngineInterface> {
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

    let isFirstChunk = true;
    const textId = "text-0";

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      async start(controller) {
        // Send stream start event with warnings
        controller.enqueue({
          type: "stream-start",
          warnings,
        });

        // Handle abort signal
        if (options.abortSignal) {
          options.abortSignal.addEventListener("abort", () => {
            controller.close();
          });
        }

        try {
          const streamingRequest: webllm.ChatCompletionRequestStreaming = {
            ...requestOptions,
            stream: true,
            stream_options: { include_usage: true },
          };

          // Pass abort signal to the native streaming method
          if (options.abortSignal) {
            (streamingRequest as any).signal = options.abortSignal;
          }

          const response = await engine.chat.completions.create(streamingRequest);

          for await (const chunk of response) {
            if (options.abortSignal?.aborted) {
              break;
            }

            const choice = chunk.choices[0];
            if (!choice) continue;

            if (isFirstChunk && choice.delta.content) {
              // Send text start event
              controller.enqueue({
                type: "text-start",
                id: textId,
              });
              isFirstChunk = false;
            }

            // Send text delta
            if (choice.delta.content) {
              controller.enqueue({
                type: "text-delta",
                id: textId,
                delta: choice.delta.content,
              });
            }

            // Handle finish
            if (choice.finish_reason) {
              // Send text end event
              controller.enqueue({
                type: "text-end",
                id: textId,
              });

              let finishReason: LanguageModelV2FinishReason = "stop";
              if (choice.finish_reason === "abort") {
                finishReason = "other";
              }

              // Send finish event
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
          controller.error(error);
        } finally {
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
