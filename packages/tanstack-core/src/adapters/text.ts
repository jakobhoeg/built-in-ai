import { BaseTextAdapter } from "@tanstack/ai/adapters";

import {
  SessionManager,
  convertMessagesAsync,
  generateId,
  type SessionCreateOptions,
} from "../utils";
import type { BuiltInAIMessageMetadataByModality } from "../message-types";
import {
  buildJsonToolSystemPrompt,
  parseJsonFunctionCalls,
} from "../tool-calling";
import { ToolCallFenceDetector } from "../streaming";

import type {
  StructuredOutputOptions,
  StructuredOutputResult,
} from "@tanstack/ai/adapters";
import type {
  StreamChunk,
  TextOptions,
  Tool,
  ConstrainedModelMessage,
} from "@tanstack/ai";

/**
 * Built-in AI provider-specific options
 */
export interface BuiltInAIProviderOptions {
  /** Sampling temperature (0.0 to 2.0) */
  temperature?: number;
  /** Top-K sampling parameter */
  topK?: number;
}

/**
 * Options for creating a Built-in AI text adapter
 */
export interface BuiltInAITextAdapterOptions {
  /** Base session options */
  sessionOptions?: SessionCreateOptions;
}

/**
 * Input modalities supported by Built-in AI
 * The Prompt API supports text, image, and audio inputs
 * @see https://github.com/webmachinelearning/prompt-api
 */
export type BuiltInAIInputModalities = readonly ["text", "image", "audio"];

/**
 * Properly typed message for use with BuiltInAITextAdapter and chat().
 *
 * This type ensures messages are constrained to the input modalities
 * (text, image, and audio) and metadata types that the Built-in AI adapter supports.
 */
export type BuiltInAIModelMessage = ConstrainedModelMessage<{
  inputModalities: BuiltInAIInputModalities;
  messageMetadataByModality: BuiltInAIMessageMetadataByModality;
}>;

/**
 * Built-in AI Text/Chat Adapter for TanStack AI SDK
 *
 * Connects TanStack AI SDK to Chrome/Edge's built-in Prompt API (LanguageModel).
 * Supports:
 * - Text, image, and audio inputs (multimodal)
 * - Tool calling via JSON code fences
 * - Structured output
 * - Streaming responses
 *
 * @see https://github.com/webmachinelearning/prompt-api
 */
export class BuiltInAITextAdapter<
  TModel extends string = "text",
> extends BaseTextAdapter<
  TModel,
  BuiltInAIProviderOptions,
  BuiltInAIInputModalities,
  BuiltInAIMessageMetadataByModality
