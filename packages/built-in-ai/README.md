# Built-in AI provider for Vercel AI SDK

<img src="../../npm-header.png">

A TypeScript library that provides access to browser-based AI capabilities with seamless fallback to using server-side models using the [Vercel AI SDK](https://ai-sdk.dev/). This library enables you to leverage **Chrome** and **Edge's** built-in AI features ([Prompt API](https://github.com/webmachinelearning/prompt-api)) while also easily switching models.

Vercel AI SDK v5 introduces [custom Transport support](https://v5.ai-sdk.dev/docs/announcing-ai-sdk-5-beta#enhanced-usechat-architecture) for the `useChat()` hook, which has been the _missing piece_ needed to fully integrate browser-based Prompt API capabilities with the Vercel AI SDK.

> [!IMPORTANT]
> This package is under constant development as the Prompt API matures, and may contain errors and incompatible changes.

## Installation

> [!NOTE]
> This only works with the new v5 soon to release (beta) of the Vercel AI SDK.

```bash
npm install built-in-ai
```

## Browser Requirements

> [!IMPORTANT]
> The Prompt API is currently experimental and might change as it matures. The below enablement guide of the API might also change in the future.

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
import { streamText } from "ai";
import { builtInAI } from "built-in-ai";

const result = streamText({
  model: builtInAI(),
  messages: [{ role: "user", content: "Hello, how are you?" }],
});

for await (const chunk of result.textStream) {
  console.log(chunk);
}
```

### Text Embeddings

```typescript
import { embed } from "ai";
import { builtInAI } from "built-in-ai";

const result = await embed({
  model: builtInAI("embedding"),
  value: "Hello, world!",
});

console.log(result.embedding); // [0.1, 0.2, 0.3, ...]
```

## Hybrid example

For the full implementation look here: [`/examples/next-hybrid`](/examples/next-hybrid/)

Since the Built-in AI is a client-side API, it cannot be used in traditional API routes in Next.js. Instead, we need to create a custom class that implements the `ChatTransport` interface.

Because the Prompt API is not yet widely available across all browsers, the implementation below includes a fallback mechanism that uses a server-side API route when browser AI is unavailable. This is optional, but enhances the user experience.

```typescript:client-side-chat-transport.ts
import {
  ChatTransport,
  UIMessage,
  UIMessageChunk,
  streamText,
  convertToModelMessages,
  ChatRequestOptions,
} from 'ai';
import { builtInAI, BuiltInAIChatLanguageModel } from 'built-in-ai';

export class ClientSideChatTransport implements ChatTransport<UIMessage> {
  async sendMessages(options: {
    chatId: string;
    messages: UIMessage[];
    abortSignal: AbortSignal | undefined;
  } & {
    trigger: 'submit-user-message' | 'submit-tool-result' | 'regenerate-assistant-message';
    messageId: string | undefined;
  } & ChatRequestOptions): Promise<ReadableStream<UIMessageChunk>> {
    const prompt = convertToModelMessages(options.messages);

    const result = streamText({
      model: builtInAI(),
      messages: prompt,
      abortSignal: options.abortSignal,
    });

    return result.toUIMessageStream();
  }

  async reconnectToStream(options: {
    chatId: string;
  } & ChatRequestOptions): Promise<ReadableStream<UIMessageChunk> | null> {
    return null;
  }
}
```

### Vercel AI SDK `useChat` hook implementation

We can then provide the `useChat` hook with our `ClientSideChatTransport` AND provide a fallback server-side implementation (`DefaultChatTransport`) that uses an api route:

```typescript:page.tsx
'use client'

import { useChat } from 'ai/react';
import { isBuiltInAIModelAvailable } from 'built-in-ai';

const isBuiltInAIAvailable = isBuiltInAIModelAvailable();

export default function Chat() {
  const { error, status, sendMessage, messages, regenerate, stop } = useChat({
    transport: isBuiltInAIAvailable ? new ClientSideChatTransport() : new DefaultChatTransport<UIMessage>({
      api: '/api/chat',
    }),
  });

  return (
    <div>
      // See examples/next-hybrid for complete UI implementation
    </div>
  );
}
```

## API Reference

### `builtInAI(modelId?, settings?)`

Creates a browser AI model instance for chat or embeddings.

**Chat Models:**

- `modelId` (optional): The model identifier, defaults to 'text'
- `settings` (optional): Configuration options for the chat model
  - `temperature?: number` - Controls randomness (0-1)
  - `topK?: number` - Limits vocabulary selection

**Returns:** `BuiltInAIChatLanguageModel` instance

**For Embedding Models:**

- `modelId`: Must be 'embedding'
- `settings` (optional): Configuration options for the embedding model
  - `wasmLoaderPath?: string` - Path to WASM loader (default: CDN hosted)
  - `wasmBinaryPath?: string` - Path to WASM binary (default: CDN hosted)
  - `modelAssetPath?: string` - Path to model asset file (default: CDN hosted)
  - `l2Normalize?: boolean` - Whether to normalize with L2 norm (default: false)
  - `quantize?: boolean` - Whether to quantize embeddings to bytes (default: false)
  - `delegate?: 'CPU' | 'GPU'` - Backend to use for inference

**Returns:** `BuiltInAIEmbeddingModel` instance

### `isBuiltInAIModelAvailable(): boolean`

Standalone function that checks if browser AI is available.
