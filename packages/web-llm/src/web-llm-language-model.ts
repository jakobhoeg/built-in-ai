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

type WebLLMConfig = {
  provider: string;
  modelId: WebLLMModelId;
  settings: WebLLMSettings;
};

function convertPromptToWebLLM(
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
            // TODO: Implement tool calls when WebLLM supports them fully
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
        // TODO: Implement tool results when WebLLM supports them fully
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

  constructor(modelId: WebLLMModelId, settings: WebLLMSettings = {}) {
    this.modelId = modelId;
    this.config = {
      provider: this.provider,
      modelId,
      settings,
    };
  }

  private async initializeEngine(
    progressCallback?: (progress: webllm.InitProgressReport) => void,
  ): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initializeEngine(progressCallback);
    await this.initializationPromise;
    this.isInitialized = true;
  }

  private async _initializeEngine(
    progressCallback?: (progress: webllm.InitProgressReport) => void,
  ): Promise<void> {
    try {
      // Create engine instance once
      if (!this.engine) {
        const engineConfig = {
          ...this.config.settings.engineConfig,
          initProgressCallback:
            progressCallback || this.config.settings.initProgressCallback,
        };

        this.engine = new webllm.MLCEngine(engineConfig);
      }

      // Load the model using reload - this will use cache if available
      await this.engine.reload(this.modelId);
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

  private async getEngine(
    progressCallback?: (progress: webllm.InitProgressReport) => void,
  ): Promise<webllm.MLCEngineInterface> {
    await this.initializeEngine(progressCallback);

    if (!this.engine) {
      throw new LoadSettingError({
        message: "Engine initialization failed",
      });
    }

    return this.engine;
  }

  private getRequestOptions(options: LanguageModelV2CallOptions) {
    const warnings: LanguageModelV2CallWarning[] = [];

    // Check for unsupported settings and add warnings
    if (options.tools && options.tools.length > 0) {
      warnings.push({
        type: "unsupported-setting",
        setting: "tools",
        details: "Tool calling is not yet fully supported by WebLLM",
      });
    }

    if (options.stopSequences) {
      warnings.push({
        type: "unsupported-setting",
        setting: "stopSequences",
        details: "Stop sequences may not be fully supported by WebLLM",
      });
    }

    if (options.presencePenalty) {
      warnings.push({
        type: "unsupported-setting",
        setting: "presencePenalty",
        details: "Presence penalty is not supported by WebLLM",
      });
    }

    if (options.frequencyPenalty) {
      warnings.push({
        type: "unsupported-setting",
        setting: "frequencyPenalty",
        details: "Frequency penalty is not supported by WebLLM",
      });
    }

    const requestOptions: webllm.ChatCompletionRequestNonStreaming = {
      messages: convertPromptToWebLLM(options.prompt),
      temperature: options.temperature,
      max_tokens: options.maxOutputTokens,
      top_p: options.topP,
      seed: options.seed,
      stream: false,
    };

    // Handle response format
    if (options.responseFormat?.type === "json") {
      (requestOptions as any).response_format = { type: "json_object" };
    }

    return { requestOptions, warnings };
  }

  get supportedUrls(): Record<string, RegExp[]> {
    // WebLLM doesn't support URLs natively
    return {};
  }

  /**
   * Generates a complete text response using WebLLM
   */
  public async doGenerate(options: LanguageModelV2CallOptions) {
    const engine = await this.getEngine();
    const { requestOptions, warnings } = this.getRequestOptions(options);

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
   * Generates a streaming text response using WebLLM
   */
  public async doStream(options: LanguageModelV2CallOptions) {
    const { requestOptions, warnings } = this.getRequestOptions(options);

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

        // Handle abort signal
        if (options.abortSignal) {
          options.abortSignal.addEventListener("abort", () => {
            controller.close();
          });
        }

        try {
          // Initialize engine with progress reporting
          // Progress is handled via the initProgressCallback in settings, not through the stream
          const engine = await self.getEngine();

          const streamingRequest: webllm.ChatCompletionRequestStreaming = {
            messages: convertPromptToWebLLM(options.prompt),
            temperature: options.temperature,
            max_tokens: options.maxOutputTokens,
            top_p: options.topP,
            seed: options.seed,
            stream: true,
            stream_options: { include_usage: true },
          };

          // Handle response format
          if (options.responseFormat?.type === "json") {
            (streamingRequest as any).response_format = { type: "json_object" };
          }

          const response =
            await engine.chat.completions.create(streamingRequest);

          for await (const chunk of response) {
            if (options.abortSignal?.aborted) {
              break;
            }

            const choice = chunk.choices[0];
            if (!choice) continue;

            if (isFirstChunk && choice.delta.content) {
              // Send text start event for actual response
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
