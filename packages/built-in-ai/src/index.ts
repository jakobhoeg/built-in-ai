// Language model
export {
  BuiltInAIChatLanguageModel,
  doesBrowserSupportBuiltInAI,
  isBuiltInAIModelAvailable, // deprecated, use doesBrowserSupportBuiltInAI instead
} from "./built-in-ai-language-model";
export type { BuiltInAIChatSettings } from "./built-in-ai-language-model";

// Embedding model
export { BuiltInAIEmbeddingModel } from "./built-in-ai-embedding-model";
export type { BuiltInAIEmbeddingModelSettings } from "./built-in-ai-embedding-model";

// Provider
export { builtInAI, createBuiltInAI } from "./built-in-ai-provider";
export type {
  BuiltInAIProvider,
  BuiltInAIProviderSettings,
} from "./built-in-ai-provider";

// UI types
export type { BuiltInAIUIMessage } from "./ui-message-types";
