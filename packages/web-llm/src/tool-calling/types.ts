import type {
  JSONSchema7,
  LanguageModelV3FunctionTool,
} from "@ai-sdk/provider";

export type JSONSchema = JSONSchema7;

/**
 * Tool definition in AI SDK format (function tools only)
 */
export type ToolDefinition = Pick<
  LanguageModelV3FunctionTool,
  "name" | "description"
> & {
  parameters: JSONSchema7;
};

export interface ParsedToolCall {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  toolName: string;
  result: unknown;
  isError?: boolean;
}

export interface ParsedResponse {
  toolCalls: ParsedToolCall[];
  textContent: string;
}
