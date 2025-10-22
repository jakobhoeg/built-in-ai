import { describe, it, expect } from "vitest";
import { isFunctionTool } from "../src/utils/tool-utils";
import type {
  LanguageModelV2FunctionTool,
  LanguageModelV2ProviderDefinedTool,
} from "@ai-sdk/provider";

describe("tool-utils", () => {
  describe("isFunctionTool", () => {
    it("returns true for function tools", () => {
      const tool: LanguageModelV2FunctionTool = {
        type: "function",
        name: "testFunction",
        inputSchema: {
          type: "object",
          properties: {},
        },
      };
      expect(isFunctionTool(tool)).toBe(true);
    });

    it("returns false for provider-defined tools", () => {
      const tool: LanguageModelV2ProviderDefinedTool = {
        type: "provider-defined",
        id: "custom.tool",
        name: "customTool",
        args: {},
      };
      expect(isFunctionTool(tool)).toBe(false);
    });

    it("correctly narrows type when true", () => {
      const tool:
        | LanguageModelV2FunctionTool
        | LanguageModelV2ProviderDefinedTool = {
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
      const tool:
        | LanguageModelV2FunctionTool
        | LanguageModelV2ProviderDefinedTool = {
        type: "provider-defined",
        id: "test.tool",
        name: "test",
        args: {},
      };

      if (!isFunctionTool(tool)) {
        // TypeScript should know this is a ProviderDefinedTool now
        expect(tool.id).toBe("test.tool");
      }
    });
  });
});
