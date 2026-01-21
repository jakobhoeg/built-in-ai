import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BuiltInAITextAdapter, builtInAI } from "../src/adapters/text";
import type { StreamChunk, Tool } from "@tanstack/ai";

describe("BuiltInAITextAdapter", () => {
  let mockSession: any;
  let mockPrompt: ReturnType<typeof vi.fn>;
  let mockPromptStreaming: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPrompt = vi.fn();
    mockPromptStreaming = vi.fn();
    mockSession = {
      prompt: mockPrompt,
      promptStreaming: mockPromptStreaming,
      destroy: vi.fn(),
    };

    vi.mocked(LanguageModel.availability).mockResolvedValue("available");
    vi.mocked(LanguageModel.create).mockResolvedValue(mockSession);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("instantiation", () => {
    it("creates adapter with default model", () => {
      const adapter = builtInAI();
      expect(adapter).toBeInstanceOf(BuiltInAITextAdapter);
      expect(adapter.name).toBe("built-in-ai");
      expect(adapter.kind).toBe("text");
    });

    it("creates adapter with custom model", () => {
      const adapter = builtInAI("custom-model");
      expect(adapter).toBeInstanceOf(BuiltInAITextAdapter);
    });
  });

  describe("chatStream", () => {
    it("streams text response", async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue("Hello");
          controller.enqueue(" world");
          controller.close();
        },
      });
      mockPromptStreaming.mockReturnValue(mockStream);

      const adapter = builtInAI();
      const chunks: StreamChunk[] = [];

      for await (const chunk of adapter.chatStream({
        model: "text",
        messages: [{ role: "user", content: "Hi" }],
      })) {
        chunks.push(chunk);
      }

      const contentChunks = chunks.filter((c) => c.type === "content");
      expect(contentChunks.length).toBeGreaterThan(0);

      const doneChunk = chunks.find((c) => c.type === "done");
      expect(doneChunk?.finishReason).toBe("stop");
    });

    it("handles tool calls in stream", async () => {
      const response = `Let me check.
\`\`\`tool_call
{"name": "getWeather", "arguments": {"city": "NYC"}}
\`\`\``;
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(response);
          controller.close();
        },
      });
      mockPromptStreaming.mockReturnValue(mockStream);

      const weatherTool: Tool = {
        name: "getWeather",
        description: "Get weather",
      };

      const adapter = builtInAI();
      const chunks: StreamChunk[] = [];

      for await (const chunk of adapter.chatStream({
        model: "text",
        messages: [{ role: "user", content: "Weather?" }],
        tools: [weatherTool],
      })) {
        chunks.push(chunk);
      }

      const toolCallChunk = chunks.find((c) => c.type === "tool_call");
      expect(toolCallChunk).toBeDefined();
      expect(toolCallChunk?.toolCall?.function.name).toBe("getWeather");

      const doneChunk = chunks.find((c) => c.type === "done");
      expect(doneChunk?.finishReason).toBe("tool_calls");
    });

    it("passes temperature option", async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue("Hi");
          controller.close();
        },
      });
      mockPromptStreaming.mockReturnValue(mockStream);

      const adapter = builtInAI();
      const chunks: StreamChunk[] = [];

      for await (const chunk of adapter.chatStream({
        model: "text",
        messages: [{ role: "user", content: "Hi" }],
        temperature: 0.5,
      })) {
        chunks.push(chunk);
      }

      expect(mockPromptStreaming).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ temperature: 0.5 }),
      );
    });

    it("emits error chunk on failure", async () => {
      mockPromptStreaming.mockReturnValue(
        new ReadableStream({
          start(controller) {
            controller.error(new Error("API error"));
          },
        }),
      );

      const adapter = builtInAI();
      const chunks: StreamChunk[] = [];

      for await (const chunk of adapter.chatStream({
        model: "text",
        messages: [{ role: "user", content: "Hi" }],
      })) {
        chunks.push(chunk);
      }

      const errorChunk = chunks.find((c) => c.type === "error");
      expect(errorChunk).toBeDefined();
      expect(errorChunk?.error?.message).toContain("API error");
    });
  });

  describe("structuredOutput", () => {
    it("returns parsed JSON", async () => {
      mockPrompt.mockResolvedValue('{"name":"John","age":30}');

      const adapter = builtInAI();
      const result = await adapter.structuredOutput({
        chatOptions: {
          model: "text",
          messages: [{ role: "user", content: "Create person" }],
        },
        outputSchema: {
          type: "object",
          properties: { name: { type: "string" }, age: { type: "number" } },
        },
      });

      expect(result.data).toEqual({ name: "John", age: 30 });
      expect(result.rawText).toBe('{"name":"John","age":30}');
    });

    it("passes responseConstraint to session", async () => {
      mockPrompt.mockResolvedValue("{}");

      const schema = { type: "object", properties: {} };
      const adapter = builtInAI();

      await adapter.structuredOutput({
        chatOptions: {
          model: "text",
          messages: [{ role: "user", content: "Hi" }],
        },
        outputSchema: schema,
      });

      expect(mockPrompt).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ responseConstraint: schema }),
      );
    });
  });

  describe("availability", () => {
    it("returns availability status", async () => {
      const adapter = builtInAI();
      const status = await adapter.availability();

      expect(status).toBe("available");
    });
  });

  describe("destroySession", () => {
    it("destroys session", async () => {
      const adapter = builtInAI();

      // Create a session first
      const mockStream = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });
      mockPromptStreaming.mockReturnValue(mockStream);

      for await (const _ of adapter.chatStream({
        model: "text",
        messages: [{ role: "user", content: "Hi" }],
      })) {
        // consume stream
      }

      adapter.destroySession();
      expect(mockSession.destroy).toHaveBeenCalled();
    });
  });
});
