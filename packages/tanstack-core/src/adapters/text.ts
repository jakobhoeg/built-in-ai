import { BaseTextAdapter } from '@tanstack/ai/adapters'

import {
  SessionManager,
  convertMessages,
  generateId,
  type SessionCreateOptions,
} from '../utils'
import type { BuiltInAIMessageMetadataByModality } from '../message-types'

import type {
  StructuredOutputOptions,
  StructuredOutputResult,
} from '@tanstack/ai/adapters'
import type { StreamChunk, TextOptions } from '@tanstack/ai'

/**
 * Built-in AI provider-specific options
 */
export interface BuiltInAIProviderOptions {
  /** Sampling temperature (0.0 to 2.0) */
  temperature?: number
  /** Top-K sampling parameter */
  topK?: number
}

/**
 * Options for creating a Built-in AI text adapter
 */
export interface BuiltInAITextAdapterOptions {
  /** Base session options */
  sessionOptions?: SessionCreateOptions
}

/**
 * Default input modalities for Built-in AI
 * Currently text-only, structured for future multimodal support
 */
type BuiltInAIInputModalities = readonly ['text']

/**
 * Built-in AI Text/Chat Adapter for TanStack AI SDK
 *
 * Connects TanStack AI SDK to Chrome/Edge's built-in Prompt API (LanguageModel).
 *
 * @example
 * ```typescript
 * import { builtInAIText } from '@built-in-ai/tanstack-core'
 *
 * const adapter = builtInAIText()
 *
 * for await (const chunk of adapter.chatStream({
 *   model: 'text',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * })) {
 *   if (chunk.type === 'content') {
 *     console.log(chunk.delta)
 *   }
 * }
 * ```
 */
export class BuiltInAITextAdapter<
  TModel extends string = 'text',
> extends BaseTextAdapter<
  TModel,
  BuiltInAIProviderOptions,
  BuiltInAIInputModalities,
  BuiltInAIMessageMetadataByModality