> {
  readonly kind = "text" as const;
  readonly name = "built-in-ai" as const;

  private sessionManager: SessionManager;

  constructor(model: TModel, options?: BuiltInAITextAdapterOptions) {
    super({}, model);
    this.sessionManager = new SessionManager(options?.sessionOptions);
  }

  /**
   * Streams chat responses from the browser's built-in AI model
   *
   * @param options - Text generation options including messages, temperature, tools, etc.
   * @yields StreamChunk objects for content, tool_call, done, and error events
   */
  async *chatStream(
    options: TextOptions<BuiltInAIProviderOptions>,
  ): AsyncIterable<StreamChunk> {
    const timestamp = Date.now();
    const responseId = generateId("msg");

    try {
      const { systemMessage, messages } = await convertMessagesAsync(
        options.messages,
        options.systemPrompts,
      );

      // Build system prompt with tools if provided
      let enhancedSystemMessage = systemMessage;
      const tools = options.tools as Tool[] | undefined;
      if (tools && tools.length > 0) {
        enhancedSystemMessage = buildJsonToolSystemPrompt(systemMessage, tools);
      }

      const session = await this.sessionManager.getSession({
        systemMessage: enhancedSystemMessage,
      });

      const promptOptions: LanguageModelPromptOptions &
        LanguageModelCreateCoreOptions = {};
      const modelOptions = options.modelOptions as
        | BuiltInAIProviderOptions
        | undefined;

      if (options.temperature !== undefined) {
        promptOptions.temperature = options.temperature;
      } else if (modelOptions?.temperature !== undefined) {
        promptOptions.temperature = modelOptions.temperature;
      }

      if (modelOptions?.topK !== undefined) {
        promptOptions.topK = modelOptions.topK;
      }

      // Pass abort signal to the Prompt API if provided
      const abortSignal = options.abortController?.signal;
      if (abortSignal) {
        (promptOptions as LanguageModelPromptOptions).signal = abortSignal;
      }

      // Start streaming
      const stream = session.promptStreaming(messages, promptOptions);
      const reader = stream.getReader();

      let accumulatedContent = "";
      let aborted = false;
      const hasTools = tools && tools.length > 0;
      const fenceDetector = hasTools ? new ToolCallFenceDetector() : null;

      // Set up abort handler to cancel the reader
      const abortHandler = () => {
        aborted = true;
        reader.cancel().catch(() => undefined);
      };

      if (abortSignal) {
        abortSignal.addEventListener("abort", abortHandler);
      }

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done || aborted) {
            break;
          }

          const delta = value;
          accumulatedContent += delta;

          // If we have tools, use fence detector for streaming
          if (fenceDetector && delta) {
            fenceDetector.addChunk(delta);

            while (true) {
              const result = fenceDetector.detectStreamingFence();

              if (result.safeContent && !result.inFence) {
                yield {
                  type: "content",
                  id: responseId,
                  model: options.model,
                  timestamp,
                  delta: result.safeContent,
                  content: accumulatedContent,
                  role: "assistant",
                } as StreamChunk;
              }

              // If we found a complete fence, parse and emit tool calls
              if (result.completeFence) {
                const parsed = parseJsonFunctionCalls(result.completeFence);

                for (let i = 0; i < parsed.toolCalls.length; i++) {
                  const toolCall = parsed.toolCalls[i];
                  yield {
                    type: "tool_call",
                    id: responseId,
                    model: options.model,
                    timestamp,
                    toolCall: {
                      type: "function",
                      id: toolCall.toolCallId,
                      function: {
                        name: toolCall.toolName,
                        arguments: JSON.stringify(toolCall.args),
                      },
                    },
                    index: i,
                  } as StreamChunk;
                }
              }

              if (!result.inFence && !result.safeContent) {
                break;
              }

              if (!fenceDetector.hasContent()) {
                break;
              }
            }
          } else if (delta) {
            yield {
              type: "content",
              id: responseId,
              model: options.model,
              timestamp,
              delta,
              content: accumulatedContent,
              role: "assistant",
            } as StreamChunk;
          }
        }

        // After stream ends, check for any remaining buffered content
        if (fenceDetector && fenceDetector.hasContent()) {
          const finalResult = fenceDetector.detectFence();

          if (finalResult.prefixText) {
            yield {
              type: "content",
              id: responseId,
              model: options.model,
              timestamp,
              delta: finalResult.prefixText,
              content: accumulatedContent,
              role: "assistant",
            } as StreamChunk;
          }

          if (finalResult.fence) {
            const parsed = parseJsonFunctionCalls(finalResult.fence);
            for (let i = 0; i < parsed.toolCalls.length; i++) {
              const toolCall = parsed.toolCalls[i];
              yield {
                type: "tool_call",
                id: responseId,
                model: options.model,
                timestamp,
                toolCall: {
                  type: "function",
                  id: toolCall.toolCallId,
                  function: {
                    name: toolCall.toolName,
                    arguments: JSON.stringify(toolCall.args),
                  },
                },
                index: i,
              } as StreamChunk;
            }
          }
        }

        const fullParsed = parseJsonFunctionCalls(accumulatedContent);
        const hasToolCalls = fullParsed.toolCalls.length > 0;

        if (!aborted) {
          yield {
            type: "done",
            id: responseId,
            model: options.model,
            timestamp,
            finishReason: hasToolCalls ? "tool_calls" : "stop",
          } as StreamChunk;
        }
      } finally {
        if (abortSignal) {
          abortSignal.removeEventListener("abort", abortHandler);
        }
      }
    } catch (error) {
      // Don't emit error for abort
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      yield {
        type: "error",
        id: responseId,
        model: options.model,
        timestamp,
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      } as StreamChunk;
    }
  }

  /**
   * Generate structured output using the browser's built-in AI model
   *
   * Note: The Prompt API supports responseConstraint for JSON schema output.
   *
   * @param options - Structured output options
   * @returns Promise with parsed data and raw text
   */
  async structuredOutput(
    options: StructuredOutputOptions<BuiltInAIProviderOptions>,
  ): Promise<StructuredOutputResult<unknown>> {
    const { chatOptions, outputSchema } = options;

    // Convert messages
    const { systemMessage, messages } = await convertMessagesAsync(
      chatOptions.messages,
      chatOptions.systemPrompts,
    );

    // Get session
    const session = await this.sessionManager.getSession({
      systemMessage,
    });

    // Prepare options with response constraint
    const promptOptions: LanguageModelPromptOptions &
      LanguageModelCreateCoreOptions = {};
    const modelOptions = chatOptions.modelOptions as
      | BuiltInAIProviderOptions
      | undefined;

    if (chatOptions.temperature !== undefined) {
      promptOptions.temperature = chatOptions.temperature;
    } else if (modelOptions?.temperature !== undefined) {
      promptOptions.temperature = modelOptions.temperature;
    }

    if (modelOptions?.topK !== undefined) {
      promptOptions.topK = modelOptions.topK;
    }

    if (outputSchema) {
      promptOptions.responseConstraint = outputSchema as Record<
        string,
        unknown
      >;
    }

    const rawText = await session.prompt(messages, promptOptions);

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error(
        `Failed to parse structured output as JSON. Content: ${rawText.slice(0, 200)}${rawText.length > 200 ? "..." : ""}`,
      );
    }

    return {
      data: parsed,
      rawText,
    };
  }

  /**
   * Check the availability of the built-in AI model
   *
   * @returns Promise resolving to availability status
   */
  async availability(): Promise<Availability> {
    return this.sessionManager.checkAvailability();
  }

  /**
   * Destroy the current session to free resources
   */
  destroySession(): void {
    this.sessionManager.destroySession();
  }
}

/**
 * Creates a Built-in AI text adapter
 *
 * @param model - Model identifier (defaults to 'text')
 * @param options - Optional adapter configuration
 * @returns BuiltInAITextAdapter instance
 *
 * @example
 * ```typescript
 * const adapter = builtInAIText()
 *
 * // Or with options
 * const adapter = builtInAIText('text', {
 *   sessionOptions: { temperature: 0.7 }
 * })
 * ```
 */
export function builtInAI<TModel extends string = "text">(
  model: TModel = "text" as TModel,
  options?: BuiltInAITextAdapterOptions,
): BuiltInAITextAdapter<TModel> {
  return new BuiltInAITextAdapter(model, options);
}

/**
 * Creates a Built-in AI chat adapter (alias for builtInAIText)
 */
export const createBuiltInAIChat = builtInAI;
