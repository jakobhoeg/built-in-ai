# Built-in AI model providers for Vercel AI SDK

<div align="center">
<img src="npm-header.png">
</div>

<div align="center">

| Package                                                                                    | Version                                                                                                                                     | Downloads                                                                                                                                      |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [@built-in-ai/core](https://www.npmjs.com/package/@built-in-ai/core)                       | [![NPM Version](https://img.shields.io/npm/v/%40built-in-ai%2Fcore)](https://www.npmjs.com/package/@built-in-ai/core)                       | [![NPM Downloads](https://img.shields.io/npm/dm/%40built-in-ai%2Fcore)](https://www.npmjs.com/package/@built-in-ai/core)                       |
| [@built-in-ai/web-llm](https://www.npmjs.com/package/@built-in-ai/web-llm)                 | [![NPM Version](https://img.shields.io/npm/v/%40built-in-ai%2Fweb-llm)](https://www.npmjs.com/package/@built-in-ai/web-llm)                 | [![NPM Downloads](https://img.shields.io/npm/dm/%40built-in-ai%2Fweb-llm)](https://www.npmjs.com/package/@built-in-ai/web-llm)                 |
| [@built-in-ai/transformers-js](https://www.npmjs.com/package/@built-in-ai/transformers-js) | [![NPM Version](https://img.shields.io/npm/v/%40built-in-ai%2Ftransformers-js)](https://www.npmjs.com/package/@built-in-ai/transformers-js) | [![NPM Downloads](https://img.shields.io/npm/dm/%40built-in-ai%2Ftransformers-js)](https://www.npmjs.com/package/@built-in-ai/transformers-js) |

</div>

TypeScript libraries that provide access to in-browser AI models with seamless fallback to using server-side models using the [Vercel AI SDK](https://ai-sdk.dev/).

- [`@built-in-ai/core`](/packages/built-in-ai/README.md) package is the AI SDK model provider for your Chrome and Edge browser's [built-in AI models](https://developer.chrome.com/docs/ai/built-in).
- [`@built-in-ai/web-llm`](/packages/web-llm/README.md) package is the AI SDK model provider for open-source models (using [WebLLM](https://github.com/mlc-ai/web-llm)) running directly in the browser.
- [`@built-in-ai/transformers-js`](/packages/transformers-js/README.md) package is the AI SDK model provider for [Transformers.js](https://github.com/xenova/transformers.js) that runs both in the browser and on the server.

## Quick start

```bash
# For Chrome/Edge built-in AI models
npm i @built-in-ai/core

# For open-source models via WebLLM
npm i @built-in-ai/web-llm

# For 🤗 Transformers.js models (browser and server)
npm i @built-in-ai/transformers-js
```

### Basic Usage with Chrome/Edge AI

```typescript
import { streamText } from "ai";
import { builtInAI } from "@built-in-ai/core";

const result = streamText({
  model: builtInAI(),
  messages: [{ role: "user", content: "Hello, how are you?" }],
});

for await (const chunk of result.textStream) {
  console.log(chunk);
}
```

### Basic Usage with WebLLM

```typescript
import { streamText } from "ai";
import { webLLM } from "@built-in-ai/web-llm";

const result = streamText({
  model: webLLM("Llama-3.2-3B-Instruct-q4f16_1-MLC"),
  messages: [{ role: "user", content: "Hello, how are you?" }],
});

for await (const chunk of result.textStream) {
  console.log(chunk);
}
```

### Basic Usage with Transformers.js

```typescript
import { streamText } from "ai";
import { transformersJS } from "@built-in-ai/transformers-js";

const result = streamText({
  model: transformersJS("HuggingFaceTB/SmolLM2-360M-Instruct"),
  messages: [{ role: "user", content: "Hello, how are you?" }],
});

for await (const chunk of result.textStream) {
  console.log(chunk);
}
```

## Documentation

For detailed documentation, browser requirements and advanced usage:

- [@built-in-ai/core](/packages/built-in-ai/README.md) documentation
- [@built-in-ai/web-llm](/packages/web-llm/README.md) documentation
- [@built-in-ai/transformers-js](/packages/transformers-js/README.md) documentation

## Contributing

Contributions are more than welcome! However, please make sure to check out the [contribution guidelines](https://github.com/jakobhoeg/built-in-ai/blob/main/CONTRIBUTING.md) before contributing.

## Why?

If you've ever built apps with local language models, you're likely familiar with the challenges: creating custom hooks, UI components and state management (lots of it), while also building complex integration layers to fall back to server-side models when compatibility is an issue.

This library bridges this gap by providing a unified solution that lets you:

- Experiment with in-browser AI models using familiar patterns
- Seamlessly fall back to server-side models when needed
- Use the same Vercel AI SDK eco system you already know
- Avoid building complex integration layers from scratch
