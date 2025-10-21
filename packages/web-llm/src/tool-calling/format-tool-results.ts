import type { ToolResult } from "./types";

/**
 * Formats tool execution results into a JSON-formatted string for the model.
 *
 * Each result is formatted as:
 * ```tool_result
 * {"id": "call_123", "name": "tool_name", "result": {...}, "error": false}
 * {"id": "call_456", "name": "tool_name2", "result": {...}, "error": false}
 * ```
 *
 * @param results - Array of tool results to format
 * @returns Formatted tool result string in JSON format
 *
 * @example
 * ```typescript
 * const results = [
 *   { toolCallId: "call_1", toolName: "search", result: { found: true }, isError: false }
 * ];
 * const formatted = formatToolResults(results);
 * // Returns:
 * // ```tool_result
 * // {"id":"call_1","name":"search","result":{"found":true},"error":false}
 * // ```
 * ```
 */
export function formatToolResults(results: ToolResult[]): string {
  if (results.length === 0) {
    return "";
  }

  const lines = results
    .map((result) => formatSingleToolResult(result))
    .join("\n");

  return `\`\`\`tool_result\n${lines}\n\`\`\``;
}

/**
 * Formats a single tool result as a JSON string
 *
 * @param result - The tool result to format
 * @returns JSON-formatted string representation of the result
 *
 * @example
 * ```typescript
 * const result = {
 *   toolCallId: "call_1",
 *   toolName: "search",
 *   result: { found: true },
 *   isError: false
 * };
 * const formatted = formatSingleToolResult(result);
 * // Returns: '{"id":"call_1","name":"search","result":{"found":true},"error":false}'
 * ```
 */
export function formatSingleToolResult(result: ToolResult): string {
  return JSON.stringify({
    id: result.toolCallId,
    name: result.toolName,
    result: result.result,
    error: result.isError ?? false,
  });
}
