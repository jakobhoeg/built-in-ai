export {
  SessionManager,
  PromptAPINotAvailableError,
  ModelUnavailableError,
  type SessionCreateOptions,
  type ProgressCallback,
} from './session-manager'

export {
  convertMessagesAsync,
  type ConvertedMessages,
} from './message-converter'

/**
 * Generates a unique ID for stream chunks
 */
export function generateId(prefix: string = 'msg'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}
