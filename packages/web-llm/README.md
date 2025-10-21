# WebLLM provider for Vercel AI SDK

<div align="center">
<img src="./hero.png">
</div>

<div align="center">

[![NPM Version](https://img.shields.io/npm/v/%40built-in-ai%2Fweb-llm)](https://www.npmjs.com/package/@built-in-ai/web-llm)
[![NPM Downloads](https://img.shields.io/npm/dm/%40built-in-ai%2Fweb-llm)](https://www.npmjs.com/package/@built-in-ai/web-llm)

> [!NOTE]
> This library is still in a very early state where updates might come quite frequently.

</div>

[WebLLM](https://github.com/mlc-ai/web-llm) model provider for [Vercel AI SDK](https://ai-sdk.dev/). This library enables you to easily use the AI SDK with popular open-source models running directly in your web browser.

## Installation

```bash
npm i @built-in-ai/web-llm
```

The `@built-in-ai/web-llm` package is the AI SDK provider for open-source built-in AI models leveraging the [WebLLM](https://github.com/mlc-ai/web-llm) inference engine.

## Browser Requirements

A WebGPU-compatible browser is needed to run these models. Check out the [API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) for more information.

## Usage

### Basic Usage

```typescript
import { streamText } from "ai";
import { webLLM } from "@built-in-ai/web-llm";

const result = streamText({
  // or generateText
  model: webLLM("Llama-3.2-3B-Instruct-q4f16_1-MLC"),
  messages: [{ role: "user", content: "Hello, how are you?" }],
});

for await (const chunk of result.textStream) {
  console.log(chunk);
}
```

### Advanced Usage

If you're already familiar with the WebLLM engine library (or in general inference with models in the browser), you'll know that to make it run effeciently, you probably know that you need to use [web workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) to offload the heavy model computation to a different thread than the UI. You can check out WebLLM's official [docs](https://webllm.mlc.ai/docs/user/advanced_usage.html) for more information.

1. Create your `worker.ts` file:

```typescript
import { WebWorkerMLCEngineHandler } from "@built-in-ai/web-llm";

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};
```

2. Provide it in the model instance:

```typescript
import { streamText } from "ai";
import { webLLM } from "@built-in-ai/web-llm";

const result = streamText({ // or generateText
  model: webLLM('Qwen3-0.6B-q0f16-MLC', {
    worker: new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    }),
  });,
  messages: [{ role: "user", content: "Hello, how are you?" }],
});

for await (const chunk of result.textStream) {
  console.log(chunk);
}
```

## Download Progress Tracking

When using the open-source models for the first time, the model needs to be downloaded before use.

You'll probably want to show download progress in your applications to improve UX.

### Basic Progress Monitoring

```typescript
import { streamText } from "ai";
import { webLLM } from "@built-in-ai/web-llm";

const model = webLLM("Llama-3.2-3B-Instruct-q4f16_1-MLC");
const availability = await model.availability();

if (availability === "unavailable") {
  console.log("Browser doesn't support built-in AI models");
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

### Tool calling

> Be aware that some models might struggle with this.
> If you want to try it out with best succes, I suggest using a reasoning model (Qwen3).

```ts
const result = streamText({
  model: webLLM("Qwen3-1.7B-q4f16_1-MLC"),
  tools: {
    weather: tool({
      description: "Get the weather in a location",
      inputSchema: z.object({
        location: z.string().describe("The location to get the weather for"),
      }),
      execute: async ({ location }) => ({
        location,
        temperature: 72 + Math.floor(Math.random() * 21) - 10,
      }),
    }),
  },
  stopWhen: stepCountIs(5),
  prompt: "What is the weather in San Francisco?",
});
```

And then in your useChat use `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls`.

## Integration with useChat Hook

When using this library with the `useChat` hook, you'll need to create a [custom transport](https://v5.ai-sdk.dev/docs/ai-sdk-ui/transport#transport) implementation to handle client-side AI with download progress.

You can do this by importing `WebLLMUIMessage` from `@built-in-ai/web-llm` that extends `UIMessage` to include [data parts](https://v5.ai-sdk.dev/docs/ai-sdk-ui/streaming-data) such as download progress.

See the complete working example: **[`/examples/next-hybrid/app/web-llm/util/web-llm-chat-transport.ts`](../../examples/next-hybrid/app/web-llm/util/web-llm-chat-transport.ts)** and the **[`/examples/next-hybrid/app/web-llm/page.tsx`](../../examples/next-hybrid/app/web-llm/page.tsx)** components.

This example includes:

- Download progress with UI progress bar and status message updates
- Hybrid client/server architecture with fallback
- Error handling and notifications
- Full integration with `useChat` hook

## API Reference

### `webLLM(modelId, settings?)`

Creates a WebLLM model instance.

**Parameters:**

- `modelId`: The model identifier from the [supported list of models](https://github.com/mlc-ai/web-llm/blob/main/src/config.ts)
- `settings` (optional): Configuration options for the WebLLM model
  - `appConfig?: AppConfig` - Custom app configuration for WebLLM
  - `initProgressCallback?: (progress: WebLLMProgress) => void` - Progress callback for model initialization
  - `engineConfig?: MLCEngineConfig` - Engine configuration options
  - `worker?: Worker` - A web worker instance to run the model in for better performance

**Returns:** `WebLLMLanguageModel` instance

### `doesBrowserSupportWebLLM(): boolean`

Quick check if the browser supports the WebLLM. Useful for component-level decisions and feature flags.

**Returns:** `boolean` - `true` if browser supports WebLLM, `false` otherwise

**Example:**

```typescript
import { doesBrowserSupportWebLLM } from "@built-in-ai/web-llm";

if (doesBrowserSupportWebLLM()) {
  // Show built-in AI option in UI
} else {
  // Show server-side option only
}
```

### `WebLLMUIMessage`

Extended UI message type for use with the `useChat` hook that includes custom data parts for WebLLM functionality.

**Type Definition:**

```typescript
type WebLLMUIMessage = UIMessage<
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

### `WebLLMLanguageModel.createSessionWithProgress(onDownloadProgress?)`

Creates a language model session with optional download progress monitoring.

**Parameters:**

- `onDownloadProgress?: (progress: WebLLMProgress) => void` - Optional callback that receives progress reports during model download

**Returns:** `Promise<MLCEngineInterface>` - The configured language model session

**Example:**

```typescript
const model = webLLM("Llama-3.2-3B-Instruct-q4f16_1-MLC");
await model.createSessionWithProgress((report) => {
  console.log(`Download: ${report.text}`);
});
```

### `WebLLMLanguageModel.availability()`

Checks the current availability status of the WebLLM model.

**Returns:** `Promise<"unavailable" | "downloadable" | "downloading" | "available">`

- `"unavailable"` - Model is not supported in the browser
- `"downloadable"` - Model is supported but needs to be downloaded first
- `"downloading"` - Model is currently being downloaded
- `"available"` - Model is ready to use

### `WebLLMProgress`

The progress report type returned during model initialization.

```typescript
interface InitProgressReport {
  progress: number; // 0-1
  timeElapsed: number; // in ms
  text: string; // progress text
}
```

## Author

2025 © Jakob Hoeg Mørk

## Credits

The WebLLM & Vercel teams
