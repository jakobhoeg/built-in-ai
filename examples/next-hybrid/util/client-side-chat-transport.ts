import {
  ChatTransport,
  UIMessage,
  UIMessageChunk,
  streamText,
  convertToModelMessages,
  ChatRequestOptions,
} from "ai";
import { builtInAI, BuiltInAIChatLanguageModel } from "@built-in-ai/core";

export class ClientSideChatTransport implements ChatTransport<UIMessage> {
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
