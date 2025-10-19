import {
  LanguageModelV2Prompt,
  UnsupportedFunctionalityError,
} from "@ai-sdk/provider";

function uint8ArrayToBase64(uint8array: Uint8Array): string {
  return btoa(String.fromCharCode(...uint8array));
}

function convertDataToURL(
  data:
    | string
    | Buffer
    | URL
    | Uint8Array
    | ArrayBuffer
    | ReadableStream
    | undefined,
  mediaType: string,
): string {
  if (data instanceof URL) return data.toString();

  if (typeof data === "string") {
    return `data:${mediaType};base64,${data}`;
  }

  if (data instanceof Uint8Array) {
    return `data:${mediaType};base64,${uint8ArrayToBase64(data)}`;
  }

  if (data instanceof ArrayBuffer) {
    return `data:${mediaType};base64,${uint8ArrayToBase64(new Uint8Array(data))}`;
  }

  if (typeof Buffer !== "undefined" && data instanceof Buffer) {
    return `data:${mediaType};base64,${data.toString("base64")}`;
  }

  throw new UnsupportedFunctionalityError({
    functionality: `file data type: ${typeof data}`,
  });
}

/**
 * TransformersJS message type
 * For text models: content is a string
 * For vision models: content can be an array of text and image parts
 */
export interface TransformersMessage {
  role: string;
  content: string | Array<{ type: string; text?: string; image?: string }>;
}

/**
 * Safely normalize tool arguments - handles both string and object inputs
 */
function normalizeToolArguments(input: unknown): unknown {
  if (input === undefined) {
    return {};
  }

  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch {
      // If parsing fails, return the string as-is
      return input;
    }
  }

  return input ?? {};
}

function processVisionContent(
  content: any[],
): Array<{ type: "text"; text: string } | { type: "image"; image: string }> {
  const contentParts: Array<
    { type: "text"; text: string } | { type: "image"; image: string }
  > = [];
  let textParts: string[] = [];

  for (const part of content) {
    if (part.type === "text") {
      textParts.push(part.text);
    } else if (part.type === "file" && part.mediaType?.startsWith("image/")) {
      if (textParts.length > 0) {
        contentParts.push({ type: "text", text: textParts.join("\n") });
        textParts = [];
      }
      contentParts.push({
        type: "image",
        image: convertDataToURL(part.data, part.mediaType!),
      });
    } else if (part.type === "file") {
      throw new UnsupportedFunctionalityError({
        functionality: "non-image file input",
      });
    }
  }

  if (textParts.length > 0) {
    contentParts.push({ type: "text", text: textParts.join("\n") });
  }

  return contentParts;
}

export function convertToTransformersMessages(
  prompt: LanguageModelV2Prompt,
  isVisionModel: boolean = false,
): TransformersMessage[] {
  return prompt.map((message) => {
    switch (message.role) {
      case "system":
        return { role: "system", content: message.content };

      case "user":
        if (isVisionModel) {
          return {
            role: "user",
            content: processVisionContent(message.content),
          };
        }

        const textContent = message.content
          .map((part) => {
            if (part.type === "text") return part.text;
            if (part.type === "file")
              throw new UnsupportedFunctionalityError({
                functionality: "file input",
              });
            return "";
          })
          .join("\n");
        return { role: "user", content: textContent };

      case "assistant":
        const assistantContent = message.content
          .map((part) => {
            if (part.type === "text") return part.text;
            if (part.type === "tool-call") {
              // Format tool call as the expected fence format
              // Use normalizeToolArguments to safely handle input
              return `\`\`\`tool_call\n${JSON.stringify({
                name: part.toolName,
                arguments: normalizeToolArguments(part.input),
              })}\n\`\`\``;
            }
            return "";
          })
          .filter(Boolean) // Remove empty strings
          .join("\n");
        return { role: "assistant", content: assistantContent };

      case "tool":
        // Format tool results as expected fence format
        const toolResults = message.content
          .map((part) => {
            if (part.type === "tool-result") {
              // Extract the result value based on output type
              let resultValue: unknown;
              const isError =
                part.output.type === "error-text" ||
                part.output.type === "error-json";

              resultValue = part.output.value;

              return `\`\`\`tool_result\n${JSON.stringify({
                id: part.toolCallId,
                name: part.toolName,
                result: resultValue,
                error: isError,
              })}\n\`\`\``;
            }
            return "";
          })
          .filter(Boolean) // Remove empty strings
          .join("\n");
        return { role: "user", content: toolResults };

      default:
        throw new Error(`Unsupported message role: ${(message as any).role}`);
    }
  });
}
