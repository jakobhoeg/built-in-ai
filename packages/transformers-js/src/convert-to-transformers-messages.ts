import { LanguageModelV2Prompt, UnsupportedFunctionalityError } from "@ai-sdk/provider";

export function convertPromptToMessages(prompt: LanguageModelV2Prompt): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];

  for (const message of prompt) {
    switch (message.role) {
      case "system":
        messages.push({
          role: "system",
          content: (message.content as any)?.toString?.() ?? "",
        });
        break;
      case "user":
        const userContent: string[] = [];
        for (const part of message.content) {
          if (typeof part === "string") {
            userContent.push(part);
          } else if (part.type === "text") {
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
        break;
      case "assistant":
        let assistantContent = "";
        for (const part of message.content) {
          if (typeof part === "string") {
            assistantContent += part;
          } else if (part.type === "text") {
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