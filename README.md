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

TypeScript libraries that provide access to in-browser AI model providers with seamless fallback to using server-side models.

## Documentation

For detailed documentation, browser requirements and advanced usage, refer to the [official documentation](https://built-in-ai.dev/docs).

### Package Versions

| Package | AI SDK v6 | AI SDK v5 |
| ------- | :-------: | :-------: |
| @built-in-ai/core | ✓ ≥ 3.0.0 | ✓ ≤ 2.1.0 |
| @built-in-ai/transformers-js | ✓ ≥ 1.0.0 | ✓ ≤ 0.3.4 |
| @built-in-ai/web-llm | ✓ ≥ 1.0.0 | ✓ ≤ 0.3.2 |

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
  prompt: 'Invent a new holiday and describe its traditions.',
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
  prompt: 'Invent a new holiday and describe its traditions.',
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
  prompt: 'Invent a new holiday and describe its traditions.',
});

for await (const chunk of result.textStream) {
  console.log(chunk);
}
```

## Contributing

Contributions are more than welcome! However, please make sure to check out the [contribution guidelines](https://github.com/jakobhoeg/built-in-ai/blob/main/CONTRIBUTING.md) before contributing.

## Why?

If you've ever built apps with local language models, you're likely familiar with the challenges: creating custom hooks, UI components and state management (lots of it), while also building complex integration layers to fall back to server-side models when compatibility is an issue.

Read more about this [here](https://www.built-in-ai.dev/docs/ai-sdk-v6).

## Author

2025 © Jakob Hoeg Mørk