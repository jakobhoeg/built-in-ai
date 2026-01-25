import type {
  LanguageModelV3FunctionTool,
  LanguageModelV3ProviderTool,
} from "@ai-sdk/provider";

export function isFunctionTool(
  tool: LanguageModelV3FunctionTool | LanguageModelV3ProviderTool,
): tool is LanguageModelV3FunctionTool {
  return tool.type === "function";
}
