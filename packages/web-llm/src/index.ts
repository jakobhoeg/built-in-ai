export {
  WebLLMLanguageModel,
  doesBrowserSupportWebLLM,
} from "./web-llm-language-model";
export type { WebLLMModelId, WebLLMSettings } from "./web-llm-language-model";
export type { WebLLMUIMessage, WebLLMProgress } from "./types";

export { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

export { webLLM } from "./web-llm-provider";

// Export tool calling utilities
export {
  buildJsonToolSystemPrompt,
  parseJsonFunctionCalls,
  hasJsonFunctionCalls,
  extractJsonFunctionCallsBlock,
  formatToolResults,
  formatSingleToolResult,
} from "./tool-calling";

export type {
  JSONSchema,
  ToolDefinition,
  ParsedToolCall,
  ToolResult,
  ParsedResponse,
} from "./tool-calling";
