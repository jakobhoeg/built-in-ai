# Built-in AI provider for Vercel AI SDK

<div align="center">
<img src="./hero.png">
</div>

<div align="center">

[![NPM Version](https://img.shields.io/npm/v/%40built-in-ai%2Fcore)](https://www.npmjs.com/package/@built-in-ai/core)
[![NPM Downloads](https://img.shields.io/npm/dm/%40built-in-ai%2Fcore)](https://www.npmjs.com/package/@built-in-ai/core)

</div>

A TypeScript library that provides access to browser-based AI capabilities with seamless fallback to using server-side models using the [Vercel AI SDK](https://ai-sdk.dev/). This library enables you to leverage **Chrome** and **Edge's** built-in AI features ([Prompt API](https://github.com/webmachinelearning/prompt-api)) with the AI SDK.

> [!IMPORTANT]
> This package is under constant development as the Prompt API matures, and may contain errors and incompatible changes.

## Installation

```bash
npm i @built-in-ai/core
```

The `@built-in-ai/core` package is the AI SDK provider for your Chrome and Edge browser's built-in AI models. It provides seamless access to both language models and text embeddings through browser-native APIs.

## Browser Requirements

> [!IMPORTANT]
> The Prompt API is currently experimental and might change as it matures. The below enablement guide of the API might also change in the future.

1. You need Chrome (v. 128 or higher) or Edge Dev/Canary (v. 138.0.3309.2 or higher)

2. Enable these experimental flags:
   - If you're using Chrome:
     1. Go to `chrome://flags/`, search for _'Prompt API for Gemini Nano with Multimodal Input'_ and set it to Enabled
     2. Go to `chrome://components` and click Check for Update on Optimization Guide On Device Model
   - If you're using Edge:
     1. Go to `edge://flags/#prompt-api-for-phi-mini` and set it to Enabled

For more information, check out [this guide](https://developer.chrome.com/docs/extensions/ai/prompt-api)

## Usage

### Basic Usage (chat)

```typescript
import { streamText } from "ai";
import { builtInAI } from "@built-in-ai/core";

const result = streamText({
  // or generateText
  model: builtInAI(),
  messages: [{ role: "user", content: "Hello, how are you?" }],
});

for await (const chunk of result.textStream) {
  console.log(chunk);
}
```

### Language Models

```typescript
import { generateText } from "ai";
import { builtInAI } from "@built-in-ai/core";

const model = builtInAI();

const result = await generateText({
  model,
  messages: [{ role: "user", content: "Write a short poem about AI" }],
});
```

### Text Embeddings

```typescript
import { embed, embedMany } from "ai";
import { builtInAI } from "@built-in-ai/core";

// Single embedding
const result = await embed({
  model: builtInAI.textEmbedding("embedding"),
  value: "Hello, world!",
});

console.log(result.embedding); // [0.1, 0.2, 0.3, ...]

// Multiple embeddings
const results = await embedMany({
  model: builtInAI.textEmbedding("embedding"),
  values: ["Hello", "World", "AI"],
});

console.log(results.embeddings); // [[...], [...], [...]]
```

## Download Progress Tracking

When using the built-in AI models in Chrome & Edge for the first time, the model needs to be downloaded first.

You'll probably want to show download progress in your applications to improve UX.

### Basic Progress Monitoring

```typescript
import { streamText } from "ai";
import { builtInAI } from "@built-in-ai/core";

const model = builtInAI();
const availability = await model.availability();

if (availability === "unavailable") {
  console.log("Browser doesn't support built-in AI");
  return;
}

if (availability === "downloadable") {
  await model.createSessionWithProgress((progress) => {
    console.log(`Download progress: ${Math.round(progress * 100)}%`);
  });
}

// Model is ready
const result = streamText({
  model,
  messages: [{ role: "user", content: "Hello!" }],
});
```

## Integration with useChat Hook

When using this library with the `useChat` hook, you'll need to create a [custom transport](https://v5.ai-sdk.dev/docs/ai-sdk-ui/transport#transport) implementation to handle client-side AI with download progress. You can do this by importing `BuiltInAIUIMessage` from `@built-in-ai/core` that extends `UIMessage` to include [data parts](https://v5.ai-sdk.dev/docs/ai-sdk-ui/streaming-data) such as download progress.

See the complete working example: **[`/examples/next-hybrid/app/(core)/util/client-side-chat-transport.ts`](<../../examples/next-hybrid/app/(core)/util/client-side-chat-transport.ts>)** and the **[`/examples/next-hybrid/app/page.tsx`](<../../examples/next-hybrid/app/(core)/page.tsx>)** components.

This example includes:

- Download progress with UI progress bar and status message updates
- Hybrid client/server architecture with fallback
- Error handling and notifications
- Full integration with `useChat` hook

## Multimodal Support

The Prompt API supports both images and audio files:

```typescript
import { streamText } from "ai";
import { builtInAI } from "@built-in-ai/core";

const result = streamText({
  model: builtInAI(),
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "What's in this image?" },
        { type: "file", mediaType: "image/png", data: base64ImageData },
      ],
    },
    {
      role: "user",
      content: [{ type: "file", mediaType: "audio/mp3", data: audioData }],
    },
  ],
});

for await (const chunk of result.textStream) {
  console.log(chunk);
}
```

## Generating structured data

The `builtInAI` model also allows using the AI SDK `generateObject` and `streamObject`:

### streamObject

```typescript
import { streamObject } from "ai";
import { builtInAI } from "@built-in-ai/core";

const { object } = await streamObject({
  model: builtInAI(),
  schema: z.object({
    recipe: z.object({
      name: z.string(),
      ingredients: z.array(z.object({ name: z.string(), amount: z.string() })),
      steps: z.array(z.string()),
    }),
  }),
  prompt: "Generate a lasagna recipe.",
});
```

### generateObject

```typescript
const { object } = await generateObject({
  model: builtInAI(),
  schema: z.object({
    recipe: z.object({
      name: z.string(),
      ingredients: z.array(z.object({ name: z.string(), amount: z.string() })),
      steps: z.array(z.string()),
    }),
  }),
  prompt: "Generate a lasagna recipe.",
});
```

## Features

### Supported

- [x] **Text generation** (`generateText()`)
- [x] **Streaming responses** (`streamText()`)
- [x] **Download progress streaming** - Real-time progress updates during model downloads
- [x] **Multimodal functionality** (image and audio support)\*
- [x] **Temperature control**
- [x] **Response format constraints** (JSON `generateObject()/streamObject()`)
- [x] **Abort signals**

### Planned (when implemented in the Prompt API)

- [ ] **Tool calling**
- [ ] **Token counting**
- [ ] **Custom stop sequences**
- [ ] **Presence/frequency penalties**

> \*Multimodal functionality is currently only available in Chrome's Prompt API implementation

## API Reference

### `builtInAI(modelId?, settings?)`

Creates a browser AI model instance for chat or embeddings.

**For Chat Models:**

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

### `doesBrowserSupportBuiltInAI(): boolean`

Quick check if the browser supports the built-in AI API. Useful for component-level decisions and feature flags.

**Returns:** `boolean` - `true` if browser supports the Prompt API, `false` otherwise

**Example:**

```typescript
import { doesBrowserSupportBuiltInAI } from "@built-in-ai/core";

if (doesBrowserSupportBuiltInAI()) {
  // Show built-in AI option in UI
} else {
  // Show server-side option only
}
```

### `BuiltInAIUIMessage`

Extended UI message type for use with the `useChat` hook that includes custom data parts for built-in AI functionality.

**Type Definition:**

```typescript
type BuiltInAIUIMessage = UIMessage<
  never,
  {
    modelDownloadProgress: {
      status: "downloading" | "complete" | "error";
      progress?: number;
      message: string;
    };
    notification: {
      message: string;
      level: "info" | "warning" | "error";
    };
  }
>;
```

**Data Parts:**

- `modelDownloadProgress` - Tracks browser AI model download status and progress
- `notification` - Displays temporary messages and alerts to users

### `BuiltInAIChatLanguageModel.createSessionWithProgress(onDownloadProgress?)`

Creates a language model session with optional download progress monitoring.

**Parameters:**

- `onDownloadProgress?: (progress: number) => void` - Optional callback that receives progress values from 0 to 1 during model download

**Returns:** `Promise<LanguageModel>` - The configured language model session

**Example:**

```typescript
const model = builtInAI();
await model.createSessionWithProgress((progress) => {
  console.log(`Download: ${Math.round(progress * 100)}%`);
});
```

### `BuiltInAIChatLanguageModel.availability()`

Checks the current availability status of the built-in AI model.

**Returns:** `Promise<"unavailable" | "downloadable" | "downloading" | "available">`

- `"unavailable"` - Model is not supported in the browser
- `"downloadable"` - Model is supported but needs to be downloaded first
- `"downloading"` - Model is currently being downloaded
- `"available"` - Model is ready to use

## Author

2025 © Jakob Hoeg Mørk
