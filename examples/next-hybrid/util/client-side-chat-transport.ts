import {
  ChatTransport,
  UIMessageChunk,
  streamText,
  convertToModelMessages,
  ChatRequestOptions,
  createUIMessageStream,
} from "ai";
import { builtInAI, BuiltInAIUIMessage } from "@built-in-ai/core";

const PROGRESS_MESSAGES = {
  downloading: 'Downloading browser AI model...',
  progress: (percent: number) => `Downloading browser AI model... ${percent}%`,
  complete: 'Model finished downloading! Getting ready for first time usage...',
};

/**
 * Client-side chat transport AI SDK implementation that handles AI model communication
 * with in-browser AI capabilities.
 *  
 * @implements {ChatTransport<BuiltInAIUIMessage>}
 *
 */
export class ClientSideChatTransport implements ChatTransport<BuiltInAIUIMessage> {
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
    const {
      chatId,
      messages,
      abortSignal,
      trigger,
      messageId,
      ...rest
    } = options;

    const prompt = convertToModelMessages(messages);
    const model = builtInAI();

    // Check if the model is available without downloading
    const availability = await model.availability();

    if (availability === "available") {
      // Model is already available
      // dont' track progress monitoring
      const result = streamText({
        model,
        messages: prompt,
        abortSignal: abortSignal,
      });

      return result.toUIMessageStream();
    }

    // Model needs to be downloaded - use progress monitoring approach
    const stream = createUIMessageStream<BuiltInAIUIMessage>({
      execute: async ({ writer }) => {
        try {
          // Check if model needs to be downloaded and create session with progress monitoring
          let isDownloading = false;
          let downloadProgressId: string | undefined;

          // Helper to write progress updates
          const writeProgressUpdate = (status: 'downloading' | 'complete', progress: number, message: string, transient?: boolean) => {
            writer.write({
              type: 'data-modelDownloadProgress',
              id: downloadProgressId,
              data: { status, progress, message },
              ...(transient && { transient }),
            });
          };

          // Track progress
          await model.createSessionWithProgress((progress: number) => {
            const percent = Math.round(progress * 100);

            // Handle completion early to reduce nesting
            if (progress >= 1) {
              if (downloadProgressId) {
                writeProgressUpdate('complete', 100, PROGRESS_MESSAGES.complete);
              }
              return;
            }

            // Now handle in-progress state
            if (!isDownloading) {
              isDownloading = true;
              downloadProgressId = `download-${Date.now()}`;
              writeProgressUpdate('downloading', percent, PROGRESS_MESSAGES.downloading, true);
              return;
            }

            writeProgressUpdate('downloading', percent, PROGRESS_MESSAGES.progress(percent));
          });

          // Now stream the actual text response
          const result = streamText({
            model,
            messages: prompt,
            abortSignal: abortSignal,
            onChunk(event) {
              // On first chunk, signal that actual response streaming has started
              // by clearing the message
              if (event.chunk.type === 'text' && downloadProgressId) {
                writer.write({
                  type: 'data-modelDownloadProgress',
                  id: downloadProgressId,
                  data: {
                    status: 'complete',
                    progress: 100,
                    message: '', // Clear the message
                  },
                });
                // Clear the downloadProgressId so we only send this once
                downloadProgressId = undefined;
              }
            }
          });

          writer.merge(result.toUIMessageStream({
            sendStart: false, // Don't start a new message, add to existing message
          }));

        } catch (error) {
          // Handle download or generation errors
          writer.write({
            type: 'data-notification',
            data: {
              message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              level: 'error',
            },
            transient: true,
          });

          throw error;
        }
      },
    });

    return stream;
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
