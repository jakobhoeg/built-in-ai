/**
 * Built-in AI (Prompt API) specific metadata types for multimodal content parts.
 * Currently text-only, but structured for future multimodal support.
 *
 * @see https://developer.chrome.com/docs/ai/built-in
 */

/**
 * Metadata for image content parts.
 * Placeholder for future image support in the Prompt API.
 */
export interface BuiltInAIImageMetadata {
  /**
   * Optional format hint for the image.
   */
  format?: 'jpeg' | 'png' | 'gif' | 'webp'
}

/**
 * Metadata for audio content parts.
 * Placeholder for future audio support.
 */
export interface BuiltInAIAudioMetadata {
  /**
   * The format of the audio.
   */
  format?: 'wav' | 'mp3' | 'ogg'
}

/**
 * Metadata for video content parts.
 * Placeholder for future video support.
 */
export interface BuiltInAIVideoMetadata {
  /**
   * The format of the video.
   */
  format?: 'mp4' | 'webm'
}

/**
 * Metadata for document content parts.
 * Placeholder for future document support.
 */
export interface BuiltInAIDocumentMetadata {
  /**
   * The MIME type of the document.
   */
  mediaType?: 'application/pdf'
}

/**
 * Metadata for text content parts.
 */
export interface BuiltInAITextMetadata {
  // No additional metadata for text
}

/**
 * Map of modality types to their Built-in AI specific metadata types.
 * Used for type inference when constructing multimodal messages.
 */
export interface BuiltInAIMessageMetadataByModality {
  text: BuiltInAITextMetadata
  image: BuiltInAIImageMetadata
  audio: BuiltInAIAudioMetadata
  video: BuiltInAIVideoMetadata
  document: BuiltInAIDocumentMetadata
}
