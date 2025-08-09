import {
  ChatTransport,
  UIMessage,
  UIMessageChunk,
  streamText,
  convertToModelMessages,
  ChatRequestOptions,
} from "ai";
import { builtInAI } from "@built-in-ai/core";

// This class won't stream back data parts with the download progress if
// the Prompt API model hasn't yet been downloaded
export class SimpleClientSideChatTransport implements ChatTransport<UIMessage> {
  async sendMessages(
    options: {
      chatId: string;
      messages: UIMessage[];
      abortSignal: AbortSignal | undefined;
    } & {
      trigger: "submit-message" | "submit-tool-result" | "regenerate-message";
      messageId: string | undefined;
    } & ChatRequestOptions,
  ): Promise<ReadableStream<UIMessageChunk>> {
    const prompt = convertToModelMessages(options.messages);

    const result = streamText({
      model: builtInAI(),
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
    // AFAIK: Client-side AI doesn't support stream reconnection
    return null;
  }
}
