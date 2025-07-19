import { describe, it, expect } from "vitest";
import { convertToBuiltInAIMessages } from "../src/convert-to-built-in-ai-messages";
import {
  LanguageModelV2Prompt,
  LanguageModelV2Message,
  UnsupportedFunctionalityError,
} from "@ai-sdk/provider";

describe("convertToBuiltInAIMessages", () => {
  describe("text messages", () => {
    it("should convert simple text user message", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "user",
          content: [{ type: "text", text: "Hello, world!" }],
        },
      ];

      const result = convertToBuiltInAIMessages(prompt);

      expect(result.systemMessage).toBeUndefined();
      expect(result.messages).toEqual([
        {
          role: "user",
          content: [{ type: "text", value: "Hello, world!" }],
        },
      ]);
    });

    it("should extract system message", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "system",
          content: "You are a helpful assistant.",
        },
        {
          role: "user",
          content: [{ type: "text", text: "Hello!" }],
        },
      ];

      const result = convertToBuiltInAIMessages(prompt);

      expect(result.systemMessage).toBe("You are a helpful assistant.");
      expect(result.messages).toEqual([
        {
          role: "user",
          content: [{ type: "text", value: "Hello!" }],
        },
      ]);
    });

    it("should convert assistant messages", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "user",
          content: [{ type: "text", text: "Hello!" }],
        },
        {
          role: "assistant",
          content: [{ type: "text", text: "Hi there!" }],
        },
      ];

      const result = convertToBuiltInAIMessages(prompt);

      expect(result.messages).toEqual([
        {
          role: "user",
          content: [{ type: "text", value: "Hello!" }],
        },
        {
          role: "assistant",
          content: "Hi there!",
        },
      ]);
    });
  });

  describe("image file conversion", () => {
    it("should convert base64 image data to Uint8Array", () => {
      const base64Data = "SGVsbG8gV29ybGQ="; // "Hello World" in base64
      const prompt: LanguageModelV2Prompt = [
        {
          role: "user",
          content: [
            { type: "text", text: "What's in this image?" },
            {
              type: "file",
              mediaType: "image/png",
              data: base64Data,
            },
          ],
        },
      ];

      const result = convertToBuiltInAIMessages(prompt);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toHaveLength(2);
      expect(result.messages[0].content[0]).toEqual({
        type: "text",
        value: "What's in this image?",
      });

      const imageContent = result.messages[0].content[1] as any;
      expect(imageContent.type).toBe("image");
      expect(imageContent.value).toBeInstanceOf(Uint8Array);

      // Verify the conversion worked correctly
      const expectedBytes = new Uint8Array([
        72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100,
      ]);
      expect(imageContent.value).toEqual(expectedBytes);
    });

    it("should handle Uint8Array image data directly", () => {
      const uint8Data = new Uint8Array([1, 2, 3, 4]);
      const prompt: LanguageModelV2Prompt = [
        {
          role: "user",
          content: [
            {
              type: "file",
              mediaType: "image/jpeg",
              data: uint8Data,
            },
          ],
        },
      ];

      const result = convertToBuiltInAIMessages(prompt);

      expect(result.messages[0].content[0]).toEqual({
        type: "image",
        value: uint8Data,
      });
    });

    it("should handle URL image data", () => {
      const imageUrl = new URL("https://example.com/image.png");
      const prompt: LanguageModelV2Prompt = [
        {
          role: "user",
          content: [
            {
              type: "file",
              mediaType: "image/webp",
              data: imageUrl,
            },
          ],
        },
      ];

      const result = convertToBuiltInAIMessages(prompt);

      expect(result.messages[0].content[0]).toEqual({
        type: "image",
        value: "https://example.com/image.png",
      });
    });
  });

  describe("audio file conversion", () => {
    it("should convert base64 audio data to Uint8Array", () => {
      const base64Data = "UklGRnQAAABXQVZF"; // Valid WAV header start in base64
      const prompt: LanguageModelV2Prompt = [
        {
          role: "user",
          content: [
            { type: "text", text: "What's in this audio?" },
            {
              type: "file",
              mediaType: "audio/wav",
              data: base64Data,
            },
          ],
        },
      ];

      const result = convertToBuiltInAIMessages(prompt);

      expect(result.messages[0].content[1]).toEqual({
        type: "audio",
        value: expect.any(Uint8Array),
      });
    });

    it("should handle Uint8Array audio data directly", () => {
      const audioData = new Uint8Array([82, 73, 70, 70]); // "RIFF" header
      const prompt: LanguageModelV2Prompt = [
        {
          role: "user",
          content: [
            {
              type: "file",
              mediaType: "audio/mp3",
              data: audioData,
            },
          ],
        },
      ];

      const result = convertToBuiltInAIMessages(prompt);

      expect(result.messages[0].content[0]).toEqual({
        type: "audio",
        value: audioData,
      });
    });
  });

  describe("mixed content", () => {
    it("should handle mixed text, image, and audio content", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this:" },
            {
              type: "file",
              mediaType: "image/png",
              data: "SGVsbG8=", // "Hello" in base64
            },
            { type: "text", text: "And this audio:" },
            {
              type: "file",
              mediaType: "audio/wav",
              data: new Uint8Array([1, 2, 3]),
            },
          ],
        },
      ];

      const result = convertToBuiltInAIMessages(prompt);

      expect(result.messages[0].content).toHaveLength(4);
      expect(result.messages[0].content[0]).toEqual({
        type: "text",
        value: "Analyze this:",
      });
      expect(result.messages[0].content[1]).toEqual({
        type: "image",
        value: expect.any(Uint8Array),
      });
      expect(result.messages[0].content[2]).toEqual({
        type: "text",
        value: "And this audio:",
      });
      expect(result.messages[0].content[3]).toEqual({
        type: "audio",
        value: new Uint8Array([1, 2, 3]),
      });
    });
  });

  describe("error handling", () => {
    it("should throw for unsupported file types", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "user",
          content: [
            {
              type: "file",
              mediaType: "video/mp4",
              data: "some data",
            },
          ],
        },
      ];

      expect(() => convertToBuiltInAIMessages(prompt)).toThrow(
        UnsupportedFunctionalityError,
      );
    });

    it("should throw for unsupported content types", () => {
      const prompt = [
        {
          role: "user",
          content: [
            {
              type: "unsupported" as any,
              data: "some data",
            },
          ],
        },
      ] as LanguageModelV2Prompt;

      expect(() => convertToBuiltInAIMessages(prompt)).toThrow(
        UnsupportedFunctionalityError,
      );
    });

    it("should throw for invalid base64 data", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "user",
          content: [
            {
              type: "file",
              mediaType: "image/png",
              data: "invalid-base64-data!@#",
            },
          ],
        },
      ];

      expect(() => convertToBuiltInAIMessages(prompt)).toThrow();
    });
  });

  describe("edge cases", () => {
    it("should handle empty prompt", () => {
      const result = convertToBuiltInAIMessages([]);

      expect(result.systemMessage).toBeUndefined();
      expect(result.messages).toEqual([]);
    });

    it("should handle empty content arrays", () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: "user",
          content: [],
        },
      ];

      const result = convertToBuiltInAIMessages(prompt);

      expect(result.messages).toEqual([
        {
          role: "user",
          content: [],
        },
      ]);
    });
  });
});
