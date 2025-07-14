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
} from '@ai-sdk/provider';

export type BuiltInAIChatModelId = 'text';

export interface BuiltInAIChatSettings extends LanguageModelCreateOptions { }

type BuiltInAIConfig = {
  provider: string;
  modelId: BuiltInAIChatModelId;
  options: BuiltInAIChatSettings;
};

function getStringContent(prompt: LanguageModelV2Prompt): string {
  let result = '';

  for (const message of prompt) {
    switch (message.role) {
      case 'system':
        result += `${message.content}\n`;
        break;
      case 'assistant':
        for (const part of message.content) {
          if (part.type === 'text') {
            result += `model\n${part.text}\n`;
          } else if (part.type === 'tool-call') {
            // TODO: Implement
          }
        }
        break;
      case 'user':
        for (const part of message.content) {
          if (part.type === 'text') {
            result += `user\n${part.text}\n`;
          } else if (part.type === 'file') {
            throw new UnsupportedFunctionalityError({
              functionality: 'file input'
            });
          }
        }
        break;
      case 'tool':
        // TODO: Implement
        break;
    }
  }

  result += `model\n`;
  return result;
}

export class BuiltInAIChatLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = 'v2';
  readonly modelId: BuiltInAIChatModelId;
  readonly provider = 'browser-ai';

  private readonly config: BuiltInAIConfig;
  private session!: LanguageModel;

  constructor(
    modelId: BuiltInAIChatModelId,
    options: BuiltInAIChatSettings = {}
  ) {
    this.modelId = modelId;
    this.config = {
      provider: this.provider,
      modelId,
      options,
    };
  }

  /**
   * Static method to check if the Prompt API is available
   * @returns true or false
   */
  static isAvailable(): boolean {
    return typeof LanguageModel !== 'undefined';
  }

  private async getSession(
    options?: LanguageModelCreateOptions
  ): Promise<LanguageModel> {
    if (typeof LanguageModel === 'undefined') {
      throw new LoadSettingError({
        message: 'Browser AI API is not available. This library requires Chrome or Edge browser with built-in AI capabilities.'
      });
    }

    if (this.session) return this.session;

    const availability = await LanguageModel.availability();

    if (availability === 'unavailable') {
      throw new LoadSettingError({ message: 'Built-in model not available' });
    }

    if (availability === 'downloadable' || availability === 'downloading') {
      // TODO: We need to handle downloading the model and show it as loading + send back status and progress
      throw new LoadSettingError({ message: 'Built-in model needs to be downloaded first' });
    }

    const mergedOptions = {
      ...this.config.options,
      ...options,
    };

    this.session = await LanguageModel.create(mergedOptions);

    return this.session;
  }

  private async getArgs(options: LanguageModelV2CallOptions): Promise<{
    message: string;
    warnings: LanguageModelV2CallWarning[];
    promptOptions: any;
  }> {
    const warnings: LanguageModelV2CallWarning[] = [];

    // Add warnings for unsupported settings
    if (options.tools && options.tools.length > 0) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'tools',
        details: 'Tool calling is not yet supported by browser AI' // TODO: Implement
      });
    }

    if (options.maxOutputTokens) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'maxOutputTokens',
        details: 'maxOutputTokens is not supported by browser AI'
      });
    }

    if (options.stopSequences) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'stopSequences',
        details: 'stopSequences is not supported by browser AI'
      });
    }

    if (options.topP) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'topP',
        details: 'topP is not supported by browser AI'
      });
    }

    if (options.presencePenalty) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'presencePenalty',
        details: 'presencePenalty is not supported by browser AI'
      });
    }

    if (options.frequencyPenalty) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'frequencyPenalty',
        details: 'frequencyPenalty is not supported by browser AI'
      });
    }

    if (options.seed) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'seed',
        details: 'seed is not supported by browser AI'
      });
    }

    const message = getStringContent(options.prompt);

    // Handle response format for browser AI
    const promptOptions: any = {};
    if (options.responseFormat?.type === 'json') {
      promptOptions.responseConstraint = options.responseFormat.schema;
    }

    // Map supported settings
    if (options.temperature !== undefined) {
      promptOptions.temperature = options.temperature;
    }

    if (options.topK !== undefined) {
      promptOptions.topK = options.topK;
    }

    return { message, warnings, promptOptions };
  }

  get supportedUrls(): Record<string, RegExp[]> {
    // Browser AI doesn't support any URLs natively
    return {};
  }

  /**
   * Generates a complete text response using the browser's built-in Prompt API
   * @param options
   * @returns Promise resolving to the generated content with finish reason, usage stats, and any warnings
   * @throws {LoadSettingError} When browser AI is not available or model needs to be downloaded
   * @throws {UnsupportedFunctionalityError} When unsupported features like file input are used
   */
  public async doGenerate(options: LanguageModelV2CallOptions) {
    const session = await this.getSession();
    const { message, warnings, promptOptions } = await this.getArgs(options);

    const text = await session.prompt(message, promptOptions);

    const content: LanguageModelV2Content[] = [
      {
        type: 'text',
        text,
      }
    ];

    return {
      content,
      finishReason: 'stop' as LanguageModelV2FinishReason,
      usage: {
        inputTokens: undefined,
        outputTokens: undefined,
        totalTokens: undefined
      },
      request: { body: { message, options: promptOptions } },
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
    const session = await this.getSession();
    const { message, warnings, promptOptions } = await this.getArgs(options);

    // Pass abort signal to the native streaming method
    const streamOptions = {
      ...promptOptions,
      signal: options.abortSignal,
    };

    const promptStream = session.promptStreaming(message, streamOptions);

    let isFirstChunk = true;
    let textId = 'text-0';

    const stream = promptStream.pipeThrough(
      new TransformStream<string, LanguageModelV2StreamPart>({
        start(controller) {
          // Send stream start event with warnings
          controller.enqueue({
            type: 'stream-start',
            warnings,
          });

          // Handle abort signal
          if (options.abortSignal) {
            options.abortSignal.addEventListener('abort', () => {
              controller.terminate();
            });
          }
        },

        transform(chunk, controller) {
          if (isFirstChunk) {
            // Send text start event
            controller.enqueue({
              type: 'text-start',
              id: textId,
            });
            isFirstChunk = false;
          }

          // Send text delta
          controller.enqueue({
            type: 'text-delta',
            id: textId,
            delta: chunk,
          });
        },

        flush(controller) {
          // Send text end event
          controller.enqueue({
            type: 'text-end',
            id: textId,
          });

          // Send finish event
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop' as LanguageModelV2FinishReason,
            usage: {
              inputTokens: undefined,
              outputTokens: undefined,
              totalTokens: undefined
            },
          });
        },
      }),
    );

    return {
      stream,
      request: { body: { message, options: promptOptions } },
    };
  }
} 