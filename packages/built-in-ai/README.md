
# Built-in AI provider for Vercel AI SDK
<img src="../../npm-header.png">

A TypeScript library that provides access to browser-based AI capabilities with seamless fallback to server-side models using the Vercel AI SDK. This library enables you to leverage **Chrome** and **Edge's** built-in AI features (Prompt API) while also easily switching models.

## Why This Package?

While there is an [existing package](https://github.com/jeasonstudio/chrome-ai) that attempted to provide similar functionality, it has been inactive for the past year with no maintenance or updates.

This package was created to provide a reliable, actively maintained solution for integrating browser-based AI capabilities with modern web applications, ensuring ongoing support and compatibility with the latest browser AI features.

Vercel AI SDK v5 introduces [custom Transport support](https://v5.ai-sdk.dev/docs/announcing-ai-sdk-5-beta#enhanced-usechat-architecture) for the `useChat()` hook, providing the *missing piece* needed to fully integrate browser-based Prompt API capabilities with the Vercel AI SDK.

## Installation

> [!NOTE]
> This only works with v5 of the Vercel AI SDK. Make sure your project is migrated to use this package.

```bash
npm install built-in-ai
```

## Browser Requirements

1. You need Chrome (v. 128 or higher) or Edge Dev/Canary (v. 138.0.3309.2 or higher)

2. Enable these experimental flags:
    - If you're using Chrome:
      1. Go to chrome://flags/#prompt-api-for-gemini-nano and set it to Enabled
      2. Go to chrome://flags/#optimization-guide-on-device-model and set it to Enabled BypassPrefRequirement
      3. Go to chrome://components and click Check for Update on Optimization Guide On Device Model
    - If you're using Edge:
      1. Go to edge://flags/#prompt-api-for-phi-mini and set it to Enabled

For more information, check out [this guide](https://developer.chrome.com/docs/extensions/ai/prompt-api)

## Basic Usage

### Simple Chat

```typescript
import { streamText } from 'ai';
import { builtInAI } from 'built-in-ai';

const result = streamText({
  model: builtInAI(),
  messages: [
    { role: 'user', content: 'Hello, how are you?' }
  ],
});

for await (const chunk of result.textStream) {
  console.log(chunk);
}
```

## Hybrid Chat Transport

For the full implementation, check this out: [`/examples/next-hybrid`](/examples/next-hybrid/)

Since the Built-in AI is a client-side API, it cannot be used in traditional API routes in Next.js. Instead, we need to create a custom class that implements the `ChatTransport` interface.

Because the Prompt API is not yet widely available across all browsers, this implementation includes a fallback mechanism that uses a server-side API route when browser AI is unavailable. 

```typescript

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
```

### Vercel AI SDK `useChat` hook implementation

We can then use your `HybridChatTransport` in the `useChat` hook:

```typescript
import { useChat } from 'ai/react';
import { builtInAI, BuiltInAIChatLanguageModel } from 'built-in-ai';

function ChatComponent() {
  const { error, status, sendMessage, messages, regenerate, stop } = useChat({
    transport: new HybridChatTransport(), // Import custom Transport impl. - don't use api route
  });

  return (
    <div>
      // See examples/next-hybrid for complete UI implementation
    </div>
  );
}
```

## API Reference

### `builtInAI(options?)`

Creates a browser AI language model instance.

**Parameters:**
- `options` (optional): Configuration options for the model
  - `temperature?: number` - Controls randomness (0-1)
  - `topK?: number` - Limits vocabulary selection

**Returns:** `BuiltInAIChatLanguageModel` instance

### `BuiltInAIChatLanguageModel`

The main language model class that implements the AI SDK's `LanguageModelV2` interface.

#### Static Methods

- `isAvailable(): boolean` - Checks if browser AI is available

#### Instance Methods

- `doGenerate(options)` - Generate a single response
- `doStream(options)` - Generate a streaming response

### Error Handling

The library provides specific error types for better error handling:

- `LoadSettingError` - Thrown when there are issues with model loading
- `UnsupportedFunctionalityError` - Thrown when using unsupported features

## Supported Features

### Supported
- Text generation
- Streaming responses
- Temperature control
- TopK sampling
- Response format constraints (JSON)
- Abort signals

### Needs to be implemented
- Tool calling
- File inputs
- Token counting
- Custom stop sequences
- Presence/frequency penalties

## Contributing

Contributions are more than welcome!