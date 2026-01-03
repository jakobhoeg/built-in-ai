/**
 * Message converter for TanStack AI SDK to Browser Prompt API format
 * Supports text and tool-related message content
 */

import type { TextOptions } from '@tanstack/ai'

/**
 * TanStack AI message content part types
 */
interface TextContentPart {
  type: 'text'
  content: string
}

interface ToolCallPart {
  type: 'tool-call'
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
}

interface ToolResultPart {
  type: 'tool-result'
  toolCallId: string
  toolName: string
  result: unknown
  isError?: boolean
}

type ContentPart =
  | TextContentPart
  | ToolCallPart
  | ToolResultPart
  | { type: string }

/**
 * TanStack AI message type
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
 * Async version of convertMessages
 *
 * @param messages - TanStack AI SDK messages
 * @param systemPrompts - Optional system prompts from TextOptions
 * @returns Converted messages in LanguageModelMessage format
 */
export async function convertMessagesAsync(
  messages: TextOptions['messages'],
  systemPrompts?: Array<string>
): Promise<ConvertedMessages> {
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
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          const textContent = extractTextContent(msg.content)
          const toolCallsText = msg.toolCalls
            .map((tc) => {
              return `\`\`\`tool_call\n${JSON.stringify({ name: tc.function.name, arguments: JSON.parse(tc.function.arguments) })}\n\`\`\``
            })
            .join('\n\n')

          const combinedContent = textContent
            ? `${textContent}\n\n${toolCallsText}`
            : toolCallsText

          convertedMessages.push({
            role: 'assistant',
            content: combinedContent,
          } as LanguageModelMessage)
        } else {
          const textContent = extractTextContent(msg.content)
          convertedMessages.push({
            role: 'assistant',
            content: textContent,
          } as LanguageModelMessage)
        }
        break
      }

      case 'tool': {
        const resultContent =
          typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content)

        const formattedResult = `\`\`\`tool_result\n${JSON.stringify({
          id: msg.toolCallId,
          name: 'tool',
          result: JSON.parse(resultContent),
          error: false,
        })}\n\`\`\``

        convertedMessages.push({
          role: 'user',
          content: formattedResult,
        } as LanguageModelMessage)
        break
      }
    }
  }

  return { systemMessage, messages: convertedMessages }
}

/**
 * Converts content to string format for Prompt API
 */
function convertContent(content: string | null | Array<ContentPart>): string {
  if (content === null) {
    return ''
  }

  if (typeof content === 'string') {
    return content
  }

  // Extract text from content parts (ignore non-text parts)
  return content
    .filter((part): part is TextContentPart => part.type === 'text')
    .map((part) => part.content)
    .join('')
}

/**
 * Extracts text content from message content
 */
function extractTextContent(
  content: string | null | Array<ContentPart>
): string {
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
