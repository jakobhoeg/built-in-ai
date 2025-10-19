export {
  TransformersJSLanguageModel,
  type TransformersJSModelId,
  type TransformersJSModelSettings,
  doesBrowserSupportTransformersJS,
  isBrowserEnvironment,
  isServerEnvironment,
} from "./chat/transformers-js-language-model";

export {
  TransformersJSEmbeddingModel,
  type TransformersJSEmbeddingModelId,
  type TransformersJSEmbeddingSettings,
} from "./embedding/transformers-js-embedding-model";

export {
  TransformersJSTranscriptionModel,
  type TransformersJSTranscriptionModelId,
  type TransformersJSTranscriptionSettings,
} from "./transcription/transformers-js-transcription-model";

export {
  transformersJS,
  createTransformersJS,
  type TransformersJSProvider,
  type TransformersJSProviderSettings,
} from "./transformers-js-provider";

export type { TransformersUIMessage } from "./chat/ui-message-types.d.ts";

export type {
  GenerationOptions,
  WorkerLoadOptions,
} from "./chat/transformers-js-worker-types";

export { TransformersJSWorkerHandler } from "./chat/transformers-js-worker-handler";

export { TransformersJSTranscriptionWorkerHandler } from "./transcription/transformers-js-transcription-worker-handler";

// Tool calling utilities
export {
  buildJsonToolSystemPrompt,
  parseJsonFunctionCalls,
  hasJsonFunctionCalls,
  extractJsonFunctionCallsBlock,
  type JSONSchema,
  type ToolDefinition,
  type ParsedToolCall,
  type ToolResult,
  type ParsedResponse,
} from "./tool-calling";

// Streaming utilities
export { ToolCallFenceDetector } from "./streaming/tool-call-detector";

// Utility functions
export { isFunctionTool } from "./utils/tool-utils";
export { prependSystemPromptToMessages } from "./utils/prompt-utils";
export {
  createUnsupportedSettingWarning,
  createUnsupportedToolWarning,
} from "./utils/warnings";