import type { Tool } from "@tanstack/ai";

/**
 * JSON Schema definition for tool parameters
 * Compatible with JSON Schema Draft 7
 */
export type JSONSchema = Record<string, unknown>;

/**
 * Tool definition in TanStack AI SDK format
 */
export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema?: JSONSchema;
}

/**
 * Parsed tool call from JSON response
 */
export interface ParsedToolCall {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  toolCallId: string;
  toolName: string;
  result: unknown;
  isError?: boolean;
}

/**
 * Result of parsing a response that may contain tool calls
 */
export interface ParsedResponse {
  toolCalls: ParsedToolCall[];
  textContent: string;
}

/**
 * Extracts tool definition from a TanStack AI Tool
 */
export function extractToolDefinition(tool: Tool): ToolDefinition {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema as JSONSchema | undefined,
  };
}
