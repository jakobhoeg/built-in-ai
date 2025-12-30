import type { ParsedResponse, ParsedToolCall } from "./types";

/**
 * Matches tool call blocks in multiple formats:
 * 1. Markdown fences: ```tool_call ... ``` or ```tool-call ... ```
 * 2. XML-style tags: <tool_call>...</tool_call>
 * 3. Python-style: [functionName(arg="value")]
 */
const JSON_TOOL_CALL_FENCE_REGEX =
  /```tool[_-]?call\s*([\s\S]*?)```|<tool_call>\s*([\s\S]*?)\s*<\/tool_call>|\[(\w+)\(([^)]*)\)\]/gi;

function generateToolCallId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Parses JSON-formatted tool calls from model response.
 * Supports multiple formats:
 * 1. Single object: {"name": "tool", "arguments": {...}} or {"name": "tool", "parameters": {...}}
 * 2. Array: [{"name": "tool1", ...}, {"name": "tool2", ...}]
 * 3. Newline-separated objects:
 *    {"name": "tool1", "arguments": {...}}
 *    {"name": "tool2", "arguments": {...}}
 *
 * Note: Handles both "arguments" (OpenAI/Mistral format) and "parameters" (Llama format)
 *
 * @param response - The model's response text to parse
 * @returns Object containing parsed tool calls and remaining text content
 */
export function parseJsonFunctionCalls(response: string): ParsedResponse {
  const matches = Array.from(response.matchAll(JSON_TOOL_CALL_FENCE_REGEX));
  JSON_TOOL_CALL_FENCE_REGEX.lastIndex = 0;

  if (matches.length === 0) {
    return { toolCalls: [], textContent: response };
  }

  const toolCalls: ParsedToolCall[] = [];
  let textContent = response;

  for (const match of matches) {
    const [fullMatch, fenceContent, xmlContent, pythonFuncName, pythonArgs] =
      match;

    textContent = textContent.replace(fullMatch, "");

    try {
      if (pythonFuncName) {
        const args: Record<string, unknown> = {};

        if (pythonArgs && pythonArgs.trim()) {
          const argPairs = pythonArgs.split(",").map((s) => s.trim());
          for (const pair of argPairs) {
            const equalIndex = pair.indexOf("=");
            if (equalIndex > 0) {
              const key = pair.substring(0, equalIndex).trim();
              let value = pair.substring(equalIndex + 1).trim();
              if (
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))
              ) {
                value = value.substring(1, value.length - 1);
              }
              args[key] = value;
            }
          }
        }

        toolCalls.push({
          type: "tool-call",
          toolCallId: generateToolCallId(),
          toolName: pythonFuncName,
          args: args,
        });
        continue;
      }

      const innerContent = fenceContent || xmlContent || "";
      const trimmed = innerContent.trim();

      if (!trimmed) continue;

      // Try parsing as a single JSON value first (object or array)
      try {
        const parsed = JSON.parse(trimmed);
        const callsArray = Array.isArray(parsed) ? parsed : [parsed];

        for (const call of callsArray) {
          if (!call.name) continue;

          let args = call.arguments || call.parameters || {};

          // If args is a string, try to parse it as JSON
          if (typeof args === "string") {
            try {
              args = JSON.parse(args);
            } catch {
              // If parsing fails, keep it as string
            }
          }

          toolCalls.push({
            type: "tool-call",
            toolCallId: call.id || generateToolCallId(),
            toolName: call.name,
            args: args,
          });
        }
      } catch {
        // If single JSON parsing fails, try parsing as newline-separated JSON objects
        const lines = trimmed.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          try {
            const call = JSON.parse(line.trim());
            if (!call.name) continue;

            let args = call.arguments || call.parameters || {};

            if (typeof args === "string") {
              try {
                args = JSON.parse(args);
              } catch {
                // If parsing fails, keep it as string
              }
            }

            toolCalls.push({
              type: "tool-call",
              toolCallId: call.id || generateToolCallId(),
              toolName: call.name,
              args: args,
            });
          } catch {
            // Skip invalid JSON lines
            continue;
          }
        }
      }
    } catch (error) {
      console.warn("Failed to parse JSON tool call:", error);
      continue;
    }
  }

  textContent = textContent.replace(/\n{2,}/g, "\n");

  return { toolCalls, textContent: textContent.trim() };
}

export function hasJsonFunctionCalls(response: string): boolean {
  const hasMatch = JSON_TOOL_CALL_FENCE_REGEX.test(response);
  JSON_TOOL_CALL_FENCE_REGEX.lastIndex = 0;
  return hasMatch;
}

export function extractJsonFunctionCallsBlock(response: string): string | null {
  const match = JSON_TOOL_CALL_FENCE_REGEX.exec(response);
  JSON_TOOL_CALL_FENCE_REGEX.lastIndex = 0;
  return match ? match[0] : null;
}
