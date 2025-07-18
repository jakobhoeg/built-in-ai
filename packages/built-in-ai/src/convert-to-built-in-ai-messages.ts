import {
  LanguageModelV2Prompt,
  UnsupportedFunctionalityError,
} from "@ai-sdk/provider";

/**
 * Convert Vercel AI SDK prompt format to built-in AI Prompt API format
 */
export function convertToBuiltInAIMessages(prompt: LanguageModelV2Prompt): any[] {
  const messages = [];

  for (const message of prompt) {
    switch (message.role) {
      case "system": {
        messages.push({
          role: "system",
          content: message.content
        });
        break;
      }

      case "user": {
        messages.push({
          role: "user",
          content: message.content.map(part => {
            switch (part.type) {
              case "text": {
                return { type: "text", value: part.text };
              }

              case "file": {
                if (part.mediaType?.startsWith("image/")) {
                  return {
                    type: "image",
                    value: part.data instanceof URL ? part.data.toString() : part.data,
                  };
                } else if (part.mediaType?.startsWith("audio/")) {
                  return {
                    type: "audio",
                    value: part.data instanceof URL ? part.data.toString() : part.data,
                  };
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
        });
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
        });
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

  return messages;
}