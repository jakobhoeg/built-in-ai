/**
 * Built-in AI (Prompt API) specific metadata types for content parts.
 * This package supports text-only via the browser's Prompt API.
 *
 * @see https://developer.chrome.com/docs/ai/built-in
 */

/**
 * Metadata for text content parts.
 */
export interface BuiltInAITextMetadata {
  // No additional metadata for text
}

/**
 * Placeholder metadata for image content parts.
 * Included for type compatibility with TanStack AI SDK.
 */
export interface BuiltInAIImageMetadata {
  // Not implemented yet.
}

/**
 * Placeholder metadata for audio content parts.
 * Included for type compatibility with TanStack AI SDK.
 */
export interface BuiltInAIAudioMetadata {
  // Not implemented yet.
}

/**
 * Placeholder metadata for video content parts (not supported).
 * Included for type compatibility with TanStack AI SDK.
 */
export interface BuiltInAIVideoMetadata {
  // Not supported
}

/**
 * Placeholder metadata for document content parts (not supported).
 * Included for type compatibility with TanStack AI SDK.
 */
export interface BuiltInAIDocumentMetadata {
  // Not supported
}

/**
 * Map of modality types to their Built-in AI specific metadata types.
 * Used for type inference when constructing messages.
 */
export interface BuiltInAIMessageMetadataByModality {
  text: BuiltInAITextMetadata;
  image: BuiltInAIImageMetadata;
  audio: BuiltInAIAudioMetadata;
  video: BuiltInAIVideoMetadata;
  document: BuiltInAIDocumentMetadata;
}
