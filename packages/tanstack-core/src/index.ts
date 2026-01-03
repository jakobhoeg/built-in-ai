// ===========================
// Text/Chat adapter
// ===========================

export {
  BuiltInAITextAdapter,
  builtInAI,
  createBuiltInAIChat,
  type BuiltInAITextAdapterOptions,
  type BuiltInAIProviderOptions,
  type BuiltInAIInputModalities,
  type BuiltInAIModelMessage,
} from './adapters/text'

// ===========================
// Tool Calling
// ===========================

export {
  // Types
  type JSONSchema,
  type ToolDefinition,
  type ParsedToolCall,
  type ToolResult,
  type ParsedResponse,
  // Functions
  extractToolDefinition,
  buildJsonToolSystemPrompt,
  parseJsonFunctionCalls,
  hasJsonFunctionCalls,
  extractJsonFunctionCallsBlock,
  formatToolResults,
  formatSingleToolResult,
} from './tool-calling'

// ===========================
// Streaming
// ===========================

export {
  ToolCallFenceDetector,
  type FenceDetectionResult,
  type StreamingFenceResult,
} from './streaming'

// ===========================
// Utilities
// ===========================

export {
  SessionManager,
  PromptAPINotAvailableError,
  ModelUnavailableError,
  generateId,
  convertMessagesAsync,
  type SessionCreateOptions,
  type ProgressCallback,
  type ConvertedMessages,
} from './utils'

// ===========================
// Type Exports
// ===========================

export type {
  BuiltInAITextMetadata,
  BuiltInAIImageMetadata,
  BuiltInAIAudioMetadata,
  BuiltInAIVideoMetadata,
  BuiltInAIDocumentMetadata,
  BuiltInAIMessageMetadataByModality,
} from './message-types'
