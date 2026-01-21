import { describe, it, expect } from "vitest";
import {
  formatToolResults,
  formatSingleToolResult,
} from "../src/tool-calling/format-tool-results";

describe("formatToolResults", () => {
  it("formats single result", () => {
    const result = formatToolResults([
      {
        toolCallId: "call_1",
        toolName: "getWeather",
        result: { temp: 72 },
        isError: false,
      },
    ]);

    expect(result).toContain("```tool_result");
    expect(result).toContain('"name":"getWeather"');
    expect(result).toContain('"id":"call_1"');
    expect(result).toContain('"error":false');
  });

  it("formats multiple results", () => {
    const result = formatToolResults([
      { toolCallId: "1", toolName: "tool1", result: "a", isError: false },
      { toolCallId: "2", toolName: "tool2", result: "b", isError: false },
    ]);

    expect(result).toContain("tool1");
    expect(result).toContain("tool2");
  });

  it("handles error results", () => {
    const result = formatToolResults([
      { toolCallId: "1", toolName: "fail", result: "error msg", isError: true },
    ]);

    expect(result).toContain('"error":true');
  });

  it("handles null result", () => {
    const result = formatToolResults([
      { toolCallId: "1", toolName: "test", result: null, isError: false },
    ]);

    expect(result).toContain('"result":null');
  });

  it("returns empty string for empty array", () => {
    expect(formatToolResults([])).toBe("");
  });
});

describe("formatSingleToolResult", () => {
  it("formats a single result", () => {
    const result = formatSingleToolResult({
      toolCallId: "call_1",
      toolName: "test",
      result: { data: 1 },
      isError: false,
    });

    expect(result).toContain("```tool_result");
    expect(result).toContain("test");
  });
});
