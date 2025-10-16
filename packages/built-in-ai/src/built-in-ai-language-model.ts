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
  JSONValue,
} from "@ai-sdk/provider";
import { convertToBuiltInAIMessages } from "./convert-to-built-in-ai-messages";
import {
  buildJsonToolSystemPrompt,
  parseJsonFunctionCalls,
  hasJsonFunctionCalls,
} from "./tool-calling";
import type { ParsedToolCall } from "./tool-calling";
import {
  gatherUnsupportedSettingWarnings,
  createUnsupportedToolWarning,
} from "./utils/warnings";
import {
  hasMultimodalContent,
  getExpectedInputs,
  prependSystemPromptToMessages,
} from "./utils/prompt-utils";
import {
  shouldExecuteToolsInParallel,
  shouldDebugToolCalls,
  resolveOutputLanguage,
} from "./utils/provider-options";
import { isFunctionTool } from "./utils/tool-utils";
import { SessionManager } from "./models/session-manager";
import { ToolCallFenceDetector } from "./streaming/tool-call-detector";

export type BuiltInAIChatModelId = "text";

export interface BuiltInAIChatSettings extends LanguageModelCreateOptions {
  /**
   * Expected input types for the session, for multimodal inputs.
   */
  expectedInputs?: Array<{
    type: "text" | "image" | "audio";
    languages?: string[];
  }>;
  /**
   * Whether tool calls with available executors should run in parallel.
   * Defaults to sequential execution.
   */
  parallelToolExecution?: boolean;
  /**
   * Enable verbose logging for tool call detection/execution.
   * Useful when debugging new transports or MCP integrations.
   */
  debugToolCalls?: boolean;
  /**
   * Preferred output language for model responses. Defaults to English.
   */
  outputLanguage?: "en" | "es" | "ja";
}

/**
 * Check if the browser supports the built-in AI API
 * @returns true if the browser supports the built-in AI API, false otherwise
 */
export function doesBrowserSupportBuiltInAI(): boolean {
  return typeof LanguageModel !== "undefined";
}

