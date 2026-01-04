/**
 * Message converter for TanStack AI SDK to Browser Prompt API format
 * Supports text, image, audio, and tool-related message content
 */

import type {
  TextOptions,
  ModelMessage,
  TextPart,
  ImagePart,
  AudioPart,
  ContentPartSource,
  ContentPart as TanStackContentPart,
} from "@tanstack/ai";

/**
 * Text content part with "text" field (alternative format)
 * TanStack's TextPart uses "content" field instead
 */
interface TextContentPart {
  type: "text";
  text: string;
}

/**
 * Extended content part type that includes both TanStack types
 * and alternative formats we may encounter
 */
type ContentPart = TanStackContentPart | TextContentPart | { type: string };

/**
 * Convert base64 string to Uint8Array for built-in AI compatibility
 * The Prompt API supports BufferSource (including Uint8Array) for image/audio data
 */
function convertBase64ToUint8Array(base64: string): Uint8Array {
  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    throw new Error(`Failed to convert base64 to Uint8Array: ${error}`);
  }
}

/**
 * Convert source data to the appropriate format for built-in AI
 * Built-in AI supports: Blob, BufferSource (Uint8Array), URLs as strings
 */
function convertSourceData(source: ContentPartSource): Uint8Array | string {
  if (source.type === "url") {
    // URLs are kept as strings
    return source.value;
  }

  // Base64 data - convert to Uint8Array
  return convertBase64ToUint8Array(source.value);
}

/**
 * Result of message conversion
 */
export interface ConvertedMessages {
  systemMessage?: string;
  messages: LanguageModelMessage[];
}

/**
 * Async version of convertMessages
 *
 * @param messages - TanStack AI SDK messages
 * @param systemPrompts - Optional system prompts from TextOptions
 * @returns Converted messages in LanguageModelMessage format
 */
export async function convertMessagesAsync(
  messages: TextOptions["messages"],
  systemPrompts?: Array<string>,
): Promise<ConvertedMessages> {
  let systemMessage: string | undefined;

  // Combine system prompts if provided
  if (systemPrompts && systemPrompts.length > 0) {
    systemMessage = systemPrompts.join("\n\n");
  }

  const convertedMessages: LanguageModelMessage[] = [];

  for (const msg of messages as ModelMessage[]) {
    switch (msg.role) {
      case "user": {
        const content = convertContent(msg.content);
        convertedMessages.push({
          role: "user",
          content,
        } as LanguageModelMessage);
        break;
      }

      case "assistant": {
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          const textContent = extractTextContent(msg.content);
          const toolCallsText = msg.toolCalls
            .map((tc) => {
              return `\`\`\`tool_call\n${JSON.stringify({ name: tc.function.name, arguments: JSON.parse(tc.function.arguments) })}\n\`\`\``;
            })
            .join("\n\n");

          const combinedContent = textContent
            ? `${textContent}\n\n${toolCallsText}`
            : toolCallsText;

          convertedMessages.push({
            role: "assistant",
            content: combinedContent,
          } as LanguageModelMessage);
        } else {
          const textContent = extractTextContent(msg.content);
          convertedMessages.push({
            role: "assistant",
            content: textContent,
          } as LanguageModelMessage);
        }
        break;
      }

      case "tool": {
        const resultContent =
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content);

        const formattedResult = `\`\`\`tool_result\n${JSON.stringify({
          id: msg.toolCallId,
          name: "tool",
          result: JSON.parse(resultContent),
          error: false,
        })}\n\`\`\``;

        convertedMessages.push({
          role: "user",
          content: formattedResult,
        } as LanguageModelMessage);
        break;
      }
    }
  }

  return { systemMessage, messages: convertedMessages };
}

/**
 * Converts content to Prompt API format
 * Returns string for text-only messages, array for multimodal messages
 */
function convertContent(
  content: string | null | Array<ContentPart>,
): string | LanguageModelMessageContent[] {
  if (content === null) {
    return "";
  }

  if (typeof content === "string") {
    return content;
  }

  const convertedParts: LanguageModelMessageContent[] = [];

  for (const part of content) {
    switch (part.type) {
      case "text": {
        // Handle both alternative format (text) and TanStack format (content)
        const textValue =
          "text" in part ? part.text : (part as TextPart).content;
        convertedParts.push({
          type: "text",
          value: textValue,
        } as LanguageModelMessageContent);
        break;
      }

      case "image": {
        const imagePart = part as ImagePart;
        const convertedData = convertSourceData(imagePart.source);
        convertedParts.push({
          type: "image",
          value: convertedData,
        } as LanguageModelMessageContent);
        break;
      }

      case "audio": {
        const audioPart = part as AudioPart;
        const convertedData = convertSourceData(audioPart.source);
        convertedParts.push({
          type: "audio",
          value: convertedData,
        } as LanguageModelMessageContent);
        break;
      }

      // Skip tool-call, tool-result, and other unknown part types
      default:
        break;
    }
  }

  // If we only have text content, we can return just the string
  // Otherwise return the full multimodal array
  if (convertedParts.length === 1 && convertedParts[0].type === "text") {
    return (convertedParts[0] as { type: "text"; value: string }).value;
  }

  return convertedParts.length > 0 ? convertedParts : "";
}

/**
 * Extracts text content from message content
 */
function extractTextContent(
  content: string | null | Array<ContentPart>,
): string {
  if (content === null) {
    return "";
  }

  if (typeof content === "string") {
    return content;
  }

  // Extract text from content parts
  return content
    .filter((part): part is TextContentPart | TextPart => part.type === "text")
    .map((part) => {
      // Handle both alternative format (text) and TanStack format (content)
      if ("text" in part) {
        return part.text;
      }
      return (part as TextPart).content;
    })
    .join("");
}
