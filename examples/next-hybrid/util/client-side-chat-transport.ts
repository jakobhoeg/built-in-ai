import {
  ChatTransport,
  UIMessage,
  UIMessageChunk,
  streamText,
  generateText,
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

    // Load the npm-header.png image from the root directory
    const imageResponse = await fetch('https://hips.hearstapps.com/hmg-prod/images/ginger-maine-coon-kitten-running-on-lawn-in-royalty-free-image-1719608142.jpg?crop=1xw:0.84415xh;0,0.185xh&resize=1200:*');
    const imageBlob = await imageResponse.blob();
    const imageArrayBuffer = await imageBlob.arrayBuffer();
    const imageUint8Array = new Uint8Array(imageArrayBuffer);

    // Create a test message with image and text to demonstrate multimodal capabilities
    const testMessages = [
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: 'Please describe this image in detail.' },
          {
            type: 'file' as const,
            mediaType: 'image/png',
            data: imageUint8Array,
          },
        ],
      },
    ];

    // Continue with the regular streaming for the actual chat
    const result = streamText({
      model: builtInAI(),
      messages: testMessages,
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
