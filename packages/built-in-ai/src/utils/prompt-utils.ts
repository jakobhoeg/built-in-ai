/**
 * Utilities for prompt processing and transformation
 */

import type { LanguageModelV2Prompt } from "@ai-sdk/provider";

/**
 * Detect if the prompt contains multimodal content (images, audio)
 *
 * @param prompt - The prompt to check
 * @returns true if the prompt contains any file content
 */
export function hasMultimodalContent(prompt: LanguageModelV2Prompt): boolean {
  for (const message of prompt) {
    if (message.role === "user") {
      for (const part of message.content) {
        if (part.type === "file") {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Get expected inputs based on prompt content.
 * Analyzes the prompt to determine what types of inputs (text, image, audio) are used.
 * This information is used to configure the Prompt API session with the correct input capabilities.
 *
 * @param prompt - The prompt to analyze
 * @returns Array of expected input types for session creation (only includes image/audio, text is assumed)
 * @example
 * ```typescript
 * const inputs = getExpectedInputs(prompt);
 * // Returns: [{ type: "image" }] if prompt contains images
 * // Returns: [] if prompt only contains text
 * ```
 */
export function getExpectedInputs(
  prompt: LanguageModelV2Prompt,
): Array<{ type: "text" | "image" | "audio" }> {
  const inputs = new Set<"text" | "image" | "audio">();
  // Don't add text by default - it's assumed by the Prompt API

  for (const message of prompt) {
    if (message.role === "user") {
      for (const part of message.content) {
        if (part.type === "file") {
          if (part.mediaType?.startsWith("image/")) {
            inputs.add("image");
          } else if (part.mediaType?.startsWith("audio/")) {
            inputs.add("audio");
          }
        }
      }
    }
  }

  return Array.from(inputs).map((type) => ({ type }));
}

/**
 * Prepends a system prompt to the first user message in the conversation.
 *
 * This is necessary because the Prompt API doesn't support separate system messages,
 * so we inject the system prompt into the first user message instead.
 * Creates a shallow copy of messages to avoid mutating the original array.
 *
 * @param messages - The messages array to modify (not mutated, a copy is returned)
 * @param systemPrompt - The system prompt to prepend
 * @returns New messages array with system prompt prepended to first user message
 * @example
 * ```typescript
 * const messages = [{ role: "user", content: "Hello" }];
 * const updated = prependSystemPromptToMessages(messages, "You are a helpful assistant.");
 * // Returns: [{ role: "user", content: "You are a helpful assistant.\n\nHello" }]
 * ```
 */
export function prependSystemPromptToMessages(
  messages: LanguageModelMessage[],
  systemPrompt: string,
): LanguageModelMessage[] {
  if (!systemPrompt.trim()) {
    return messages;
  }

  const prompts = messages.map((message) => ({ ...message }));
  const firstUserIndex = prompts.findIndex((message) => message.role === "user");

  if (firstUserIndex !== -1) {
    const firstUserMessage = prompts[firstUserIndex];

    if (Array.isArray(firstUserMessage.content)) {
      const content = firstUserMessage.content.slice();
      content.unshift({
        type: "text",
        value: `${systemPrompt}\n\n`,
      });
      prompts[firstUserIndex] = {
        ...firstUserMessage,
        content,
      } as LanguageModelMessage;
    } else if (typeof firstUserMessage.content === "string") {
      prompts[firstUserIndex] = {
        ...firstUserMessage,
        content: `${systemPrompt}\n\n${firstUserMessage.content}`,
      } as LanguageModelMessage;
    }
  } else {
    prompts.unshift({
      role: "user",
      content: systemPrompt,
    });
  }

  return prompts;
}
