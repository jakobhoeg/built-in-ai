import { describe, it, expect } from "vitest";
import {
  hasMultimodalContent,
  getExpectedInputs,
  prependSystemPromptToMessages,
} from "../src/utils/prompt-utils";
import type { LanguageModelV2Prompt } from "@ai-sdk/provider";

describe("prompt-utils", () => {
  describe("hasMultimodalContent", () => {
    it("returns false for text-only prompt", () => {
      const prompt: LanguageModelV2Prompt = [
        { role: "user", content: [{ type: "text", text: "Hello" }] },
      ];
      expect(hasMultimodalContent(prompt)).toBe(false);
    });

    it("returns true when prompt contains image file", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "user",
          content: [
            { type: "text", text: "What's in this image?" },
            {
              type: "file",
              data: new Uint8Array(),
              mediaType: "image/png",
            },
          ],
        },
      ];
      expect(hasMultimodalContent(prompt)).toBe(true);
    });

    it("returns true when prompt contains audio file", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "user",
          content: [
            {
              type: "file",
              data: new Uint8Array(),
              mediaType: "audio/wav",
            },
          ],
        },
      ];
      expect(hasMultimodalContent(prompt)).toBe(true);
    });

    it("returns false when assistant has file (only checks user messages)", () => {
      const prompt: LanguageModelV2Prompt = [
        { role: "user", content: [{ type: "text", text: "Hello" }] },
        {
          role: "assistant",
          content: [
            {
              type: "file" as any, // This shouldn't happen but testing the logic
              data: new Uint8Array(),
              mediaType: "image/png",
            },
          ],
        },
      ];
      expect(hasMultimodalContent(prompt)).toBe(false);
    });
  });

  describe("getExpectedInputs", () => {
    it("returns empty array for text-only prompt", () => {
      const prompt: LanguageModelV2Prompt = [
        { role: "user", content: [{ type: "text", text: "Hello" }] },
      ];
      expect(getExpectedInputs(prompt)).toEqual([]);
    });

    it("returns image for image file", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "user",
          content: [
            {
              type: "file",
              data: new Uint8Array(),
              mediaType: "image/jpeg",
            },
          ],
        },
      ];
      expect(getExpectedInputs(prompt)).toEqual([{ type: "image" }]);
    });

    it("returns audio for audio file", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "user",
          content: [
            {
              type: "file",
              data: new Uint8Array(),
              mediaType: "audio/mp3",
            },
          ],
        },
      ];
      expect(getExpectedInputs(prompt)).toEqual([{ type: "audio" }]);
    });

    it("returns both image and audio when both present", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "user",
          content: [
            {
              type: "file",
              data: new Uint8Array(),
              mediaType: "image/png",
            },
            {
              type: "file",
              data: new Uint8Array(),
              mediaType: "audio/wav",
            },
          ],
        },
      ];
      const result = getExpectedInputs(prompt);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual({ type: "image" });
      expect(result).toContainEqual({ type: "audio" });
    });

    it("deduplicates multiple images", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "user",
          content: [
            {
              type: "file",
              data: new Uint8Array(),
              mediaType: "image/png",
            },
            {
              type: "file",
              data: new Uint8Array(),
              mediaType: "image/jpeg",
            },
          ],
        },
      ];
      expect(getExpectedInputs(prompt)).toEqual([{ type: "image" }]);
    });

    it("ignores files with unknown media types", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "user",
          content: [
            {
              type: "file",
              data: new Uint8Array(),
              mediaType: "application/pdf",
            },
          ],
        },
      ];
      expect(getExpectedInputs(prompt)).toEqual([]);
    });
  });

  describe("prependSystemPromptToMessages", () => {
    it("returns messages unchanged for empty system prompt", () => {
      const messages = [
        { role: "user", content: "Hello" },
      ] as LanguageModelMessage[];

      expect(prependSystemPromptToMessages(messages, "")).toEqual(messages);
      expect(prependSystemPromptToMessages(messages, "   ")).toEqual(messages);
    });

    it("prepends system prompt to string content user message", () => {
      const messages = [
        { role: "user", content: "Hello" },
      ] as LanguageModelMessage[];

      const result = prependSystemPromptToMessages(messages, "You are helpful");

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        role: "user",
        content: "You are helpful\n\nHello",
      });
    });

    it("prepends system prompt to array content user message", () => {
      const messages = [
        {
          role: "user",
          content: [{ type: "text", value: "Hello" }],
        },
      ] as LanguageModelMessage[];

      const result = prependSystemPromptToMessages(messages, "You are helpful");

      expect(result).toHaveLength(1);
      expect(result[0].content).toEqual([
        { type: "text", value: "You are helpful\n\n" },
        { type: "text", value: "Hello" },
      ]);
    });

    it("creates new user message if no user messages exist", () => {
      const messages = [
        { role: "assistant", content: "Hi there" },
      ] as LanguageModelMessage[];

      const result = prependSystemPromptToMessages(messages, "You are helpful");

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        role: "user",
        content: "You are helpful",
      });
      expect(result[1]).toMatchObject({
        role: "assistant",
        content: "Hi there",
      });
    });

    it("prepends to first user message when multiple exist", () => {
      const messages = [
        { role: "assistant", content: "Hello" },
        { role: "user", content: "First user" },
        { role: "user", content: "Second user" },
      ] as LanguageModelMessage[];

      const result = prependSystemPromptToMessages(messages, "Be helpful");

      expect(result).toHaveLength(3);
      expect(result[1]).toMatchObject({
        role: "user",
        content: "Be helpful\n\nFirst user",
      });
      expect(result[2]).toMatchObject({
        role: "user",
        content: "Second user",
      });
    });

    it("does not mutate original messages array", () => {
      const messages = [
        { role: "user", content: "Hello" },
      ] as LanguageModelMessage[];

      const original = JSON.stringify(messages);
      prependSystemPromptToMessages(messages, "System");

      expect(JSON.stringify(messages)).toBe(original);
    });
  });
});
