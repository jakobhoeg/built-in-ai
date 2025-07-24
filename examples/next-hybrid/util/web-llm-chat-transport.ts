import {
  ChatTransport,
  UIMessageChunk,
  streamText,
  convertToModelMessages,
  ChatRequestOptions,
  createUIMessageStream,
} from "ai";
import { webLLM } from "@built-in-ai/web-llm";
import { BuiltInAIUIMessage } from "@built-in-ai/core";
import type { InitProgressReport } from "@mlc-ai/web-llm";

/**
 * WebLLM chat transport AI SDK implementation that handles AI model communication
 * with WebLLM capabilities.
 *
 * @implements {ChatTransport<BuiltInAIUIMessage>}
 */
export class WebLLMChatTransport implements ChatTransport<BuiltInAIUIMessage> {
  private modelId: string;
  private model: ReturnType<typeof webLLM>;

  constructor(modelId: string = "Qwen3-0.6B-q0f16-MLC") {
    this.modelId = modelId;
    // Create the model instance once and reuse it
    this.model = webLLM(this.modelId);
  }

  async sendMessages(
    options: {
      chatId: string;
      messages: BuiltInAIUIMessage[];
      abortSignal: AbortSignal | undefined;
    } & {
      trigger:
        | "submit-user-message"
        | "submit-tool-result"
        | "regenerate-assistant-message";
      messageId: string | undefined;
    } & ChatRequestOptions,
  ): Promise<ReadableStream<UIMessageChunk>> {
    const { chatId, messages, abortSignal, trigger, messageId, ...rest } =
      options;

    const prompt = convertToModelMessages(messages);

    // Check if model is already available to skip progress tracking
    const availability = await this.model.availability();
    if (availability === "available") {
      const result = streamText({
        model: this.model,
        messages: prompt,
        abortSignal: abortSignal,
      });
      return result.toUIMessageStream();
    }

    // Handle model download with progress tracking
    return createUIMessageStream<BuiltInAIUIMessage>({
      execute: async ({ writer }) => {
        try {
          let downloadProgressId: string | undefined;

          // Only initialize on first call with progress tracking
          await this.model.createSessionWithProgress(
            (progress: InitProgressReport) => {
              const percent = Math.round((progress.progress || 0) * 100);

              // Handle completion
              if (percent >= 100) {
                if (downloadProgressId) {
                  writer.write({
                    type: "data-modelDownloadProgress",
                    id: downloadProgressId,
                    data: {
                      status: "complete",
                      progress: 100,
                      message: "Model loaded! Ready for inference...",
                    },
                  });
                }
                return;
              }

              // Handle in-progress state
              if (!downloadProgressId) {
                downloadProgressId = `webllm-download-${Date.now()}`;
                writer.write({
                  type: "data-modelDownloadProgress",
                  id: downloadProgressId,
                  data: {
                    status: "downloading",
                    progress: percent,
                    message: "Downloading WebLLM model...",
                  },
                  transient: true,
                });
                return;
              }

              writer.write({
                type: "data-modelDownloadProgress",
                id: downloadProgressId,
                data: {
                  status: "downloading",
                  progress: percent,
                  message: `Loading WebLLM model... ${percent}%`,
                },
              });
            },
          );
          // For subsequent calls, the model is already ready - no need to create session again

          // Now stream the actual text response
          const result = streamText({
            model: this.model,
            messages: prompt,
            abortSignal: abortSignal,
            onChunk(event) {
              // On first chunk, clear the download progress message
              if (event.chunk.type === "text" && downloadProgressId) {
                writer.write({
                  type: "data-modelDownloadProgress",
                  id: downloadProgressId,
                  data: {
                    status: "complete",
                    progress: 100,
                    message: "", // Clear the message
                  },
                });
                downloadProgressId = undefined;
              }
            },
          });

          writer.merge(
            result.toUIMessageStream({
              sendStart: false, // Don't start a new message, add to existing message
            }),
          );
        } catch (error) {
          // Handle download or generation errors
          writer.write({
            type: "data-notification",
            data: {
              message: `WebLLM Error: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
              level: "error",
            },
            transient: true,
          });

          throw error;
        }
      },
    });
  }

  async reconnectToStream(
    options: {
      chatId: string;
    } & ChatRequestOptions,
  ): Promise<ReadableStream<UIMessageChunk> | null> {
    // WebLLM doesn't support stream reconnection
    return null;
  }
}
