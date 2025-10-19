import type { ParsedResponse, ParsedToolCall } from "./types";

/**
 * Regular expression to match JSON tool call code fences.
 * Matches blocks like ```tool_call or ```tool-call with content inside.
 */
const JSON_TOOL_CALL_FENCE_REGEX = /```tool[_-]?call\s*([\s\S]*?)```/gi;

/**
 * Generates a unique identifier for a tool call.
 * Uses timestamp and random string to ensure uniqueness.
 *
 * @returns A unique tool call ID in the format "call_{timestamp}_{random}"
 */
function generateToolCallId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Parses JSON-formatted tool calls from model response.
 * Supports multiple formats:
 * 1. Single object: {"name": "tool", "arguments": {...}}
 * 2. Array: [{"name": "tool1", ...}, {"name": "tool2", ...}]
 * 3. Newline-separated objects:
 *    {"name": "tool1", "arguments": {...}}
 *    {"name": "tool2", "arguments": {...}}
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
    const [fullFence, innerContent] = match;
    textContent = textContent.replace(fullFence, "");

    try {
      const trimmed = innerContent.trim();

      // Try parsing as a single JSON value first (object or array)
      try {
        const parsed = JSON.parse(trimmed);
        const callsArray = Array.isArray(parsed) ? parsed : [parsed];

        for (const call of callsArray) {
          if (!call.name) continue;

          toolCalls.push({
            type: "tool-call",
            toolCallId: call.id || generateToolCallId(),
            toolName: call.name,
            args: call.arguments || {},
          });
        }
      } catch {
        // If single JSON parsing fails, try parsing as newline-separated JSON objects
        const lines = trimmed.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          try {
            const call = JSON.parse(line.trim());
            if (!call.name) continue;

            toolCalls.push({
              type: "tool-call",
              toolCallId: call.id || generateToolCallId(),
              toolName: call.name,
              args: call.arguments || {},
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

/**
 * Checks if a response contains JSON-formatted tool calls.
 *
 * @param response - The model's response text to check
 * @returns true if the response contains tool call fences, false otherwise
 */
export function hasJsonFunctionCalls(response: string): boolean {
  const hasMatch = JSON_TOOL_CALL_FENCE_REGEX.test(response);
  JSON_TOOL_CALL_FENCE_REGEX.lastIndex = 0;
  return hasMatch;
}

/**
 * Extracts the first JSON tool call code fence block from a response.
 *
 * @param response - The model's response text to extract from
 * @returns The first tool call fence block (including delimiters), or null if none found
 */
export function extractJsonFunctionCallsBlock(response: string): string | null {
  const match = JSON_TOOL_CALL_FENCE_REGEX.exec(response);
  JSON_TOOL_CALL_FENCE_REGEX.lastIndex = 0;
  return match ? match[0] : null;
}

