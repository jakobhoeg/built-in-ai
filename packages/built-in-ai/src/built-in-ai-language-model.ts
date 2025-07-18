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
import { convertToBuiltInAIMessages } from "./convert-to-built-in-ai-messages";

export type BuiltInAIChatModelId = "text";

export interface BuiltInAIChatSettings extends LanguageModelCreateOptions {
  /**
   * Expected input types for the session. This helps the browser prepare
   * for multimodal inputs and download necessary model components.
   */
  expectedInputs?: Array<{
    type: "text" | "image" | "audio";
    languages?: string[];
  }>;
}

/**
 * Check if the Prompt API is available
 * @returns true if the browser supports the built-in AI API, false otherwise
 */
export function isBuiltInAIModelAvailable(): boolean {
  return typeof LanguageModel !== "undefined";
}

type BuiltInAIConfig = {
  provider: string;
  modelId: BuiltInAIChatModelId;
  options: BuiltInAIChatSettings;
};

/**
 * Detect if the prompt contains multimodal content
 */
function hasMultimodalContent(prompt: LanguageModelV2Prompt): boolean {
  for (const message of prompt) {
    if (message.role === "user") {
      for (const part of message.content) {
        if ((part as any).type === "image" || part.type === "file") {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Get expected inputs based on prompt content
 */
function getExpectedInputs(prompt: LanguageModelV2Prompt): Array<{ type: "text" | "image" | "audio" }> {
  const inputs = new Set<"text" | "image" | "audio">();
  // Don't add text by default - it's assumed by the browser API

  for (const message of prompt) {
    if (message.role === "user") {
      for (const part of message.content) {
        if ((part as any).type === "image") {
          inputs.add("image");
        } else if (part.type === "file") {
          if (part.mediaType?.startsWith("image/")) {
            inputs.add("image");
          } else if (part.mediaType?.startsWith("audio/")) {
            inputs.add("audio");
          }
        }
      }
    }
  }

  return Array.from(inputs).map(type => ({ type }));
}

export class BuiltInAIChatLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2";
  readonly modelId: BuiltInAIChatModelId;
  readonly provider = "browser-ai";

  private readonly config: BuiltInAIConfig;
  private session!: LanguageModel;

  constructor(
    modelId: BuiltInAIChatModelId,
    options: BuiltInAIChatSettings = {},
  ) {
    this.modelId = modelId;
    this.config = {
      provider: this.provider,
      modelId,
      options,
    };
  }

  readonly supportedUrls: Record<string, RegExp[]> = {
    "image/*": [/^https?:\/\/.+$/],
    "audio/*": [/^https?:\/\/.+$/],
  };

  private async getSession(
    options?: LanguageModelCreateOptions,
    expectedInputs?: Array<{ type: "text" | "image" | "audio" }>
  ): Promise<LanguageModel> {
    if (typeof LanguageModel === "undefined") {
      throw new LoadSettingError({
        message:
          "Browser AI API is not available. This library requires Chrome or Edge browser with built-in AI capabilities.",
      });
    }

    if (this.session) return this.session;

    const availability = await LanguageModel.availability();

    if (availability === "unavailable") {
      throw new LoadSettingError({ message: "Built-in model not available" });
    }

    if (availability === "downloadable" || availability === "downloading") {
      // TODO: We need to handle downloading the model and show it as loading + send back status and progress
      throw new LoadSettingError({
        message: "Built-in model needs to be downloaded first",
      });
    }

    const mergedOptions = {
      ...this.config.options,
      ...options,
    };

    // Try to create multimodal session if expected inputs are provided
    if (expectedInputs && expectedInputs.length > 0) {
      try {
        mergedOptions.expectedInputs = expectedInputs;
        console.log('Built-in AI: Attempting to create multimodal session with expected inputs:', expectedInputs);
        this.session = await LanguageModel.create(mergedOptions);
        console.log('Built-in AI: Multimodal session created successfully');
        return this.session;
      } catch (error) {
        console.warn('Built-in AI: Multimodal session creation failed, falling back to text-only:', error);
        // Fall back to text-only session
        const textOnlyOptions = { ...mergedOptions };
        delete textOnlyOptions.expectedInputs;
        this.session = await LanguageModel.create(textOnlyOptions);
        console.log('Built-in AI: Text-only fallback session created');
        return this.session;
      }
    }

    console.log('Built-in AI: Creating text-only session with options:', mergedOptions);
    this.session = await LanguageModel.create(mergedOptions);
    console.log('Built-in AI: Session created successfully');

    return this.session;
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
        details: "Tool calling is not yet supported by browser AI",
      });
    }

    if (maxOutputTokens != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "maxOutputTokens",
        details: "maxOutputTokens is not supported by browser AI",
      });
    }

    if (stopSequences != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "stopSequences",
        details: "stopSequences is not supported by browser AI",
      });
    }

    if (topP != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "topP",
        details: "topP is not supported by browser AI",
      });
    }

    if (presencePenalty != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "presencePenalty",
        details: "presencePenalty is not supported by browser AI",
      });
    }

    if (frequencyPenalty != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "frequencyPenalty",
        details: "frequencyPenalty is not supported by browser AI",
      });
    }

    if (seed != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "seed",
        details: "seed is not supported by browser AI",
      });
    }

    // Check if this is a multimodal prompt
    const isMultimodal = hasMultimodalContent(prompt);
    console.log('Built-in AI: isMultimodal:', isMultimodal);

    // Convert messages to the appropriate format
    const messages = isMultimodal
      ? convertToBuiltInAIMessages(prompt)
      : convertToLegacyStringFormat(prompt);

    // Handle response format for browser AI
    const promptOptions: any = {};
    if (responseFormat?.type === "json") {
      promptOptions.responseConstraint = responseFormat.schema;
    }

    // Map supported settings
    if (temperature !== undefined) {
      promptOptions.temperature = temperature;
    }

    if (topK !== undefined) {
      promptOptions.topK = topK;
    }

    return {
      messages,
      warnings,
      promptOptions,
      isMultimodal,
      expectedInputs: isMultimodal ? getExpectedInputs(prompt) : undefined
    };
  }

  /**
   * Generates a complete text response using the browser's built-in Prompt API
   * @param options
   * @returns Promise resolving to the generated content with finish reason, usage stats, and any warnings
   * @throws {LoadSettingError} When browser AI is not available or model needs to be downloaded
   * @throws {UnsupportedFunctionalityError} When unsupported features like file input are used
   */
  public async doGenerate(options: LanguageModelV2CallOptions) {
    const { messages, warnings, promptOptions, expectedInputs, isMultimodal } = await this.getArgs(options);

    console.log('Built-in AI: messages to send:', messages);
    console.log('Built-in AI: expected inputs:', expectedInputs);
    console.log('Built-in AI: prompt options:', promptOptions);

    const session = await this.getSession(undefined, expectedInputs);

    // If we detected multimodal content but couldn't create a multimodal session,
    // we need to check if the session supports multimodal input
    if (isMultimodal && (!expectedInputs || expectedInputs.length === 0)) {
      throw new UnsupportedFunctionalityError({
        functionality: "Multimodal input (images/audio) - this browser/device doesn't support multimodal AI sessions",
      });
    }

    const text = await session.prompt(messages, promptOptions);

    const content: LanguageModelV2Content[] = [
      {
        type: "text",
        text,
      },
    ];

    return {
      content,
      finishReason: "stop" as LanguageModelV2FinishReason,
      usage: {
        inputTokens: undefined,
        outputTokens: undefined,
        totalTokens: undefined,
      },
      request: { body: { messages, options: promptOptions } },
      warnings,
    };
  }

  /**
   * Generates a streaming text response using the browser's built-in Prompt API
   * @param options
   * @returns Promise resolving to a readable stream of text chunks and request metadata
   * @throws {LoadSettingError} When browser AI is not available or model needs to be downloaded
   * @throws {UnsupportedFunctionalityError} When unsupported features like file input are used
   */
  public async doStream(options: LanguageModelV2CallOptions) {
    const { messages, warnings, promptOptions, expectedInputs, isMultimodal } = await this.getArgs(options);

    const session = await this.getSession(undefined, expectedInputs);

    // If we detected multimodal content but couldn't create a multimodal session,
    // we need to check if the session supports multimodal input
    if (isMultimodal && (!expectedInputs || expectedInputs.length === 0)) {
      throw new UnsupportedFunctionalityError({
        functionality: "Multimodal input (images/audio) - this browser/device doesn't support multimodal AI sessions",
      });
    }

    // Pass abort signal to the native streaming method
    const streamOptions = {
      ...promptOptions,
      signal: options.abortSignal,
    };

    const promptStream = session.promptStreaming(messages, streamOptions);

    let isFirstChunk = true;
    const textId = "text-0";

    const stream = promptStream.pipeThrough(
      new TransformStream<string, LanguageModelV2StreamPart>({
        start(controller) {
          // Send stream start event with warnings
          controller.enqueue({
            type: "stream-start",
            warnings,
          });

          // Handle abort signal
          if (options.abortSignal) {
            options.abortSignal.addEventListener("abort", () => {
              controller.terminate();
            });
          }
        },

        transform(chunk, controller) {
          if (isFirstChunk) {
            // Send text start event
            controller.enqueue({
              type: "text-start",
              id: textId,
            });
            isFirstChunk = false;
          }

          // Send text delta
          controller.enqueue({
            type: "text-delta",
            id: textId,
            delta: chunk,
          });
        },

        flush(controller) {
          // Send text end event
          controller.enqueue({
            type: "text-end",
            id: textId,
          });

          // Send finish event
          controller.enqueue({
            type: "finish",
            finishReason: "stop" as LanguageModelV2FinishReason,
            usage: {
              inputTokens: undefined,
              outputTokens: undefined,
              totalTokens: undefined,
            },
          });
        },
      }),
    );

    return {
      stream,
      request: { body: { messages, options: promptOptions } },
    };
  }
}

// Legacy function for backward compatibility - only used for text-only prompts
function convertToLegacyStringFormat(prompt: LanguageModelV2Prompt): string {
  let result = "";

  for (const message of prompt) {
    switch (message.role) {
      case "system":
        result += `${message.content}\n`;
        break;
      case "assistant":
        for (const part of message.content) {
          if (part.type === "text") {
            result += `model\n${part.text}\n`;
          } else if (part.type === "tool-call") {
            // TODO: Implement
          }
        }
        break;
      case "user":
        for (const part of message.content) {
          if (part.type === "text") {
            result += `user\n${part.text}\n`;
          } else if (part.type === "file") {
            throw new UnsupportedFunctionalityError({
              functionality: "file input",
            });
          }
        }
        break;
      case "tool":
        // TODO: Implement
        break;
    }
  }

  result += `model\n`;
  return result;
}
