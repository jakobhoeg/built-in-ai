/**
 * Message converter for TanStack AI SDK to Browser Prompt API format
 */

import type { TextOptions } from '@tanstack/ai'

/**
 * TanStack AI message content part types
 */
interface TextContentPart {
  type: 'text'
  content: string
}

interface ImageContentPart {
  type: 'image'
  source: {
    type: 'data' | 'url'
    value: string
  }
}

type ContentPart = TextContentPart | ImageContentPart | { type: string }

/**
 * TanStack AI message type (simplified)
 */
interface TanStackMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string | null | Array<ContentPart>
  toolCallId?: string
  toolCalls?: Array<{
    id: string
    type: 'function'
    function: {
      name: string
      arguments: string
    }
  }>
}

/**
 * Result of message conversion
 */
export interface ConvertedMessages {
  systemMessage?: string
  messages: LanguageModelMessage[]
}

/**
 * Converts TanStack AI SDK messages to Browser Prompt API format
 *
 * @param messages - TanStack AI SDK messages
 * @param systemPrompts - Optional system prompts from TextOptions
 * @returns Converted messages in LanguageModelMessage format
 */
export function convertMessages(
  messages: TextOptions['messages'],
  systemPrompts?: Array<string>
): ConvertedMessages {
  let systemMessage: string | undefined

  // Combine system prompts if provided
  if (systemPrompts && systemPrompts.length > 0) {
    systemMessage = systemPrompts.join('\n\n')
  }

  const convertedMessages: LanguageModelMessage[] = []

  for (const msg of messages as TanStackMessage[]) {
    switch (msg.role) {
      case 'user': {
        const content = convertContent(msg.content)
        convertedMessages.push({
          role: 'user',
          content,
        } as LanguageModelMessage)
        break
      }

      case 'assistant': {
        // For assistant messages, convert to string
        const textContent = extractTextContent(msg.content)
        convertedMessages.push({
          role: 'assistant',
          content: textContent,
        } as LanguageModelMessage)
        break
      }

      case 'tool': {
        // Tool results are sent as user messages with the result content
        const resultContent =
          typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content)

        convertedMessages.push({
          role: 'user',
          content: `Tool result: ${resultContent}`,
        } as LanguageModelMessage)
        break
      }
    }
  }

  return { systemMessage, messages: convertedMessages }
}

/**
 * Converts TanStack content to LanguageModelMessage content format
 */
function convertContent(
  content: string | null | Array<ContentPart>
): string | LanguageModelMessageContent[] {
  if (content === null) {
    return ''
  }

  if (typeof content === 'string') {
    return content
  }

  // Array of content parts
  const parts: LanguageModelMessageContent[] = []

  for (const part of content) {
    if (part.type === 'text') {
      parts.push({
        type: 'text',
        value: (part as TextContentPart).content,
      } as LanguageModelMessageContent)
    }
    // Skip unsupported content types for now
  }

  // If only one text part, return as string for simplicity
  if (parts.length === 1 && parts[0].type === 'text') {
    return (parts[0] as { type: 'text'; value: string }).value
  }

  return parts
}

/**
 * Extracts text content from message content
 */
function extractTextContent(content: string | null | Array<ContentPart>): string {
  if (content === null) {
    return ''
  }

  if (typeof content === 'string') {
    return content
  }

  // Extract text from content parts
  return content
    .filter((part): part is TextContentPart => part.type === 'text')
    .map((part) => part.content)
    .join('')
}
