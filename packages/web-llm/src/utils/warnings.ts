import type {
  SharedV3Warning,
  LanguageModelV3ProviderTool,
} from "@ai-sdk/provider";

/**
 * Creates a warning for an unsupported feature
 *
 * @param feature - Name of the feature that is not supported
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
  feature: string,
  details: string,
): SharedV3Warning {
  return {
    type: "unsupported",
    feature,
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
  tool: LanguageModelV3ProviderTool,
  details: string,
): SharedV3Warning {
  return {
    type: "unsupported",
    feature: `tool:${tool.name}`,
    details,
  };
}
