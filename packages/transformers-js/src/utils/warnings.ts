/**
 * Warning generation utilities for unsupported settings and tools
 */

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
