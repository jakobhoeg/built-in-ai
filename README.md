
# Built-in AI provider for Vercel AI SDK
<img src="../../npm-header.png">

A TypeScript library that provides access to browser-based AI capabilities with seamless fallback to using server-side models using the [Vercel AI SDK](https://ai-sdk.dev/). This library enables you to leverage **Chrome** and **Edge's** built-in AI features ([Prompt API](https://github.com/webmachinelearning/prompt-api)) while also easily switching models.

Vercel AI SDK v5 introduces [custom Transport support](https://v5.ai-sdk.dev/docs/announcing-ai-sdk-5-beta#enhanced-usechat-architecture) for the `useChat()` hook, providing the *missing piece* needed to fully integrate browser-based Prompt API capabilities with the Vercel AI SDK.

## Installation

> [!NOTE]
> This only works with the new v5 of the Vercel AI SDK. Make sure your project is migrated to use this package.

```bash
npm install built-in-ai
```

## Browser Requirements

To use the Prompt API in Chrome or Edge, these are the requirements:

1. You need Chrome (v. 128 or higher) or Edge Dev/Canary (v. 138.0.3309.2 or higher)

2. Enable these experimental flags:
    - If you're using Chrome:
      1. Go to chrome://flags/#prompt-api-for-gemini-nano and set it to Enabled
      2. Go to chrome://flags/#optimization-guide-on-device-model and set it to Enabled BypassPrefRequirement
      3. Go to chrome://components and click Check for Update on Optimization Guide On Device Model
    - If you're using Edge:
      1. Go to edge://flags/#prompt-api-for-phi-mini and set it to Enabled

For more information, check out [this guide](https://developer.chrome.com/docs/extensions/ai/prompt-api)

## Basic usage

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

Look [here](/packages/built-in-ai/README.md) for more usage examples and API reference.

## Supported Features

### Supported
- Text generation
- Streaming responses
- Temperature control
- Response format constraints (JSON)
- Abort signals

### Needs to be implemented
- Tool calling
- Multimodality (images)
- Token counting
- Custom stop sequences
- Presence/frequency penalties

## Contributing

Contributions are more than welcome!

## Why This Package?

While there is an [existing package](https://github.com/jeasonstudio/chrome-ai) that attempted to provide similar functionality, it has been inactive for the past year with no maintenance or updates.

This package was created to provide a reliable, actively maintained solution for integrating browser-based AI capabilities with modern web applications, ensuring ongoing support and compatibility with the latest browser AI features.