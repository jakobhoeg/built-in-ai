import {
  ChatTransport,
  UIMessage,
  UIMessageChunk,
  streamText,
  convertToModelMessages,
  ChatRequestOptions,
} from "ai";
import type { InitProgressReport } from "@mlc-ai/web-llm";
import { webLLM } from "@built-in-ai/web-llm";

export interface ProgressCallback {
  (progress: { progress: number; timeElapsed: number; text: string }): void;
}

export class WebWorkerChatTransport implements ChatTransport<UIMessage> {
  private progressCallback?: ProgressCallback;
  private model: ReturnType<typeof webLLM>;

  constructor(options?: { progressCallback?: ProgressCallback }) {
    this.progressCallback = options?.progressCallback;

    // Create the Web Worker model instance once and reuse it
    this.model = webLLM("Qwen3-0.6B-q0f16-MLC", {
      initProgressCallback: this.progressCallback
        ? (report: InitProgressReport) => {
            this.progressCallback!({
              progress: report.progress,
              timeElapsed: report.timeElapsed,
              text: report.text,
            });
          }
        : undefined,
    });
  }

  async sendMessages(
    options: {
      chatId: string;
      messages: UIMessage[];
      abortSignal: AbortSignal | undefined;
    } & {
      trigger:
        | "submit-user-message"
        | "submit-tool-result"
        | "regenerate-assistant-message";
      messageId: string | undefined;
    } & ChatRequestOptions,
  ): Promise<ReadableStream<UIMessageChunk>> {
    const prompt = convertToModelMessages(options.messages);

    const result = streamText({
      model: this.model, // Use the webLLM model
      messages: prompt,
      abortSignal: options.abortSignal,
    });

    return result.toUIMessageStream();
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
