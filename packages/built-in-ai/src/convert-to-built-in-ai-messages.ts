import {
  LanguageModelV2Prompt,
  UnsupportedFunctionalityError,
} from "@ai-sdk/provider";

export interface ConvertedMessages {
  systemMessage?: string;
  messages: LanguageModelMessage[];
}

/**
 * Convert Vercel AI SDK prompt format to built-in AI Prompt API format
 * Returns system message (for initialPrompts) and regular messages (for prompt method)
 */
export function convertToBuiltInAIMessages(prompt: LanguageModelV2Prompt): ConvertedMessages {
  let systemMessage: string | undefined;
  const messages: LanguageModelMessage[] = [];

  for (const message of prompt) {
    switch (message.role) {
      case "system": {
        // There's only ever one system message from AI SDK
        systemMessage = message.content;
        break;
      }

      case "user": {
        messages.push({
          role: "user",
          content: message.content.map(part => {
            switch (part.type) {
              case "text": {
                return { type: "text", value: part.text } as LanguageModelMessageContent;
              }

              case "file": {
                if (part.mediaType?.startsWith("image/")) {
                  return {
                    type: "image",
                    value: part.data instanceof URL ? part.data.toString() : part.data,
                  } as LanguageModelMessageContent;
                } else if (part.mediaType?.startsWith("audio/")) {
                  return {
                    type: "audio",
                    value: part.data instanceof URL ? part.data.toString() : part.data,
                  } as LanguageModelMessageContent;
                } else {
                  throw new UnsupportedFunctionalityError({
                    functionality: `file type: ${part.mediaType}`,
                  });
                }
              }

              default: {
                throw new UnsupportedFunctionalityError({
                  functionality: `content type: ${(part as any).type}`,
                });
              }
            }
          }),
        } as LanguageModelMessage);
        break;
      }

      case "assistant": {
        let text = "";

        for (const part of message.content) {
          switch (part.type) {
            case "text": {
              text += part.text;
              break;
            }
            case "tool-call": {
              throw new UnsupportedFunctionalityError({
                functionality: "tool calls",
              });
            }
          }
        }

        messages.push({
          role: "assistant",
          content: text,
        } as LanguageModelMessage);
        break;
      }

      case "tool": {
        throw new UnsupportedFunctionalityError({
          functionality: "tool messages",
        });
      }

      default: {
        throw new Error(`Unsupported role: ${(message as any).role}`);
      }
    }
  }

  return { systemMessage, messages };
}