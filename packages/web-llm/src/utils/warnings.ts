import type {
  LanguageModelV2CallWarning,
  LanguageModelV2ProviderDefinedTool,
} from "@ai-sdk/provider";

/**
 * Creates a warning for an unsupported setting
 *
 * @param setting - Name of the setting that is not supported
 * @param details - Additional details about why it's not supported
 * @returns A call warning object
 *
 * @example
 * ```typescript
 * const warning = createUnsupportedSettingWarning(
 *   "maxOutputTokens",
 *   "maxOutputTokens is not supported by WebLLM"
 * );
 * ```
 */
export function createUnsupportedSettingWarning(
  setting: string,
  details: string,
): LanguageModelV2CallWarning {
  return {
    type: "unsupported-setting",
    setting,
    details,
  };
}

/**
 * Creates a warning for an unsupported tool type
 *
 * @param tool - The provider-defined tool that is not supported
 * @param details - Additional details about why it's not supported
 * @returns A call warning object
 *
 * @example
 * ```typescript
 * const warning = createUnsupportedToolWarning(
 *   providerTool,
 *   "Only function tools are supported by WebLLM"
 * );
 * ```
 */
export function createUnsupportedToolWarning(
  tool: LanguageModelV2ProviderDefinedTool,
  details: string,
): LanguageModelV2CallWarning {
  return {
    type: "unsupported-tool",
    tool,
    details,
  };
}
