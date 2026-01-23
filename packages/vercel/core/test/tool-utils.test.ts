import { describe, it, expect } from "vitest";
import { isFunctionTool } from "../src/utils/tool-utils";
import type {
  LanguageModelV3FunctionTool,
  LanguageModelV3ProviderTool,
} from "@ai-sdk/provider";

describe("tool-utils", () => {
  describe("isFunctionTool", () => {
    it("returns true for function tools", () => {
      const tool: LanguageModelV3FunctionTool = {
        type: "function",
        name: "testFunction",
        inputSchema: {
          type: "object",
          properties: {},
        },
      };
      expect(isFunctionTool(tool)).toBe(true);
    });

    it("returns false for provider tools", () => {
      const tool: LanguageModelV3ProviderTool = {
        type: "provider",
        id: "custom.tool",
        name: "customTool",
        args: {},
      };
      expect(isFunctionTool(tool)).toBe(false);
    });

    it("correctly narrows type when true", () => {
      const tool: LanguageModelV3FunctionTool | LanguageModelV3ProviderTool = {
        type: "function",
        name: "test",
        inputSchema: {
          type: "object",
          properties: {},
        },
      };

      if (isFunctionTool(tool)) {
        // TypeScript should know this is a FunctionTool now
        expect(tool.name).toBe("test");
        expect(tool.inputSchema).toBeDefined();
      }
    });

    it("correctly narrows type when false", () => {
      const tool: LanguageModelV3FunctionTool | LanguageModelV3ProviderTool = {
        type: "provider",
        id: "test.tool",
        name: "test",
        args: {},
      };

      if (!isFunctionTool(tool)) {
        // TypeScript should know this is a ProviderTool now
        expect(tool.id).toBe("test.tool");
      }
    });
  });
});
