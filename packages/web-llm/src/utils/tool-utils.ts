import type {
  LanguageModelV2FunctionTool,
  LanguageModelV2ProviderDefinedTool,
} from "@ai-sdk/provider";

export function isFunctionTool(
  tool: LanguageModelV2FunctionTool | LanguageModelV2ProviderDefinedTool,
): tool is LanguageModelV2FunctionTool {
  return tool.type === "function";
}
