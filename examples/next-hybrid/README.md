# Built-in AI Next.js Hybrid Chat Example

> This is a very basic example of how to use all packages.

This example demonstrates how to create a hybrid AI chat application that intelligently switches between browser-based AI (Chrome/Edge Prompt API) and server-side AI models. The app includes download progress streaming from the browser AI model, multimodal file support, and graceful fallback when browser AI model is unavailable.

## Features Demonstrated

- ✅ **Hybrid AI Architecture** - Automatic fallback from browser AI to server-side AI
- ✅ **Download Progress Streaming** - Real-time progress bars during model downloads
- ✅ **Multimodal Support** - Image and audio file upload and processing
- ✅ **Type-Safe Streaming** - Custom data parts with TypeScript support
- ✅ **Modern UI** - Beautiful, responsive interface with dark/light mode
- ✅ **Error Handling** - Graceful error states and retry mechanisms
- ✅ **Transient Notifications** - Toast notifications for status updates

## Deploy your own

Deploy the example using [Vercel](https://vercel.com?utm_source=github&utm_medium=readme&utm_campaign=ai-sdk-example):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/jakobhoeg/built-in-ai/tree/main/examples/next-hybrid next-built-in-ai-hybrid)

## How to use

Execute [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app) with [npm](https://docs.npmjs.com/cli/init), [Yarn](https://yarnpkg.com/lang/en/docs/cli/create/), or [pnpm](https://pnpm.io) to bootstrap the example:

```bash
npx create-next-app --example https://github.com/jakobhoeg/built-in-ai/tree/main/examples/next-hybrid next-built-in-ai-hybrid
```

```bash
yarn create next-app --example https://github.com/jakobhoeg/built-in-ai/tree/main/examples/next-hybrid next-built-in-ai-hybrid
```

```bash
pnpm create next-app --example https://github.com/jakobhoeg/built-in-ai/tree/main/examples/next-hybrid next-built-in-ai-hybrid
```

## Learn More

To learn more about built-in AI, browser capabilities, and the AI SDK:

- [Built-in AI Package Documentation](../../packages/built-in-ai/README.md) - Complete API reference and examples
- [AI SDK docs](https://ai-sdk.dev/docs) - Vercel AI SDK documentation
- [Chrome Prompt API Guide](https://developer.chrome.com/docs/extensions/ai/prompt-api) - Browser AI capabilities
- [AI SDK v5 Custom Transport](https://v5.ai-sdk.dev/docs/announcing-ai-sdk-5-beta#enhanced-usechat-architecture) - Custom transport implementation
- [Streaming Custom Data](https://v5.ai-sdk.dev/docs/ai-sdk-ui/streaming-custom-data) - Data streaming patterns
- [Next.js Documentation](https://nextjs.org/docs) - Next.js features and API
