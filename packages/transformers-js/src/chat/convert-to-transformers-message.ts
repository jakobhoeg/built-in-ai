
import {
  LanguageModelV2Prompt,
  UnsupportedFunctionalityError,
} from "@ai-sdk/provider";

function uint8ArrayToBase64(uint8array: Uint8Array): string {
  const binary = Array.from(uint8array, (byte) =>
    String.fromCharCode(byte),
  ).join("");
  return btoa(binary);
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
  if (data instanceof URL) {
    return data.toString();
  }

  if (typeof data === "string") {
    // AI SDK provides base64 string
    return `data:${mediaType};base64,${data}`;
  }

  if (data instanceof Uint8Array) {
    return `data:${mediaType};base64,${uint8ArrayToBase64(data)}`;
  }

  if (data instanceof ArrayBuffer) {
    return `data:${mediaType};base64,${uint8ArrayToBase64(
      new Uint8Array(data),
    )}`;
  }

  if (typeof Buffer !== "undefined" && data instanceof Buffer) {
    return `data:${mediaType};base64,${data.toString("base64")}`;
  }

  throw new UnsupportedFunctionalityError({
    functionality: `file data type: ${typeof data}`,
  });
}

export function convertToTransformersMessages(prompt: LanguageModelV2Prompt, isVisionModel: boolean = false): Array<{ role: string; content: any }> {
  const messages: Array<{ role: string; content: any }> = [];

  for (const message of prompt) {
    switch (message.role) {
      case "system":
        messages.push({
          role: "system",
          content: message.content,
        });
        break;
      case "user":
        if (isVisionModel) {
          // For vision models, support both text and images
          const contentParts: Array<{ type: "text"; text: string } | { type: "image"; image: string }> = [];
          let textParts: string[] = [];

          for (const part of message.content) {
            if (part.type === "text") {
              textParts.push(part.text);
            } else if (part.type === "file" && part.mediaType?.startsWith("image/")) {
              // If we have accumulated text, add it as a text part
              if (textParts.length > 0) {
                contentParts.push({ type: "text", text: textParts.join("\n") });
                textParts = [];
              }
              // Add the image - convert data to URL format expected by transformers.js
              const imageUrl = convertDataToURL(part.data, part.mediaType!);
              contentParts.push({ type: "image", image: imageUrl });
            } else if (part.type === "file") {
              throw new UnsupportedFunctionalityError({
                functionality: "non-image file input",
              });
            }
          }

          // Add any remaining text
          if (textParts.length > 0) {
            contentParts.push({ type: "text", text: textParts.join("\n") });
          }

          messages.push({
            role: "user",
            content: contentParts,
          });
        } else {
          // For text-only models, only support text
          const userContent: string[] = [];
          for (const part of message.content) {
            if (part.type === "text") {
              userContent.push(part.text);
            } else if (part.type === "file") {
              throw new UnsupportedFunctionalityError({
                functionality: "file input",
              });
            }
          }
          messages.push({
            role: "user",
            content: userContent.join("\n"),
          });
        }
        break;
      case "assistant":
        let assistantContent = "";
        for (const part of message.content) {
          if (part.type === "text") {
            assistantContent += part.text;
          } else if (part.type === "tool-call") {
            throw new UnsupportedFunctionalityError({
              functionality: "tool calling",
            });
          }
        }
        messages.push({
          role: "assistant",
          content: assistantContent,
        });
        break;
      case "tool":
        throw new UnsupportedFunctionalityError({
          functionality: "tool results",
        });
    }
  }

  return messages;
}