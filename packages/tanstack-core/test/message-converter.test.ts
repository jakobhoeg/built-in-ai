import { describe, it, expect } from "vitest";
import { convertMessagesAsync } from "../src/utils/message-converter";

describe("convertMessagesAsync", () => {
  describe("user messages", () => {
    it("converts string content", async () => {
      const result = await convertMessagesAsync([
        { role: "user", content: "Hello" },
      ]);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toMatchObject({
        role: "user",
        content: "Hello",
      });
    });

    it("converts text parts", async () => {
      const result = await convertMessagesAsync([
        {
          role: "user",
          content: [{ type: "text", content: "Hello" }],
        },
      ]);

      expect(result.messages[0].content).toBe("Hello");
    });

    it("handles null content", async () => {
      const result = await convertMessagesAsync([
        { role: "user", content: null },
      ]);

      expect(result.messages[0].content).toBe("");
    });
  });

  describe("assistant messages", () => {
    it("converts text content", async () => {
      const result = await convertMessagesAsync([
        { role: "assistant", content: "Response" },
      ]);

      expect(result.messages[0]).toMatchObject({
        role: "assistant",
        content: "Response",
      });
    });

    it("converts tool calls to fenced format", async () => {
      const result = await convertMessagesAsync([
        {
          role: "assistant",
          content: "Checking",
          toolCalls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "getWeather", arguments: '{"city":"NYC"}' },
            },
          ],
        },
      ]);

      expect(result.messages[0].content).toContain("Checking");
      expect(result.messages[0].content).toContain("```tool_call");
      expect(result.messages[0].content).toContain("getWeather");
    });
  });

  describe("tool messages", () => {
    it("converts to tool_result format", async () => {
      const result = await convertMessagesAsync([
        {
          role: "tool",
          toolCallId: "call_1",
          content: '{"temp": 72}',
        },
      ]);

      expect(result.messages[0].role).toBe("user");
      expect(result.messages[0].content).toContain("```tool_result");
      expect(result.messages[0].content).toContain("call_1");
    });
  });

  describe("system prompts", () => {
    it("combines system prompts", async () => {
      const result = await convertMessagesAsync(
        [{ role: "user", content: "Hi" }],
        ["Be helpful", "Be concise"],
      );

      expect(result.systemMessage).toBe("Be helpful\n\nBe concise");
    });

    it("handles no system prompts", async () => {
      const result = await convertMessagesAsync([
        { role: "user", content: "Hi" },
      ]);

      expect(result.systemMessage).toBeUndefined();
    });
  });

  describe("multimodal content", () => {
    it("converts image parts", async () => {
      const result = await convertMessagesAsync([
        {
          role: "user",
          content: [
            { type: "text", content: "What's this?" },
            {
              type: "image",
              source: { type: "data", value: "SGVsbG8=" },
            },
          ],
        },
      ]);

      const content = result.messages[0].content as any[];
      expect(content).toHaveLength(2);
      expect(content[0].type).toBe("text");
      expect(content[1].type).toBe("image");
    });

    it("converts audio parts", async () => {
      const result = await convertMessagesAsync([
        {
          role: "user",
          content: [
            {
              type: "audio",
              source: { type: "data", value: "QUFB" },
            },
          ],
        },
      ]);

      const content = result.messages[0].content as any[];
      expect(content[0].type).toBe("audio");
    });

    it("handles URL source", async () => {
      const result = await convertMessagesAsync([
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "url", value: "https://example.com/img.png" },
            },
          ],
        },
      ]);

      const content = result.messages[0].content as any[];
      expect(content[0].value).toBe("https://example.com/img.png");
    });
  });
});
