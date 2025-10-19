/**
 * Utilities for working with AI SDK tools
 */

import type {
  LanguageModelV2FunctionTool,
  LanguageModelV2ProviderDefinedTool,
} from "@ai-sdk/provider";

/**
 * Type guard to check if a tool is a function tool
 *
 * @param tool - The tool to check
 * @returns true if the tool is a LanguageModelV2FunctionTool
 */
export function isFunctionTool(
  tool: LanguageModelV2FunctionTool | LanguageModelV2ProviderDefinedTool,
): tool is LanguageModelV2FunctionTool {
  return tool.type === "function";
}
