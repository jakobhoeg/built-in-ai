/**
 * Built-in AI (Prompt API) specific metadata types for content parts.
 * This package supports text, image, and audio via the browser's Prompt API.
 *
 * @see https://developer.chrome.com/docs/ai/built-in
 * @see https://github.com/webmachinelearning/prompt-api
 */

/**
 * Metadata for text content parts.
 */
export interface BuiltInAITextMetadata {
  // No additional metadata for text
}

/**
 * Metadata for image content parts.
 * The Prompt API supports image inputs via expectedInputs: [{ type: "image" }]
 */
export interface BuiltInAIImageMetadata {
  /** Optional detail level hint (provider-specific, may be ignored) */
  detail?: "auto" | "low" | "high";
  /** Optional media type (e.g., "image/jpeg", "image/png") */
  mediaType?: string;
}

/**
 * Metadata for audio content parts.
 * The Prompt API supports audio inputs via expectedInputs: [{ type: "audio" }]
 */
export interface BuiltInAIAudioMetadata {
  /** Optional media type (e.g., "audio/wav", "audio/mp3") */
  mediaType?: string;
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
