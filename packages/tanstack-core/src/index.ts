// ===========================
// Text/Chat adapter
// ===========================

export {
  BuiltInAITextAdapter,
  builtInAIText,
  createBuiltInAIChat,
  type BuiltInAITextAdapterOptions,
  type BuiltInAIProviderOptions,
} from './adapters/text'

// ===========================
// Utilities
// ===========================

export {
  SessionManager,
  PromptAPINotAvailableError,
  ModelUnavailableError,
  generateId,
  type SessionCreateOptions,
  type ProgressCallback,
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
