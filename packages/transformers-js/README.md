# Transformers.js provider for Vercel AI SDK

<div align="center">

[![NPM Version](https://img.shields.io/npm/v/%40built-in-ai%2Ftransformers-js)](https://www.npmjs.com/package/@built-in-ai/transformers-js)
[![NPM Downloads](https://img.shields.io/npm/dw/%40built-in-ai%2Ftransformers-js)](https://www.npmjs.com/package/@built-in-ai/transformers-js)

> [!NOTE]
> This library is in active development. Expect frequent updates.

</div>

[Transformers.js](https://github.com/xenova/transformers.js) provider for the [Vercel AI SDK](https://ai-sdk.dev/). Run popular open-source 🤗 Transformers models directly in the browser with optional WebGPU acceleration.

## Installation

```bash
npm i @built-in-ai/transformers-js
```

The `@built-in-ai/transformers-js` package is the AI SDK provider for browser-based Transformers models powered by the official `@huggingface/transformers` Web runtime.

## Browser Requirements

- A modern browser is required. WebGPU is strongly recommended for good performance, but CPU fallback works for many smaller models (slower).
- For WebGPU info, see the MDN page: https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API

## Usage

### Basic Usage (Text)

```typescript
import { streamText } from "ai";
import { transformersJS } from "@built-in-ai/transformers-js";

const result = streamText({
  // or generateText
  model: transformersJS("HuggingFaceTB/SmolLM2-360M-Instruct"),
  messages: [{ role: "user", content: "Hello, how are you?" }],
});

for await (const chunk of result.textStream) {
  console.log(chunk);
}
```

### Vision Models

```typescript
import { streamText } from "ai";
import { transformersJS } from "@built-in-ai/transformers-js";

const model = transformersJS("HuggingFaceTB/SmolVLM-256M-Instruct", {
  isVisionModel: true,
  device: "webgpu", // recommended
});

const result = streamText({
  model,
  messages: [{
    role: "user",
    content: [
      { type: "text", text: "Describe this image" },
      { type: "image", image: someImageBlobOrUrl },
    ],
  }],
});
```

### Advanced Usage (Web Worker)

Heavy model execution should run off the main thread using Web Workers. This package ships a ready-to-use handler, which removes complexity and allows you to just build your app.

1) Create `worker.ts`:

```ts
import { TransformersJSWorkerHandler } from "@built-in-ai/transformers-js";

const handler = new TransformersJSWorkerHandler();
self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};
```

2) Provide the worker when creating the model:

```ts
import { streamText } from "ai";
import { transformersJS } from "@built-in-ai/transformers-js";

const model = transformersJS("HuggingFaceTB/SmolLM2-360M-Instruct", {
  worker: new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }),
  device: "webgpu",
});

const result = streamText({
  model,
  messages: [{ role: "user", content: "Explain Web Workers briefly." }],
});

for await (const chunk of result.textStream) {
  console.log(chunk);
}
```

## Download/Load Progress Tracking

When a model is first used, weights and tokenizer files must be loaded. Progress is handled internally and streamed back.

### Basic Progress Monitoring

```ts
import { streamText } from "ai";
import { transformersJS } from "@built-in-ai/transformers-js";

const model = transformersJS("HuggingFaceTB/SmolLM2-360M-Instruct");
const availability = await model.availability();

if (availability === "unavailable") {
  console.log("Browser doesn't support this runtime");
  return;
}

if (availability === "downloadable") {
  await model.createSessionWithProgress(({ progress }) => {
    console.log(`Download progress: ${Math.round(progress * 100)}%`);
  });
}

// Ready to use
const result = streamText({
  model,
  messages: [{ role: "user", content: "Hello!" }],
});
```

## Embeddings

This package also supports in-browser embeddings via Transformers.js.

```ts
import { embed } from "ai";
import { transformersJS } from "@built-in-ai/transformers-js";

const embeddingModel = transformersJS(
  "Xenova/all-MiniLM-L6-v2",
  { type: "embedding", device: "webgpu" }
);

const { embeddings } = await embed({
  model: embeddingModel,
  values: ["first", "second"],
});
```

## Integration with useChat Hook

When using this library with the `useChat` hook, create a [custom transport](https://v5.ai-sdk.dev/docs/ai-sdk-ui/transport#transport) to support client-side AI and download progress.

You can import `TransformersUIMessage` which extends `UIMessage` to include [data parts](https://v5.ai-sdk.dev/docs/ai-sdk-ui/streaming-data) for progress and notifications.

See the complete working example: `examples/next-hybrid/app/transformers-js/util/transformers-chat-transport.ts` and the page component at `examples/next-hybrid/app/transformers-js/page.tsx`.

This example includes:

- Download progress with UI updates
- Hybrid client/server architecture with fallback
- Error handling and notifications
- Full integration with `useChat`

## API Reference

### `transformersJS(modelId, settings?)`

Creates a Transformers.js language model instance.

Parameters:

- `modelId`: A Hugging Face model ID (e.g. `"HuggingFaceTB/SmolLM2-360M-Instruct"`, `"onnx-community/Llama-3.2-1B-Instruct-q4f16"`).
- `settings` (optional):
  - `device?: "cpu" | "webgpu"` – inference device
  - `dtype?: "auto" | "fp32" | "fp16" | "q8" | "q4" | "q4f16"` – precision/quantization
  - `isVisionModel?: boolean` – enable VLM pipeline
  - `initProgressCallback?: (p: { progress: number }) => void` – aggregated progress callback
  - `rawInitProgressCallback?: (p: ProgressInfo) => void` – raw file-level progress from Transformers.js
  - `worker?: Worker` – run on a Web Worker for better UX/perf

Returns: `TransformersJSLanguageModel`

### `transformersJS(modelId, { type: 'embedding', ...settings })`

Creates a Transformers.js embedding model instance.

Embedding settings:

- `device?: "cpu" | "webgpu"`
- `dtype?: "fp32" | "fp16" | "q8" | "q4" | "q4f16"`
- `normalize?: boolean` (default: true)
- `pooling?: "mean" | "cls" | "max"` (default: "mean")
- `maxTokens?: number` (default: 512)

Returns: `TransformersJSEmbeddingModel`

### `doesBrowserSupportTransformersJS(): boolean`

Quick check for runtime support in the current browser.

### `isTransformersJSEmbeddingAvailable(): boolean`

Checks if the environment is suitable for client-side embeddings (real browser context).

### `TransformersUIMessage`

Extended UI message type for use with the `useChat` hook that includes custom data parts.

Type:

```ts
type TransformersUIMessage = UIMessage<
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

### `TransformersJSLanguageModel.createSessionWithProgress(onProgress?)`

Creates/initializes a model session with optional progress monitoring.

Parameters:

- `onProgress?: (p: { progress: number }) => void`

Returns: `Promise<TransformersJSLanguageModel>`

### `TransformersJSLanguageModel.availability()`

Checks current availability status.

Returns: `Promise<"unavailable" | "downloadable" | "available">`

### `TransformersJSWorkerHandler`

Utility handler for Web Worker usage. Attach it to the worker `onmessage` to handle `load`, `generate`, `interrupt`, and `reset` messages.

```ts
import { TransformersJSWorkerHandler } from "@built-in-ai/transformers-js";

const handler = new TransformersJSWorkerHandler();
self.onmessage = (msg: MessageEvent) => handler.onmessage(msg);
```

## Author

2025 © Jakob Hoeg Mørk

## Credits

The Hugging Face, Transformers.js, and Vercel AI SDK teams


