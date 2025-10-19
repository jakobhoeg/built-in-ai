import { describe, it, expect } from "vitest";
import { convertToTransformersMessages } from "../src/chat/convert-to-transformers-message";
import {
  UnsupportedFunctionalityError,
  type LanguageModelV2Prompt,
} from "@ai-sdk/provider";

describe("convertToTransformersMessages", () => {
  it("converts simple text user message", () => {
    const prompt: LanguageModelV2Prompt = [
      { role: "user", content: [{ type: "text", text: "Hello" }] },
    ];

    const result = convertToTransformersMessages(prompt);
    expect(result).toEqual([{ role: "user", content: "Hello" }]);
  });

  it("converts assistant text message", () => {
    const prompt: LanguageModelV2Prompt = [
      { role: "assistant", content: [{ type: "text", text: "Hi" }] },
    ];

    const result = convertToTransformersMessages(prompt);
    expect(result).toEqual([{ role: "assistant", content: "Hi" }]);
  });

  it("keeps system content as-is", () => {
    const prompt: LanguageModelV2Prompt = [
      { role: "system", content: "You are helpful." },
    ];

    const result = convertToTransformersMessages(prompt);
    expect(result).toEqual([{ role: "system", content: "You are helpful." }]);
  });

  it("throws for non-vision file input in user message", () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: "user",
        content: [
          { type: "text", text: "See this" },
          { type: "file", mediaType: "image/png", data: "AAA" },
        ],
      },
    ];
    expect(() => convertToTransformersMessages(prompt)).toThrow(
      UnsupportedFunctionalityError,
    );
  });

  it("converts image content when isVisionModel=true", () => {
    const base64 = "SGVsbG8="; // Hello
    const prompt: LanguageModelV2Prompt = [
      {
        role: "user",
        content: [
          { type: "text", text: "What is in this image?" },
          { type: "file", mediaType: "image/png", data: base64 },
          { type: "text", text: "Thanks" },
        ],
      },
    ];

    const result = convertToTransformersMessages(prompt, true);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
    expect(Array.isArray(result[0].content)).toBe(true);
    const parts = result[0].content as any[];
    expect(parts).toEqual([
      { type: "text", text: "What is in this image?" },
      {
        type: "image",
        image: `data:image/png;base64,${base64}`,
      },
      { type: "text", text: "Thanks" },
    ]);
  });

  it("converts tool role to user message with fence format", () => {
    const prompt = [
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "call_123",
            toolName: "get_weather",
            output: { type: "text", value: "72°F and sunny" },
          },
        ],
      },
    ] as any;
    const result = convertToTransformersMessages(prompt);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
    expect(result[0].content).toContain("```tool_result");
    expect(result[0].content).toContain("call_123");
    expect(result[0].content).toContain("get_weather");
  });

  it("converts assistant tool-call content to fence format", () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "call_456",
            toolName: "calculate",
            input: { x: 5, y: 10 },
          } as any,
        ],
      },
    ];
    const result = convertToTransformersMessages(prompt);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("assistant");
    expect(result[0].content).toContain("```tool_call");
    expect(result[0].content).toContain("calculate");
  });
});
