import { describe, it, expect } from "vitest";
import { buildJsonToolSystemPrompt } from "../src/tool-calling/build-json-system-prompt";
import type { LanguageModelV2FunctionTool } from "@ai-sdk/provider";
import { z } from "zod";

describe("buildJsonToolSystemPrompt", () => {
  describe("with no tools", () => {
    it("should return empty string when no tools and no system prompt", () => {
      const result = buildJsonToolSystemPrompt(undefined, []);
      expect(result).toBe("");
    });

    it("should return original system prompt when no tools", () => {
      const systemPrompt = "You are a helpful assistant.";
      const result = buildJsonToolSystemPrompt(systemPrompt, []);
      expect(result).toBe(systemPrompt);
    });

    it("should handle empty array", () => {
      const result = buildJsonToolSystemPrompt("Test prompt", []);
      expect(result).toBe("Test prompt");
    });
  });

  describe("with tools", () => {
    const mockTool: LanguageModelV2FunctionTool = {
      type: "function",
      name: "getWeather",
      description: "Get the weather for a location",
      inputSchema: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "The city name",
          },
        },
        required: ["location"],
      } as any,
    };

    it("should include tool schema in prompt", () => {
      const result = buildJsonToolSystemPrompt(undefined, [mockTool]);

      expect(result).toContain("getWeather");
      expect(result).toContain("Get the weather for a location");
      expect(result).toContain('"location"');
    });

    it("should include JSON tool calling instructions", () => {
      const result = buildJsonToolSystemPrompt(undefined, [mockTool]);

      expect(result).toContain("```tool_call");
      expect(result).toContain(
        "You are a helpful AI assistant with access to tools",
      );
      expect(result).toContain("Available Tools");
      expect(result).toContain("Tool Calling Instructions");
    });

    it("should append to existing system prompt", () => {
      const originalPrompt = "You are an expert assistant.";
      const result = buildJsonToolSystemPrompt(originalPrompt, [mockTool]);

      expect(result).toContain(originalPrompt);
      expect(result).toContain("getWeather");
      expect(result.indexOf(originalPrompt)).toBeLessThan(
        result.indexOf("getWeather"),
      );
    });

    it("should handle tools without description", () => {
      const toolWithoutDescription: LanguageModelV2FunctionTool = {
        type: "function",
        name: "testTool",
        inputSchema: {
          type: "object",
          properties: {},
        } as any,
      };

      const result = buildJsonToolSystemPrompt(undefined, [
        toolWithoutDescription,
      ]);

      expect(result).toContain("testTool");
      expect(result).toContain("No description provided");
    });

    it("should handle multiple tools", () => {
      const tool1: LanguageModelV2FunctionTool = {
        type: "function",
        name: "search",
        description: "Search the web",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
        } as any,
      };

      const tool2: LanguageModelV2FunctionTool = {
        type: "function",
        name: "calculate",
        description: "Perform calculations",
        inputSchema: {
          type: "object",
          properties: {
            expression: { type: "string" },
          },
        } as any,
      };

      const result = buildJsonToolSystemPrompt(undefined, [tool1, tool2]);

      expect(result).toContain("search");
      expect(result).toContain("calculate");
      expect(result).toContain("Search the web");
      expect(result).toContain("Perform calculations");
    });
  });

  describe("parallel tool calls option", () => {
    const mockTool: LanguageModelV2FunctionTool = {
      type: "function",
      name: "testTool",
      description: "A test tool",
      inputSchema: {
        type: "object",
        properties: {},
      } as any,
    };

    it("should include sequential instruction by default", () => {
      const result = buildJsonToolSystemPrompt(undefined, [mockTool]);

      expect(result).toContain("Only request one tool call at a time");
      expect(result).toContain(
        "Wait for tool results before asking for another",
      );
    });

    it("should include sequential instruction when explicitly disabled", () => {
      const result = buildJsonToolSystemPrompt(undefined, [mockTool], {
        allowParallelToolCalls: false,
      });

      expect(result).toContain("Only request one tool call at a time");
      expect(result).not.toContain(
        "You may return multiple tool calls in the array",
      );
    });

    it("should include parallel instruction when enabled", () => {
      const result = buildJsonToolSystemPrompt(undefined, [mockTool], {
        allowParallelToolCalls: true,
      });

      expect(result).toContain(
        "You may return multiple tool calls in the array",
      );
      expect(result).toContain(
        "if they are independent and can be executed in parallel",
      );
      expect(result).not.toContain("Only request one tool call at a time");
    });

    it("should include parallel example when enabled", () => {
      const result = buildJsonToolSystemPrompt(undefined, [mockTool], {
        allowParallelToolCalls: true,
      });

      expect(result).toContain("For multiple parallel calls:");
      expect(result).toContain('{"name": "tool1"');
      expect(result).toContain('{"name": "tool2"');
    });

    it("should not include parallel example when disabled", () => {
      const result = buildJsonToolSystemPrompt(undefined, [mockTool], {
        allowParallelToolCalls: false,
      });

      expect(result).not.toContain("For multiple parallel calls:");
    });
  });

  describe("tool result format", () => {
    const mockTool: LanguageModelV2FunctionTool = {
      type: "function",
      name: "test",
      inputSchema: { type: "object", properties: {} } as any,
    };

    it("should describe tool result format", () => {
      const result = buildJsonToolSystemPrompt(undefined, [mockTool]);

      expect(result).toContain("```tool_result");
      expect(result).toContain('"id": "call_123"');
      expect(result).toContain('"name": "tool_name"');
      expect(result).toContain('"result":');
      expect(result).toContain('"error": false');
    });

    it("should explain how to use results", () => {
      const result = buildJsonToolSystemPrompt(undefined, [mockTool]);

      expect(result).toContain("Use the `result` payload");
      expect(result).toContain("treat `error` as a boolean flag");
      expect(result).toContain("when continuing the conversation");
    });
  });

  describe("important instructions", () => {
    const mockTool: LanguageModelV2FunctionTool = {
      type: "function",
      name: "test",
      inputSchema: { type: "object", properties: {} } as any,
    };

    it("should include important usage guidelines", () => {
      const result = buildJsonToolSystemPrompt(undefined, [mockTool]);

      expect(result).toContain("Important:");
      expect(result).toContain("Use exact tool and parameter names");
      expect(result).toContain("Arguments must be a valid JSON object");
      expect(result).toContain("You can include brief reasoning");
      expect(result).toContain("If no tool is needed, respond directly");
    });
  });

  describe("tool schema formatting", () => {
    it("should format complex schemas correctly", () => {
      const complexTool: LanguageModelV2FunctionTool = {
        type: "function",
        name: "complexTool",
        description: "A complex tool",
        inputSchema: {
          type: "object",
          properties: {
            stringParam: {
              type: "string",
              description: "A string parameter",
            },
            numberParam: {
              type: "number",
              description: "A number parameter",
            },
            arrayParam: {
              type: "array",
              items: { type: "string" },
              description: "An array parameter",
            },
            objectParam: {
              type: "object",
              properties: {
                nested: { type: "string" },
              },
            },
          },
          required: ["stringParam", "numberParam"],
        } as any,
      };

      const result = buildJsonToolSystemPrompt(undefined, [complexTool]);

      expect(result).toContain("complexTool");
      expect(result).toContain("stringParam");
      expect(result).toContain("numberParam");
      expect(result).toContain("arrayParam");
      expect(result).toContain("objectParam");
    });

    it("should handle tool with empty parameters", () => {
      const emptyTool: LanguageModelV2FunctionTool = {
        type: "function",
        name: "noParams",
        description: "Tool with no parameters",
        inputSchema: {
          type: "object",
          properties: {},
        } as any,
      };

      const result = buildJsonToolSystemPrompt(undefined, [emptyTool]);

      expect(result).toContain("noParams");
      expect(result).toContain("Tool with no parameters");
    });

    it("should handle tool without inputSchema", () => {
      const noSchemaTool: LanguageModelV2FunctionTool = {
        type: "function",
        name: "noSchema",
        description: "Tool without schema",
      } as any;

      const result = buildJsonToolSystemPrompt(undefined, [noSchemaTool]);

      expect(result).toContain("noSchema");
      expect(result).toContain("Tool without schema");
    });
  });

  describe("prompt trimming", () => {
    it("should trim whitespace from original prompt", () => {
      const promptWithWhitespace = "  Test prompt  \n\n";
      const mockTool: LanguageModelV2FunctionTool = {
        type: "function",
        name: "test",
        inputSchema: { type: "object", properties: {} } as any,
      };

      const result = buildJsonToolSystemPrompt(promptWithWhitespace, [
        mockTool,
      ]);

      expect(result).toContain("Test prompt");
      expect(result.startsWith("Test prompt")).toBe(true);
      expect(result).not.toMatch(/^\s+/);
    });

    it("should handle empty string prompt", () => {
      const mockTool: LanguageModelV2FunctionTool = {
        type: "function",
        name: "test",
        inputSchema: { type: "object", properties: {} } as any,
      };

      const result = buildJsonToolSystemPrompt("", [mockTool]);

      // Should not have the original prompt section if it's empty
      expect(result).toContain("You are a helpful AI assistant");
      expect(result.startsWith("You are a helpful AI assistant")).toBe(true);
    });

    it("should handle whitespace-only prompt", () => {
      const mockTool: LanguageModelV2FunctionTool = {
        type: "function",
        name: "test",
        inputSchema: { type: "object", properties: {} } as any,
      };

      const result = buildJsonToolSystemPrompt("   \n\n  ", [mockTool]);

      expect(result.startsWith("You are a helpful AI assistant")).toBe(true);
    });
  });
});
