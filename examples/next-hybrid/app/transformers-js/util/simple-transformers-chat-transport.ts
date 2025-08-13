import {
  ChatTransport,
  UIMessageChunk,
  streamText,
  convertToModelMessages,
  ChatRequestOptions,
} from "ai";
import {
  TransformersJSLanguageModel,
  TransformersUIMessage,
} from "@built-in-ai/transformers-js";

export class SimpleTransformersChatTransport
  implements ChatTransport<TransformersUIMessage>
{
  private readonly model: TransformersJSLanguageModel;

  constructor(model: TransformersJSLanguageModel) {
    this.model = model;
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

    const result = streamText({
      model,
      messages: prompt,
      abortSignal: abortSignal,
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