/**
 * Check if the Prompt API is available
 * @deprecated Use `doesBrowserSupportBuiltInAI()` instead for clearer naming
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


export class BuiltInAIChatLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2";
  readonly modelId: BuiltInAIChatModelId;
  readonly provider = "browser-ai";

  private readonly config: BuiltInAIConfig;
  private readonly sessionManager: SessionManager;

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
    this.sessionManager = new SessionManager(options);
  }

  readonly supportedUrls: Record<string, RegExp[]> = {
    "image/*": [/^https?:\/\/.+$/],
    "audio/*": [/^https?:\/\/.+$/],
  };

  /**
   * Gets a session with the specified options
   * Delegates to SessionManager for all session lifecycle management
   * @private
   */
  private async getSession(
    options?: LanguageModelCreateOptions,
    expectedInputs?: Array<{ type: "text" | "image" | "audio" }>,
    systemMessage?: string,
    onDownloadProgress?: (progress: number) => void,
  ): Promise<LanguageModel> {
    return this.sessionManager.getSession({
      ...options,
      expectedInputs,
      systemMessage,
      onDownloadProgress,
    });
  }

  private getArgs(callOptions: Parameters<LanguageModelV2["doGenerate"]>[0]) {
    const {
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
      providerOptions,
    } = callOptions;
    const warnings: LanguageModelV2CallWarning[] = [];

    const debugToolCalls = shouldDebugToolCalls(
      callOptions,
      this.config.options.debugToolCalls,
    );

    // Gather warnings for unsupported settings
    warnings.push(
      ...gatherUnsupportedSettingWarnings({
        maxOutputTokens,
        stopSequences,
        topP,
        presencePenalty,
        frequencyPenalty,
        seed,
        toolChoice,
      }),
    );

    // Filter and warn about unsupported tools
    const functionTools = (tools ?? []).filter(isFunctionTool);

    const unsupportedTools = (tools ?? []).filter(
      (tool): tool is LanguageModelV2ProviderDefinedTool => !isFunctionTool(tool),
    );

    for (const tool of unsupportedTools) {
      warnings.push(
        createUnsupportedToolWarning(
          tool,
          "Only function tools are supported by the Prompt API polyfill",
        ),
      );
    }

    // Check if this is a multimodal prompt
    const hasMultiModalInput = hasMultimodalContent(prompt);

    // Convert messages to the DOM API format
    const { systemMessage, messages } = convertToBuiltInAIMessages(prompt);

    // Handle response format for Prompt API
    const promptOptions: LanguageModelPromptOptions &
      LanguageModelCreateCoreOptions = {};
    if (responseFormat?.type === "json") {
      promptOptions.responseConstraint = responseFormat.schema as Record<
        string,
        JSONValue
      >;
    }

    // Map supported settings
    if (temperature !== undefined) {
      promptOptions.temperature = temperature;
    }

    if (topK !== undefined) {
      promptOptions.topK = topK;
    }

    return {
      systemMessage,
      messages,
      warnings,
      promptOptions,
      hasMultiModalInput,
      expectedInputs: hasMultiModalInput
        ? getExpectedInputs(prompt)
        : undefined,
      functionTools,
      debugToolCalls,
    };
  }

  /**
   * Generates a complete text response using the browser's built-in Prompt API
   * @param options
   * @returns Promise resolving to the generated content with finish reason, usage stats, and any warnings
   * @throws {LoadSettingError} When the Prompt API is not available or model needs to be downloaded
   * @throws {UnsupportedFunctionalityError} When unsupported features like file input are used
   */
  public async doGenerate(options: LanguageModelV2CallOptions) {
    const converted = this.getArgs(options);
    const {
      systemMessage,
      messages,
      warnings,
      promptOptions,
      expectedInputs,
      functionTools,
      debugToolCalls,
    } = converted;

    const session = await this.getSession(
      undefined,
      expectedInputs,
      undefined,
    );

    const parallelToolExecutionOption = shouldExecuteToolsInParallel(
      options,
      this.config.options.parallelToolExecution,
    );

    // Build system prompt with JSON tool calling
    const systemPrompt = await buildJsonToolSystemPrompt(systemMessage, functionTools, {
      allowParallelToolCalls: parallelToolExecutionOption,
    });

    const promptMessages = prependSystemPromptToMessages(messages, systemPrompt);
    const rawResponse = await session.prompt(promptMessages, promptOptions);

    // Parse JSON tool calls from response
    const { toolCalls, textContent } = parseJsonFunctionCalls(rawResponse);

    if (toolCalls.length > 0) {
      if (debugToolCalls) {
        console.debug("[BuiltInAI] Tool calls detected:", toolCalls.length);
        if (!parallelToolExecutionOption && toolCalls.length > 1) {
          console.debug("[BuiltInAI] Parallel execution disabled, emitting first call only");
        }
      }

      const toolCallsToEmit = parallelToolExecutionOption ? toolCalls : toolCalls.slice(0, 1);

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
        usage: {
          inputTokens: undefined,
          outputTokens: undefined,
          totalTokens: undefined,
        },
        request: { body: { messages: promptMessages, options: promptOptions } },
        warnings,
      };
    }

    if (debugToolCalls) {
      const hasFence = hasJsonFunctionCalls(rawResponse);
      if (hasFence) {
        console.debug("[BuiltInAI] Tool call fence detected but parsing failed");
      }
    }

    const content: LanguageModelV2Content[] = [
      {
        type: "text",
        text: textContent || rawResponse,
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
      request: { body: { messages: promptMessages, options: promptOptions } },
      warnings,
    };
  }

  /**
   * Check the availability of the built-in AI model
   * @returns Promise resolving to "unavailable", "available", or "available-after-download"
   */
  public async availability(): Promise<Availability> {
    return this.sessionManager.checkAvailability();
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
   * @returns Promise resolving to a configured LanguageModel session
   * @throws {LoadSettingError} When the Prompt API is not available or model is unavailable
  */
  public async createSessionWithProgress(
    onDownloadProgress?: (progress: number) => void,
  ): Promise<LanguageModel> {
    return this.sessionManager.createSessionWithProgress(onDownloadProgress);
  }

  /**
   * Generates a streaming text response using the browser's built-in Prompt API
   * @param options
   * @returns Promise resolving to a readable stream of text chunks and request metadata
   * @throws {LoadSettingError} When the Prompt API is not available or model needs to be downloaded
   * @throws {UnsupportedFunctionalityError} When unsupported features like file input are used
   */
  public async doStream(options: LanguageModelV2CallOptions) {
    const converted = this.getArgs(options);
    const {
      systemMessage,
      messages,
      warnings,
      promptOptions,
      expectedInputs,
      functionTools,
      debugToolCalls,
    } = converted;

    const session = await this.getSession(
      undefined,
      expectedInputs,
      undefined,
    );

    const parallelToolExecutionOption = shouldExecuteToolsInParallel(
      options,
      this.config.options.parallelToolExecution,
    );

    // Build system prompt with JSON tool calling
    const systemPrompt = await buildJsonToolSystemPrompt(systemMessage, functionTools, {
      allowParallelToolCalls: parallelToolExecutionOption,
    });
    const promptMessages = prependSystemPromptToMessages(messages, systemPrompt);

    // Pass abort signal to the native streaming method
    const streamOptions = {
      ...promptOptions,
      signal: options.abortSignal,
    };
    const conversationHistory = [...promptMessages];
    const textId = "text-0";

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      start: async (controller) => {
        controller.enqueue({
          type: "stream-start",
          warnings,
        });

        let textStarted = false;
        let finished = false;
        let aborted = false;
        let currentReader: ReadableStreamDefaultReader<string> | null = null;

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

        const finishStream = (finishReason: LanguageModelV2FinishReason) => {
          if (finished) return;
          finished = true;
          emitTextEndIfNeeded();
          controller.enqueue({
            type: "finish",
            finishReason,
            usage: {
              inputTokens: session.inputUsage,
              outputTokens: undefined,
              totalTokens: undefined,
            },
          });
          controller.close();
        };

        const abortHandler = () => {
          if (aborted) {
            return;
          }
          aborted = true;
          if (currentReader) {
            currentReader.cancel().catch(() => undefined);
          }
          finishStream("stop");
        };

        if (options.abortSignal) {
          options.abortSignal.addEventListener("abort", abortHandler);
        }

        const maxIterations = 10;
        let iteration = 0;

        try {
          // Use ToolCallFenceDetector for real-time streaming
          const fenceDetector = new ToolCallFenceDetector();

          while (iteration < maxIterations && !aborted && !finished) {
            iteration += 1;

            const promptStream = session.promptStreaming(
              conversationHistory,
              streamOptions,
            );
            currentReader = promptStream.getReader();

            let toolCalls: ParsedToolCall[] = [];
            let toolBlockDetected = false;
            let trailingTextAfterBlock = "";

            // Streaming tool call state
            let currentToolCallId: string | null = null;
            let toolInputStartEmitted = false;
            let accumulatedFenceContent = "";
            let streamedArgumentsLength = 0;
            let insideFence = false;

            while (!aborted) {
              const { done, value } = await currentReader.read();
              if (done) {
                break;
              }

              // Add chunk to detector
              fenceDetector.addChunk(value);

              // Process buffer using streaming detection
              while (fenceDetector.hasContent()) {
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
                    const argsContent = extractArgumentsContent(accumulatedFenceContent);
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
                  const selectedToolCalls = parallelToolExecutionOption
                    ? parsedToolCalls
                    : parsedToolCalls.slice(0, 1);

                  if (selectedToolCalls.length === 0) {
                    if (debugToolCalls) {
                      console.debug(
                        "[BuiltInAI] No tool calls parsed; emitting fence as text",
                      );
                    }

                    toolCalls = [];
                    toolBlockDetected = false;
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

                  if (
                    debugToolCalls &&
                    !parallelToolExecutionOption &&
                    parsedToolCalls.length > 1
                  ) {
                    console.debug(
                      "[BuiltInAI] Parallel execution disabled, emitting first call only",
                    );
                  }

                  if (selectedToolCalls.length > 0 && currentToolCallId) {
                    selectedToolCalls[0].toolCallId = currentToolCallId;
                  }

                  toolCalls = selectedToolCalls;
                  toolBlockDetected = toolCalls.length > 0;

                  if (debugToolCalls && toolCalls.length > 0) {
                    console.debug("[BuiltInAI] Tool calls parsed:", toolCalls.length);
                  }

                  for (const [index, call] of toolCalls.entries()) {
                    const toolCallId =
                      index === 0 && currentToolCallId ? currentToolCallId : call.toolCallId;
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

                        if (debugToolCalls) {
                          console.debug(`[BuiltInAI] Tool call started: ${toolName}`);
                        }
                      }

                      const argsContent = extractArgumentsContent(accumulatedFenceContent);
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

                  trailingTextAfterBlock += result.textAfterFence;
                  madeProgress = true;

                  if (toolBlockDetected && currentReader) {
                    await currentReader.cancel().catch(() => undefined);
                    break;
                  }

                  currentToolCallId = null;
                  toolInputStartEmitted = false;
                  accumulatedFenceContent = "";
                  streamedArgumentsLength = 0;
                  insideFence = false;
                  continue;
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

                      if (debugToolCalls) {
                        console.debug(`[BuiltInAI] Tool call started: ${toolName}`);
                      }
                    }

                    if (toolInputStartEmitted && currentToolCallId) {
                      const argsContent = extractArgumentsContent(accumulatedFenceContent);
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

              if (toolBlockDetected) {
                break;
              }
            }
            currentReader = null;

            if (aborted) {
              return;
            }

            // Emit any remaining buffer content if no tool was detected
            if (!toolBlockDetected && fenceDetector.hasContent()) {
              emitTextDelta(fenceDetector.getBuffer());
              fenceDetector.clearBuffer();
            }

            if (!toolBlockDetected || toolCalls.length === 0) {
              finishStream("stop");
              return;
            }

            if (trailingTextAfterBlock) {
              emitTextDelta(trailingTextAfterBlock);
            }

            finishStream("tool-calls");
            return;
          }

          if (!finished && !aborted) {
            finishStream("other");
          }
        } catch (error) {
          if (debugToolCalls) {
            console.debug("[BuiltInAI] Streaming error:", error);
          }
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
      request: { body: { messages: promptMessages, options: promptOptions } },
    };
  }
}
