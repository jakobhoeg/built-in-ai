export {
  // Standalone utility functions
  doesBrowserSupportBuiltInAI,
  checkBuiltInAIAvailability,
  // SessionManager class and errors
  SessionManager,
  PromptAPINotAvailableError,
  ModelUnavailableError,
  // Types
  type SessionCreateOptions,
  type ProgressCallback,
} from "./session-manager";

export {
  convertMessagesAsync,
  type ConvertedMessages,
} from "./message-converter";

/**
 * Generates a unique ID for stream chunks
 */
export function generateId(prefix: string = "msg"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Get expected inputs by analyzing messages for image/audio content.
 * Automatically detects multimodal content so users don't need to specify expectedInputs manually.
 */
export function getExpectedInputsFromMessages(
  messages: LanguageModelMessage[],
): Array<{ type: "text" | "image" | "audio" }> | undefined {
  const inputs = new Set<"image" | "audio">();

  for (const message of messages) {
    if (message.role === "user" && Array.isArray(message.content)) {
      for (const part of message.content as LanguageModelMessageContent[]) {
        if (part.type === "image") {
          inputs.add("image");
        } else if (part.type === "audio") {
          inputs.add("audio");
        }
      }
    }
  }

  if (inputs.size === 0) return undefined;
  return Array.from(inputs).map((type) => ({ type }));
}