import type { ChatCompletionMessageParam } from "@mlc-ai/web-llm";

/**
 * Extracts the system prompt from a message array and returns both the system prompt
 * and the remaining messages without the system message.
 *
 * @param messages - Array of chat messages
 * @returns Object with systemPrompt string and messages array without system messages
 */
export function extractSystemPrompt(messages: ChatCompletionMessageParam[]): {
  systemPrompt: string | undefined;
  messages: ChatCompletionMessageParam[];
} {
  const systemMessages = messages.filter((msg) => msg.role === "system");
  const nonSystemMessages = messages.filter((msg) => msg.role !== "system");

  if (systemMessages.length === 0) {
    return { systemPrompt: undefined, messages };
  }

  // Combine all system messages into one
  const systemPrompt = systemMessages
    .map((msg) => msg.content)
    .filter((content): content is string => typeof content === "string")
    .join("\n\n");

  return {
    systemPrompt: systemPrompt || undefined,
    messages: nonSystemMessages,
  };
}

/**
 * Prepends a system prompt to the messages array.
 * If there's already a system message, it prepends to it.
 * Otherwise, creates a new system message at the start.
 *
 * @param messages - Array of chat messages
 * @param systemPrompt - System prompt to prepend
 * @returns New messages array with system prompt prepended
 */
export function prependSystemPromptToMessages(
  messages: ChatCompletionMessageParam[],
  systemPrompt: string,
): ChatCompletionMessageParam[] {
  if (!systemPrompt.trim()) {
    return messages;
  }

  const systemMessageIndex = messages.findIndex((msg) => msg.role === "system");

  if (systemMessageIndex !== -1) {
    const newMessages = [...messages];
    const existingSystemMessage = messages[systemMessageIndex];
    const existingContent =
      typeof existingSystemMessage.content === "string"
        ? existingSystemMessage.content
        : "";

    newMessages[systemMessageIndex] = {
      ...existingSystemMessage,
      content: systemPrompt + (existingContent ? `\n\n${existingContent}` : ""),
    };

    return newMessages;
  }

  return [
    {
      role: "system",
      content: systemPrompt,
    },
    ...messages,
  ];
}
