import {
  ChatTransport,
  UIMessageChunk,
  streamText,
  convertToModelMessages,
  ChatRequestOptions,
  createUIMessageStream,
  wrapLanguageModel,
  extractReasoningMiddleware,
  tool,
  stepCountIs,
} from "ai";
import {
  TransformersJSLanguageModel,
  TransformersUIMessage,
} from "@built-in-ai/transformers-js";
import z from "zod";

export const createTools = () => ({
  webSearch: tool({
    description:
      "Search the web for information when you need up-to-date information or facts not in your knowledge base. Use this when the user asks about current events, recent developments, or specific factual information you're unsure about.",
    inputSchema: z.object({
      query: z
        .string()
        .describe("The search query to find information on the web"),
    }),
    execute: async ({ query }) => {
      try {
        // Call the API route instead of Exa directly
        const response = await fetch("/api/web-search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          return errorData.error || "Failed to search the web";
        }

        const result = await response.json();
        return result;
      } catch (err) {
        return `Failed to search the web: ${err instanceof Error ? err.message : "Unknown error"}`;
      }
    },
  }),
  getCurrentTime: tool({
    description:
      "Get the current date and time. Use this when the user asks about the current time, date, or day of the week.",
    inputSchema: z.object({}),
    execute: async () => {
      const now = new Date();
      return {
        timestamp: now.toISOString(),
        date: now.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        time: now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    },
  }),
});

/**
 * Client-side chat transport AI SDK implementation that handles AI model communication
 * with in-browser AI capabilities.
 *
 * @implements {ChatTransport<TransformersUIMessage>}
 */
export class TransformersChatTransport
  implements ChatTransport<TransformersUIMessage>
{
  private readonly model: TransformersJSLanguageModel;
  private tools: ReturnType<typeof createTools>;

  constructor(model: TransformersJSLanguageModel) {
    this.model = model;
    this.tools = createTools();
  }

  async sendMessages(
    options: {
      chatId: string;
      messages: TransformersUIMessage[];
      abortSignal: AbortSignal | undefined;
    } & {
      trigger: "submit-message" | "submit-tool-result" | "regenerate-message";
      messageId: string | undefined;
    } & ChatRequestOptions,
  ): Promise<ReadableStream<UIMessageChunk>> {
    const { chatId, messages, abortSignal, trigger, messageId, ...rest } =
      options;

    const prompt = convertToModelMessages(messages);
    const model = this.model;

    // Check if model is already available to skip progress tracking
    const availability = await model.availability();
    if (availability === "available") {
      const result = streamText({
        model: wrapLanguageModel({
          model,
          middleware: extractReasoningMiddleware({
            tagName: "think",
          }),
        }),
        tools: this.tools,
        stopWhen: stepCountIs(5),
        messages: prompt,
        abortSignal: abortSignal,
      });
      return result.toUIMessageStream();
    }

    // Handle model download with progress tracking
    return createUIMessageStream<TransformersUIMessage>({
      execute: async ({ writer }) => {
        try {
          let downloadProgressId: string | undefined;

          // Download/prepare model with progress monitoring
          await model.createSessionWithProgress(
            (progress: { progress: number }) => {
              const percent = Math.round(progress.progress * 100);

              if (progress.progress >= 1) {
                // Download complete
                if (downloadProgressId) {
                  writer.write({
                    type: "data-modelDownloadProgress",
                    id: downloadProgressId,
                    data: {
                      status: "complete",
                      progress: 100,
                      message:
                        "Model finished downloading! Getting ready for inference...",
                    },
                  });
                }
                return;
              }

              // First progress update
              if (!downloadProgressId) {
                downloadProgressId = `download-${Date.now()}`;
                writer.write({
                  type: "data-modelDownloadProgress",
                  id: downloadProgressId,
                  data: {
                    status: "downloading",
                    progress: percent,
                    message: "Downloading browser AI model...",
                  },
                  transient: true,
                });
                return;
              }

              // Ongoing progress updates
              writer.write({
                type: "data-modelDownloadProgress",
                id: downloadProgressId,
                data: {
                  status: "downloading",
                  progress: percent,
                  message: `Downloading browser AI model... ${percent}%`,
                },
              });
            },
          );

          // Stream the actual text response
          const result = streamText({
            model: wrapLanguageModel({
              model,
              middleware: extractReasoningMiddleware({
                tagName: "think",
              }),
            }),
            tools: this.tools,
            stopWhen: stepCountIs(5),
            messages: prompt,
            abortSignal: abortSignal,
            onChunk(event) {
              // Clear progress message on first text chunk
              if (event.chunk.type === "text-delta" && downloadProgressId) {
                writer.write({
                  type: "data-modelDownloadProgress",
                  id: downloadProgressId,
                  data: { status: "complete", progress: 100, message: "" },
                });
                downloadProgressId = undefined;
              }
            },
          });

          writer.merge(result.toUIMessageStream({ sendStart: false }));
        } catch (error) {
          writer.write({
            type: "data-notification",
            data: {
              message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
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
    // Client-side AI doesn't support stream reconnection
    return null;
  }
}
