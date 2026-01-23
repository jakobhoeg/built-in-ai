import { describe, it, expect } from "vitest";
import {
  parseJsonFunctionCalls,
  hasJsonFunctionCalls,
  extractJsonFunctionCallsBlock,
} from "../src/tool-calling/parse-json-function-calls";

describe("parseJsonFunctionCalls", () => {
  it("should parse a single JSON tool call", () => {
    const response = `
I need to call a tool.

\`\`\`tool_call
{
  "id": "call_123",
  "name": "getWeather",
  "arguments": {
    "location": "San Francisco",
    "unit": "celsius"
  }
}
\`\`\`

Let me check that for you.
`;

    const result = parseJsonFunctionCalls(response);

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]).toEqual({
      type: "tool-call",
      toolCallId: "call_123",
      toolName: "getWeather",
      args: {
        location: "San Francisco",
        unit: "celsius",
      },
    });
    expect(result.textContent).toContain("I need to call a tool");
    expect(result.textContent).toContain("Let me check that for you");
  });

  it("should parse multiple JSON tool calls in an array", () => {
    const response = `\`\`\`tool_call
[
  {
    "id": "call_1",
    "name": "getWeather",
    "arguments": {"location": "New York"}
  },
  {
    "id": "call_2",
    "name": "getTime",
    "arguments": {"timezone": "EST"}
  }
]
\`\`\``;

    const result = parseJsonFunctionCalls(response);

    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls[0].toolName).toBe("getWeather");
    expect(result.toolCalls[1].toolName).toBe("getTime");
  });

  it("should handle missing id by generating one", () => {
    const response = `\`\`\`tool_call
{
  "name": "testTool",
  "arguments": {}
}
\`\`\``;

    const result = parseJsonFunctionCalls(response);

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].toolCallId).toMatch(/^call_/);
  });

  it("should handle missing arguments", () => {
    const response = `\`\`\`tool_call
{
  "id": "call_123",
  "name": "noArgsTool"
}
\`\`\``;

    const result = parseJsonFunctionCalls(response);

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].args).toEqual({});
  });

  it("should skip invalid JSON", () => {
    const response = `\`\`\`tool_call
{invalid json}
\`\`\``;

    const result = parseJsonFunctionCalls(response);

    expect(result.toolCalls).toHaveLength(0);
  });

  it("should skip tool calls without name", () => {
    const response = `\`\`\`tool_call
{
  "id": "call_123",
  "arguments": {"test": "value"}
}
\`\`\``;

    const result = parseJsonFunctionCalls(response);

    expect(result.toolCalls).toHaveLength(0);
  });

  it("should return empty array when no tool calls present", () => {
    const response = "Just a regular response with no tool calls.";

    const result = parseJsonFunctionCalls(response);

    expect(result.toolCalls).toHaveLength(0);
    expect(result.textContent).toBe(response);
  });
});

describe("hasJsonFunctionCalls", () => {
  it("should detect tool_call fence", () => {
    const response = "Some text ```tool_call\n{}\n``` more text";
    expect(hasJsonFunctionCalls(response)).toBe(true);
  });

  it("should detect tool-call fence", () => {
    const response = "Some text ```tool-call\n{}\n``` more text";
    expect(hasJsonFunctionCalls(response)).toBe(true);
  });

  it("should return false when no fence present", () => {
    const response = "Just regular text";
    expect(hasJsonFunctionCalls(response)).toBe(false);
  });
});

describe("extractJsonFunctionCallsBlock", () => {
  it("should extract the tool call block", () => {
    const response = 'Before ```tool_call\n{"name":"test"}\n``` After';
    const block = extractJsonFunctionCallsBlock(response);
    expect(block).toContain("tool_call");
    expect(block).toContain('{"name":"test"}');
  });

  it("should return null when no block present", () => {
    const response = "No tool calls here";
    expect(extractJsonFunctionCallsBlock(response)).toBeNull();
  });
});
