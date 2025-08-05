import {
  LanguageModelV2CallOptions,
  LanguageModelV2CallWarning,
  UnsupportedFunctionalityError,
} from "@ai-sdk/provider";
import * as webllm from "@mlc-ai/web-llm";

export function prepareTools({
  tools,
  toolChoice,
}: {
  tools: LanguageModelV2CallOptions["tools"];
  toolChoice: LanguageModelV2CallOptions["toolChoice"];
}): {
  toolWarnings: LanguageModelV2CallWarning[];
  tools?: webllm.ChatCompletionTool[];
  toolChoice?: webllm.ChatCompletionToolChoiceOption;
} {

  // when the tools array is empty, change it to undefined to prevent errors:
  tools = tools?.length ? tools : undefined;

  const toolWarnings: LanguageModelV2CallWarning[] = [];

  if (tools == null) {
    if (toolChoice != null) {
      toolWarnings.push({
        type: "unsupported-setting",
        setting: "toolChoice",
        details:
          "Tool choice is only supported when tools are provided. Ignoring tool choice.",
      });
    }
    return { tools: undefined, toolChoice: undefined, toolWarnings };
  }

  const webLlmTools: webllm.ChatCompletionTool[] = [];

  for (const tool of tools) {
    switch (tool.type) {
      case "function":
        webLlmTools.push({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          },
        });
        break;
    }
  }

  if (toolChoice == null) {
    return { tools: webLlmTools, toolChoice: undefined, toolWarnings };
  }

  switch (toolChoice.type) {
    case "none":
    case "auto":
      return { tools: webLlmTools, toolChoice: toolChoice.type, toolWarnings };

    case "required":
      toolWarnings.push({
        type: "unsupported-setting",
        setting: "toolChoice",
        details: 'Required tool choice is not supported. Using "auto".',
      });
      return { tools: webLlmTools, toolChoice: "auto", toolWarnings };

    case "tool":
      return {
        tools: webLlmTools,
        toolChoice: {
          type: "function",
          function: { name: toolChoice.toolName },
        },
        toolWarnings,
      };

    default:
      const _exhaustiveCheck: never = toolChoice;
      throw new UnsupportedFunctionalityError({
        functionality: `tool choice type: ${_exhaustiveCheck}`,
      });
  }
} 