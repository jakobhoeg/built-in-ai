import { describe, it, expect } from "vitest";
import {
  formatToolResults,
  formatSingleToolResult,
} from "../src/tool-calling/format-tool-results";
import type { ToolResult } from "../src/tool-calling/types";

describe("format-tool-results", () => {
  describe("formatToolResults", () => {
    it("should return empty string for empty array", () => {
      const result = formatToolResults([]);
      expect(result).toBe("");
    });

    it("should return empty string for undefined", () => {
      const result = formatToolResults(undefined as any);
      expect(result).toBe("");
    });

    it("should format a single tool result", () => {
      const results: ToolResult[] = [
        {
          toolCallId: "call_123",
          toolName: "search",
          result: { data: "test result" },
          isError: false,
        },
      ];

      const formatted = formatToolResults(results);

      expect(formatted).toContain("```tool_result");
      expect(formatted).toContain('"id":"call_123"');
      expect(formatted).toContain('"name":"search"');
      expect(formatted).toContain('"result":{"data":"test result"}');
      expect(formatted).toContain('"error":false');
      expect(formatted).toContain("```");
    });

    it("should format multiple tool results on separate lines", () => {
      const results: ToolResult[] = [
        {
          toolCallId: "call_1",
          toolName: "tool1",
          result: { value: 1 },
          isError: false,
        },
        {
          toolCallId: "call_2",
          toolName: "tool2",
          result: { value: 2 },
          isError: false,
        },
      ];

      const formatted = formatToolResults(results);

      expect(formatted).toContain("```tool_result");
      expect(formatted).toContain('"id":"call_1"');
      expect(formatted).toContain('"id":"call_2"');
      expect(formatted).toContain('"name":"tool1"');
      expect(formatted).toContain('"name":"tool2"');

      // Check that they're on separate lines
      const lines = formatted.split("\n");
      expect(lines.length).toBeGreaterThan(2); // More than just opening and closing fence
    });

    it("should handle error results", () => {
      const results: ToolResult[] = [
        {
          toolCallId: "call_error",
          toolName: "failingTool",
          result: { error: "Something went wrong" },
          isError: true,
        },
      ];

      const formatted = formatToolResults(results);

      expect(formatted).toContain('"error":true');
      expect(formatted).toContain('"result":{"error":"Something went wrong"}');
    });

    it("should handle null result", () => {
      const results: ToolResult[] = [
        {
          toolCallId: "call_null",
          toolName: "emptyTool",
          result: null,
          isError: false,
        },
      ];

      const formatted = formatToolResults(results);

      expect(formatted).toContain('"result":null');
      expect(formatted).toContain('"error":false');
    });

    it("should handle undefined result", () => {
      const results: ToolResult[] = [
        {
          toolCallId: "call_undefined",
          toolName: "undefinedTool",
          result: undefined,
          isError: false,
        },
      ];

      const formatted = formatToolResults(results);

      expect(formatted).toContain('"result":null');
    });

    it("should include toolCallId when present", () => {
      const results: ToolResult[] = [
        {
          toolCallId: "call_with_id",
          toolName: "tool",
          result: {},
          isError: false,
        },
      ];

      const formatted = formatToolResults(results);

      expect(formatted).toContain('"id":"call_with_id"');
    });

    it("should omit id field when toolCallId is not present", () => {
      const results: ToolResult[] = [
        {
          toolName: "tool",
          result: {},
          isError: false,
        },
      ];

      const formatted = formatToolResults(results);

      expect(formatted).not.toContain('"id"');
      expect(formatted).toContain('"name":"tool"');
    });

    it("should handle complex nested result objects", () => {
      const results: ToolResult[] = [
        {
          toolCallId: "call_complex",
          toolName: "complexTool",
          result: {
            nested: {
              data: [1, 2, 3],
              info: { key: "value" },
            },
            array: ["a", "b", "c"],
          },
          isError: false,
        },
      ];

      const formatted = formatToolResults(results);

      expect(formatted).toContain('"name":"complexTool"');
      expect(formatted).toContain('"nested"');
      expect(formatted).toContain('"data":[1,2,3]');
      expect(formatted).toContain('"array":["a","b","c"]');
    });

    it("should properly format code fence", () => {
      const results: ToolResult[] = [
        {
          toolName: "test",
          result: {},
          isError: false,
        },
      ];

      const formatted = formatToolResults(results);

      expect(formatted).toMatch(/^```tool_result\n/);
      expect(formatted).toMatch(/\n```$/);
    });
  });

  describe("formatSingleToolResult", () => {
    it("should format a single result using formatToolResults", () => {
      const result: ToolResult = {
        toolCallId: "call_single",
        toolName: "singleTool",
        result: { value: "test" },
        isError: false,
      };

      const formatted = formatSingleToolResult(result);

      expect(formatted).toContain("```tool_result");
      expect(formatted).toContain('"id":"call_single"');
      expect(formatted).toContain('"name":"singleTool"');
      expect(formatted).toContain('"result":{"value":"test"}');
      expect(formatted).toContain("```");
    });

    it("should handle error result", () => {
      const result: ToolResult = {
        toolName: "errorTool",
        result: "Error message",
        isError: true,
      };

      const formatted = formatSingleToolResult(result);

      expect(formatted).toContain('"error":true');
      expect(formatted).toContain('"result":"Error message"');
    });

    it("should wrap single result in array format", () => {
      const result: ToolResult = {
        toolName: "test",
        result: {},
        isError: false,
      };

      const formatted = formatSingleToolResult(result);

      // Should only have one result line (plus opening and closing fence)
      const lines = formatted.split("\n");
      const jsonLines = lines.filter(
        (line) => !line.includes("```") && line.trim() !== "",
      );
      expect(jsonLines.length).toBe(1);
    });
  });

  describe("JSON validity", () => {
    it("should produce valid JSON for each result line", () => {
      const results: ToolResult[] = [
        {
          toolCallId: "call_1",
          toolName: "tool1",
          result: { data: "test" },
          isError: false,
        },
        {
          toolCallId: "call_2",
          toolName: "tool2",
          result: { data: "test2" },
          isError: false,
        },
      ];

      const formatted = formatToolResults(results);
      const lines = formatted.split("\n");

      // Extract JSON lines (skip the fence lines)
      const jsonLines = lines.filter(
        (line) => !line.includes("```") && line.trim() !== "",
      );

      // Each line should be valid JSON
      jsonLines.forEach((line) => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });

    it("should have correct structure when parsed", () => {
      const results: ToolResult[] = [
        {
          toolCallId: "call_test",
          toolName: "testTool",
          result: { key: "value" },
          isError: false,
        },
      ];

      const formatted = formatToolResults(results);
      const lines = formatted.split("\n");
      const jsonLine = lines.find(
        (line) => !line.includes("```") && line.trim() !== "",
      );

      const parsed = JSON.parse(jsonLine!);

      expect(parsed).toMatchObject({
        id: "call_test",
        name: "testTool",
        result: { key: "value" },
        error: false,
      });
    });
  });
});
