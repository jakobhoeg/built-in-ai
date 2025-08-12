# Transformers.js provider for Vercel AI SDK

<div align="center">

[![NPM Version](https://img.shields.io/npm/v/%40built-in-ai%2Ftransformers-js)](https://www.npmjs.com/package/@built-in-ai/transformers-js)
[![NPM Downloads](https://img.shields.io/npm/dw/%40built-in-ai%2Ftransformers-js)](https://www.npmjs.com/package/@built-in-ai/transformers-js)

> [!NOTE]
> This library is in active development. Expect frequent updates.

</div>

[Transformers.js](https://github.com/xenova/transformers.js) provider for the [Vercel AI SDK](https://ai-sdk.dev/). Run popular open-source 🤗 Transformers models directly in the browser with optional WebGPU acceleration, OR even on the server.

## Installation

```bash
npm i @built-in-ai/transformers-js
```

The `@built-in-ai/transformers-js` package is the AI SDK provider for Transformers models powered by the official `@huggingface/transformers` library. It supports both client-side (browser) and server-side (Node.js) inference.

## Requirements

### Browser (Client-side)
- A modern browser with WebAssembly/WebGPU support
- WebGPU is strongly recommended for optimal performance

### Server (Node.js)
- Node.js 18+ recommended
- Automatic CPU inference
- GPU acceleration available with appropriate hardware setup

## Usage

### Basic Usage (chat)

```typescript
import { streamText } from "ai";
import { transformersJS } from "@built-in-ai/transformers-js";

const result = streamText({ // or generateText
  model: transformersJS("HuggingFaceTB/SmolLM2-360M-Instruct"),
  messages: [{ role: "user", content: "Hello, how are you?" }],
});

for await (const chunk of result.textStream) {
  console.log(chunk);
}
```

### Server-side Inference

Although Transformers.js was originally designed to be used in the browser, it's also able to run inference on the server. This enables hybrid applications where you can seamlessly switch between client-side and server-side inference.

#### Basic Server-side Usage

```typescript
// In a Next.js API route (app/api/chat/route.ts)
import { streamText } from "ai";
import { transformersJS } from "@built-in-ai/transformers-js";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const model = transformersJS("HuggingFaceTB/SmolLM2-135M-Instruct"); // Be mindful not to pick a too large model

  const result = streamText({
    model,
    messages,
    temperature: 0.7,
  });

  return result.toUIMessageStreamResponse();
}
```

#### Hybrid Client/Server Setup

You can create applications that automatically choose between client-side and server-side inference:

```typescript
import { transformersJS, doesBrowserSupportTransformersJS } from "@built-in-ai/transformers-js";

const useClientSide = doesBrowserSupportTransformersJS();

if (useClientSide) {
  // Browser: Use WebGPU for fast client-side inference
  const model = transformersJS("HuggingFaceTB/SmolLM2-360M-Instruct", {
    device: "webgpu",
    worker: new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })
  });
} else {
  // Fallback: Use server-side API route
  // (handled by your application routing)
}
```

Look at the [Complete Hybrid Example section](#complete-hybrid-example) for more information.

### Vision Models

```typescript
import { streamText } from "ai";
import { transformersJS } from "@built-in-ai/transformers-js";

const model = transformersJS("HuggingFaceTB/SmolVLM-256M-Instruct", {
  isVisionModel: true,
  device: "webgpu",
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

Heavy model execution should preferably run off the main thread using Web Workers. 
This package ships a ready-to-use handler, which removes complexity and allows you to just build your app.

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

## Download Progress Tracking (browser)

When a model is first used, weights and tokenizer files must be loaded. Progress is handled internally and streamed back.

### Basic Progress Monitoring

```ts
import { streamText } from "ai";
import { transformersJS } from "@built-in-ai/transformers-js";

const model = transformersJS("HuggingFaceTB/SmolLM2-360M-Instruct");
const availability = await model.availability();

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
  "Xenova/all-MiniLM-L6-v2", { 
    type: "embedding", 
    device: "webgpu" 
  }
);

const { embeddings } = await embed({
  model: embeddingModel,
  values: ["first", "second"],
});
```

## Integration with useChat Hook

When using this library with the `useChat` hook, you can create hybrid applications that seamlessly switch between client-side and server-side inference.

### Client-side Integration

Create a [custom transport](https://v5.ai-sdk.dev/docs/ai-sdk-ui/transport#transport) to support client-side AI and download progress:

```typescript
import { ChatTransport, createUIMessageStream } from "ai";
import { transformersJS, TransformersUIMessage } from "@built-in-ai/transformers-js";

export class TransformersChatTransport implements ChatTransport<TransformersUIMessage> {
  private readonly model: TransformersJSLanguageModel;

  constructor(model: TransformersJSLanguageModel) {
    this.model = model;
  }

  async sendMessages(options) {
    // Handle download progress and streaming
    // See full example below
  }
}
```

### Server-side Integration

For server-side inference, use standard API routes:

```typescript
// app/api/chat/route.ts
export async function POST(req: Request) {
  const model = transformersJS("HuggingFaceTB/SmolLM2-135M-Instruct");
  const result = streamText({ model, messages });
  return result.toUIMessageStreamResponse();
}
```

### Complete Hybrid Example

See the complete working example in `examples/next-hybrid/` which includes:

- **Automatic fallback**: Client-side when supported, server-side otherwise
- **User control**: Toggle switch to choose inference location
- **Download progress**: Real-time progress tracking for model downloads
- **Error handling**: Graceful error handling and notifications
- **Full integration**: Complete integration with `useChat` hook

Files to check:
- `examples/next-hybrid/app/transformers-js/page.tsx` – Main component with hybrid logic
- `examples/next-hybrid/app/transformers-js/util/transformers-chat-transport.ts` – Client-side transport

## API Reference

### `transformersJS(modelId, settings?)`

Creates a Transformers.js language model instance.

Parameters:

- `modelId`: A Hugging Face model ID (e.g. `"HuggingFaceTB/SmolLM2-360M-Instruct"`, `"onnx-community/Llama-3.2-1B-Instruct-q4f16"`).
- `settings` (optional):
  - `device?: "auto" | "cpu" | "webgpu" | "gpu"` – Inference device
  - `dtype?: "auto" | "fp32" | "fp16" | "q8" | "q4" | "q4f16"` – Data type for model weights
  - `isVisionModel?: boolean` – Whether this is a vision model that can process images (default: false)
  - `worker?: Worker` – Optional Web Worker to run the model off the main thread (browser only)

Returns: `TransformersJSLanguageModel`

### `transformersJS(modelId, { type: 'embedding', ...settings })`

Creates a Transformers.js embedding model instance.

Embedding settings:

- `device?: "auto" | "cpu" | "webgpu"` – Inference device (same as language models)
- `dtype?: "auto" | "fp32" | "fp16" | "q8" | "q4" | "q4f16"` – Data type for model weights
- `normalize?: boolean` (default: true) – Whether to normalize embeddings
- `pooling?: "mean" | "cls" | "max"` (default: "mean") – Pooling strategy
- `maxTokens?: number` (default: 512) – Maximum input tokens

Returns: `TransformersJSEmbeddingModel`

### `doesBrowserSupportTransformersJS(): boolean`

Checks if the browser supports TransformersJS with optimal performance. Returns `true` if the browser has WebGPU or WebAssembly support, `false` otherwise.

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


