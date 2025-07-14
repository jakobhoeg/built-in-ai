
import {
  ChatTransport,
  UIMessage,
  UIMessageChunk,
  streamText,
  convertToModelMessages,
  DefaultChatTransport,
} from 'ai';
import { builtInAI, BuiltInAIChatLanguageModel } from 'built-in-ai';

export class HybridChatTransport implements ChatTransport<UIMessage> {
  private serverTransport: DefaultChatTransport<UIMessage>;

  constructor(serverApiEndpoint: string = '/api/chat') {
    this.serverTransport = new DefaultChatTransport<UIMessage>({
      api: serverApiEndpoint,
    });
  }

  async sendMessages(options: {
    chatId: string;
    messages: UIMessage[];
    abortSignal: AbortSignal | undefined;
    trigger: 'submit-user-message' | 'submit-tool-result' | 'regenerate-assistant-message';
    messageId: string | undefined;
  }): Promise<ReadableStream<UIMessageChunk>> {

    // Check Browser AI availability
    if (!BuiltInAIChatLanguageModel.isAvailable()) {
      console.log('Browser AI not available, using server fallback');
      return this.serverTransport.sendMessages(options);
    }

    try {
      // Browser AI is available, try to use it
      const prompt = convertToModelMessages(options.messages);

      const result = streamText({
        model: builtInAI(),
        messages: prompt,
        abortSignal: options.abortSignal,
      });

      return result.toUIMessageStream();
    } catch (error) {
      console.log('Browser AI failed unexpectedly, falling back to server:', error);
      return this.serverTransport.sendMessages(options);
    }
  }

  async reconnectToStream(options: {
    chatId: string;
  }): Promise<ReadableStream<UIMessageChunk> | null> {
    return this.serverTransport.reconnectToStream(options);
  }
}