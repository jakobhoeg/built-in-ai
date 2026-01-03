import type { Tool } from '@tanstack/ai'
import type { ToolDefinition } from './types'

/**
 * Builds an enhanced system prompt for JSON-based tool calling.
 * The model receives JSON schemas and is expected to return JSON tool calls.
 *
 * @param originalSystemPrompt - The original system prompt (if any)
 * @param tools - Array of available tools from TanStack AI SDK
 * @returns Enhanced system prompt with JSON tool calling instructions
 */
export function buildJsonToolSystemPrompt(
  originalSystemPrompt: string | undefined,
  tools: Array<Tool | ToolDefinition>
): string {
  if (!tools || tools.length === 0) {
    return originalSystemPrompt || ''
  }

  const parallelInstruction =
    'Only request one tool call at a time. Wait for tool results before asking for another tool.'

  const toolSchemas = tools.map((tool) => {
    const schema = tool.inputSchema
    return {
      name: tool.name,
      description: tool.description ?? 'No description provided.',
      parameters: schema || { type: 'object', properties: {} },
    }
  })

  const toolsJson = JSON.stringify(toolSchemas, null, 2)

  const instructionBody = `You are a helpful AI assistant with access to tools.

# Available Tools
${toolsJson}

# Tool Calling Instructions
${parallelInstruction}

To call a tool, output JSON in this exact format inside a \`\`\`tool_call code fence:

\`\`\`tool_call
{"name": "tool_name", "arguments": {"param1": "value1", "param2": "value2"}}
\`\`\`

Tool responses will be provided in \`\`\`tool_result fences. Each line contains JSON like:
\`\`\`tool_result
{"id": "call_123", "name": "tool_name", "result": {...}, "error": false}
\`\`\`
Use the \`result\` payload (and treat \`error\` as a boolean flag) when continuing the conversation.

Important:
- Use exact tool and parameter names from the schema above
- Arguments must be a valid JSON object matching the tool's parameters
- You can include brief reasoning before or after the tool call
- If no tool is needed, respond directly without tool_call fences`

  if (originalSystemPrompt?.trim()) {
    return `${originalSystemPrompt.trim()}\n\n${instructionBody}`
  }

  return instructionBody
}