> {
  readonly kind = 'text' as const
  readonly name = 'built-in-ai' as const

  private sessionManager: SessionManager

  constructor(model: TModel, options?: BuiltInAITextAdapterOptions) {
    super({}, model)
    this.sessionManager = new SessionManager(options?.sessionOptions)
  }

  /**
   * Streams chat responses from the browser's built-in AI model
   *
   * @param options - Text generation options including messages, temperature, etc.
   * @yields StreamChunk objects for content, done, and error events
   */
  async *chatStream(
    options: TextOptions<BuiltInAIProviderOptions>
  ): AsyncIterable<StreamChunk> {
    const timestamp = Date.now()
    const responseId = generateId('msg')

    try {
      // Convert messages to Prompt API format
      const { systemMessage, messages } = convertMessages(
        options.messages,
        options.systemPrompts
      )

      // Get or create session
      const session = await this.sessionManager.getSession({
        systemMessage,
      })

      // Prepare prompt options (intersection for temperature/topK)
      const promptOptions: LanguageModelPromptOptions &
        LanguageModelCreateCoreOptions = {}
      const modelOptions = options.modelOptions as
        | BuiltInAIProviderOptions
        | undefined

      if (options.temperature !== undefined) {
        promptOptions.temperature = options.temperature
      } else if (modelOptions?.temperature !== undefined) {
        promptOptions.temperature = modelOptions.temperature
      }

      if (modelOptions?.topK !== undefined) {
        promptOptions.topK = modelOptions.topK
      }

      // Pass abort signal to the Prompt API if provided
      const abortSignal = options.abortController?.signal
      if (abortSignal) {
        ; (promptOptions as LanguageModelPromptOptions).signal = abortSignal
      }

      // Start streaming
      const stream = session.promptStreaming(messages, promptOptions)
      const reader = stream.getReader()

      let accumulatedContent = ''
      let aborted = false

      // Set up abort handler to cancel the reader
      const abortHandler = () => {
        aborted = true
        reader.cancel().catch(() => undefined)
      }

      if (abortSignal) {
        abortSignal.addEventListener('abort', abortHandler)
      }

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done || aborted) {
            break
          }

          // value is a delta (new text chunk), not accumulated text
          // Accumulate it for the full content
          const delta = value
          accumulatedContent += delta

          if (delta) {
            yield {
              type: 'content',
              id: responseId,
              model: options.model,
              timestamp,
              delta,
              content: accumulatedContent,
              role: 'assistant',
            } as StreamChunk
          }
        }

        if (!aborted) {
          yield {
            type: 'done',
            id: responseId,
            model: options.model,
            timestamp,
            finishReason: 'stop',
          } as StreamChunk
        }
      } finally {
        // Clean up abort handler
        if (abortSignal) {
          abortSignal.removeEventListener('abort', abortHandler)
        }
      }
    } catch (error) {
      // Don't emit error for abort
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      yield {
        type: 'error',
        id: responseId,
        model: options.model,
        timestamp,
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      } as StreamChunk
    }
  }

  /**
   * Generate structured output using the browser's built-in AI model
   *
   * Note: The Prompt API supports responseConstraint for JSON schema output.
   *
   * @param options - Structured output options
   * @returns Promise with parsed data and raw text
   */
  async structuredOutput(
    options: StructuredOutputOptions<BuiltInAIProviderOptions>
  ): Promise<StructuredOutputResult<unknown>> {
    const { chatOptions, outputSchema } = options

    // Convert messages
    const { systemMessage, messages } = convertMessages(
      chatOptions.messages,
      chatOptions.systemPrompts
    )

    // Get session
    const session = await this.sessionManager.getSession({
      systemMessage,
    })

    // Prepare options with response constraint
    const promptOptions: LanguageModelPromptOptions &
      LanguageModelCreateCoreOptions = {}
    const modelOptions = chatOptions.modelOptions as
      | BuiltInAIProviderOptions
      | undefined

    if (chatOptions.temperature !== undefined) {
      promptOptions.temperature = chatOptions.temperature
    } else if (modelOptions?.temperature !== undefined) {
      promptOptions.temperature = modelOptions.temperature
    }

    if (modelOptions?.topK !== undefined) {
      promptOptions.topK = modelOptions.topK
    }

    if (outputSchema) {
      promptOptions.responseConstraint = outputSchema as Record<string, unknown>
    }

    const rawText = await session.prompt(messages, promptOptions)

    let parsed: unknown
    try {
      parsed = JSON.parse(rawText)
    } catch {
      throw new Error(
        `Failed to parse structured output as JSON. Content: ${rawText.slice(0, 200)}${rawText.length > 200 ? '...' : ''}`
      )
    }

    return {
      data: parsed,
      rawText,
    }
  }

  /**
   * Check the availability of the built-in AI model
   *
   * @returns Promise resolving to availability status
   */
  async availability(): Promise<Availability> {
    return this.sessionManager.checkAvailability()
  }

  /**
   * Destroy the current session to free resources
   */
  destroySession(): void {
    this.sessionManager.destroySession()
  }
}

/**
 * Creates a Built-in AI text adapter
 *
 * @param model - Model identifier (defaults to 'text')
 * @param options - Optional adapter configuration
 * @returns BuiltInAITextAdapter instance
 *
 * @example
 * ```typescript
 * const adapter = builtInAIText()
 *
 * // Or with options
 * const adapter = builtInAIText('text', {
 *   sessionOptions: { temperature: 0.7 }
 * })
 * ```
 */
export function builtInAIText<TModel extends string = 'text'>(
  model: TModel = 'text' as TModel,
  options?: BuiltInAITextAdapterOptions
): BuiltInAITextAdapter<TModel> {
  return new BuiltInAITextAdapter(model, options)
}

/**
 * Creates a Built-in AI chat adapter (alias for builtInAIText)
 */
export const createBuiltInAIChat = builtInAIText
