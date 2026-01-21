import { describe, it, expect } from "vitest";
import {
  parseJsonFunctionCalls,
  hasJsonFunctionCalls,
  extractJsonFunctionCallsBlock,
} from "../src/tool-calling/parse-json-function-calls";

describe("parseJsonFunctionCalls", () => {
  it("parses single JSON tool call", () => {
    const response = `Text before
\`\`\`tool_call
{"id": "call_1", "name": "getWeather", "arguments": {"location": "NYC"}}
\`\`\`
Text after`;

    const result = parseJsonFunctionCalls(response);

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]).toMatchObject({
      type: "tool-call",
      toolCallId: "call_1",
      toolName: "getWeather",
      args: { location: "NYC" },
    });
    expect(result.textContent).toContain("Text before");
    expect(result.textContent).toContain("Text after");
  });

  it("parses multiple tool calls in array", () => {
    const response = `\`\`\`tool_call
[{"id": "1", "name": "tool1", "arguments": {}}, {"id": "2", "name": "tool2", "arguments": {}}]
\`\`\``;

    const result = parseJsonFunctionCalls(response);

    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls[0].toolName).toBe("tool1");
    expect(result.toolCalls[1].toolName).toBe("tool2");
  });

  it("generates id when missing", () => {
    const response = `\`\`\`tool_call
{"name": "testTool", "arguments": {}}
\`\`\``;

    const result = parseJsonFunctionCalls(response);

    expect(result.toolCalls[0].toolCallId).toMatch(/^call_/);
  });

  it("handles missing arguments", () => {
    const response = `\`\`\`tool_call
{"id": "1", "name": "noArgs"}
\`\`\``;

    const result = parseJsonFunctionCalls(response);

    expect(result.toolCalls[0].args).toEqual({});
  });

  it("skips invalid JSON", () => {
    const response = `\`\`\`tool_call
{invalid}
\`\`\``;

    const result = parseJsonFunctionCalls(response);
    expect(result.toolCalls).toHaveLength(0);
  });

  it("skips tool calls without name", () => {
    const response = `\`\`\`tool_call
{"id": "1", "arguments": {}}
\`\`\``;

    const result = parseJsonFunctionCalls(response);
    expect(result.toolCalls).toHaveLength(0);
  });

  it("returns empty array when no tool calls", () => {
    const response = "Regular response";
    const result = parseJsonFunctionCalls(response);

    expect(result.toolCalls).toHaveLength(0);
    expect(result.textContent).toBe(response);
  });

  it("handles newline-separated JSON objects", () => {
    const response = `\`\`\`tool_call
{"name": "tool1", "arguments": {"a": 1}}
{"name": "tool2", "arguments": {"b": 2}}
\`\`\``;

    const result = parseJsonFunctionCalls(response);

    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls[0].toolName).toBe("tool1");
    expect(result.toolCalls[1].toolName).toBe("tool2");
  });
});

describe("hasJsonFunctionCalls", () => {
  it("detects tool_call fence", () => {
    expect(hasJsonFunctionCalls("```tool_call\n{}\n```")).toBe(true);
  });

  it("detects tool-call fence", () => {
    expect(hasJsonFunctionCalls("```tool-call\n{}\n```")).toBe(true);
  });

  it("returns false when no fence", () => {
    expect(hasJsonFunctionCalls("regular text")).toBe(false);
  });
});

describe("extractJsonFunctionCallsBlock", () => {
  it("extracts the tool call block", () => {
    const block = extractJsonFunctionCallsBlock(
      "Before ```tool_call\n{}\n``` After",
    );
    expect(block).toContain("tool_call");
  });

  it("returns null when no block", () => {
    expect(extractJsonFunctionCallsBlock("no tools")).toBeNull();
  });
});
