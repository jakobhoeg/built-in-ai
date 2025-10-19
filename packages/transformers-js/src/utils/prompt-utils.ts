/**
 * Utilities for prompt processing and transformation
 */

/**
 * Prepends a system prompt to messages by creating a new first message.
 *
 * For TransformersJS, we handle system prompts differently than built-in-ai:
 * We prepend the system prompt as a separate message if needed.
 *
 * @param messages - The messages array to modify
 * @param systemPrompt - The system prompt to prepend
 * @returns New messages array with system prompt prepended
 */
export function prependSystemPromptToMessages(
  messages: Array<{
    role: string;
    content: string | Array<{ type: string; text?: string; image?: string }>;
  }>,
  systemPrompt: string,
): Array<{
  role: string;
  content: string | Array<{ type: string; text?: string; image?: string }>;
}> {
  if (!systemPrompt.trim()) {
    return messages;
  }

  // For text-only models, prepend to first user message
  const prompts = [...messages];
  const firstUserIndex = prompts.findIndex((msg) => msg.role === "user");

  if (firstUserIndex !== -1) {
    const firstUserMessage = prompts[firstUserIndex];

    if (typeof firstUserMessage.content === "string") {
      prompts[firstUserIndex] = {
        ...firstUserMessage,
        content: `${systemPrompt}\n\n${firstUserMessage.content}`,
      };
    } else if (Array.isArray(firstUserMessage.content)) {
      const textParts = firstUserMessage.content.filter(
        (part) => part.type === "text",
      );
      if (textParts.length > 0) {
        const updatedContent = [...firstUserMessage.content];
        const firstTextIndex = updatedContent.findIndex(
          (part) => part.type === "text",
        );
        if (firstTextIndex !== -1 && updatedContent[firstTextIndex].text) {
          updatedContent[firstTextIndex] = {
            ...updatedContent[firstTextIndex],
            text: `${systemPrompt}\n\n${updatedContent[firstTextIndex].text}`,
          };
          prompts[firstUserIndex] = {
            ...firstUserMessage,
            content: updatedContent,
          };
        }
      }
    }
  } else {
    // No user message found, prepend as a user message
    prompts.unshift({
      role: "user",
      content: systemPrompt,
    });
  }

  return prompts;
}
