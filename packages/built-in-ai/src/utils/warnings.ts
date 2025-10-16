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
 *
 * @example
 * ```typescript
 * const warning = createUnsupportedSettingWarning(
 *   "maxOutputTokens",
 *   "maxOutputTokens is not supported by Prompt API"
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
 *   "Only function tools are supported by the Prompt API polyfill"
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

/**
 * Gathers all warnings for unsupported call options
 *
 * @param options - The call options to check
 * @returns Array of warnings for any unsupported settings
 *
 * @example
 * ```typescript
 * const warnings = gatherUnsupportedSettingWarnings({
 *   maxOutputTokens: 100,
 *   topP: 0.9,
 *   temperature: 0.7,
 * });
 * // Returns warnings for maxOutputTokens and topP
 * ```
 */
export function gatherUnsupportedSettingWarnings(options: {
  maxOutputTokens?: number;
  stopSequences?: string[];
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  seed?: number;
  toolChoice?: unknown;
}): LanguageModelV2CallWarning[] {
  const warnings: LanguageModelV2CallWarning[] = [];

  if (options.maxOutputTokens != null) {
    warnings.push(
      createUnsupportedSettingWarning(
        "maxOutputTokens",
        "maxOutputTokens is not supported by Prompt API",
      ),
    );
  }

  if (options.stopSequences != null) {
    warnings.push(
      createUnsupportedSettingWarning(
        "stopSequences",
        "stopSequences is not supported by Prompt API",
      ),
    );
  }

  if (options.topP != null) {
    warnings.push(
      createUnsupportedSettingWarning(
        "topP",
        "topP is not supported by Prompt API",
      ),
    );
  }

  if (options.presencePenalty != null) {
    warnings.push(
      createUnsupportedSettingWarning(
        "presencePenalty",
        "presencePenalty is not supported by Prompt API",
      ),
    );
  }

  if (options.frequencyPenalty != null) {
    warnings.push(
      createUnsupportedSettingWarning(
        "frequencyPenalty",
        "frequencyPenalty is not supported by Prompt API",
      ),
    );
  }

  if (options.seed != null) {
    warnings.push(
      createUnsupportedSettingWarning(
        "seed",
        "seed is not supported by Prompt API",
      ),
    );
  }

  if (options.toolChoice != null) {
    warnings.push(
      createUnsupportedSettingWarning(
        "toolChoice",
        "toolChoice is not supported by Prompt API",
      ),
    );
  }

  return warnings;
}
