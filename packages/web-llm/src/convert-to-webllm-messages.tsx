import {
  LanguageModelV2Prompt,
  UnsupportedFunctionalityError,
} from "@ai-sdk/provider";
import * as webllm from "@mlc-ai/web-llm";

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

export function convertToWebLLMMessages(
  prompt: LanguageModelV2Prompt,
): webllm.ChatCompletionMessageParam[] {
  const messages: webllm.ChatCompletionMessageParam[] = [];

  for (const message of prompt) {
    switch (message.role) {
      case "system":
        messages.push({
          role: "system",
          content: message.content,
        });
        break;

      case "user":
        const hasFileContent = message.content.some(
          (part) => part.type === "file",
        );

        if (!hasFileContent) {
          const userContent: string[] = [];
          for (const part of message.content) {
            if (part.type === "text") {
              userContent.push(part.text);
            }
          }
          messages.push({
            role: "user",
            content: userContent.join("\n"),
          });
          break;
        }

        const content: webllm.ChatCompletionContentPart[] = [];
        for (const part of message.content) {
          if (part.type === "text") {
            content.push({ type: "text", text: part.text });
          } else if (part.type === "file") {
            if (!part.mediaType?.startsWith("image/")) {
              throw new UnsupportedFunctionalityError({
                functionality: `file input with media type '${part.mediaType}'`,
              });
            }
            content.push({
              type: "image_url",
              image_url: {
                url: convertDataToURL(part.data, part.mediaType),
              },
            });
          }
        }
        messages.push({ role: "user", content });
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