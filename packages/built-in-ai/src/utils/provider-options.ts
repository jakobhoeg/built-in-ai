/**
 * Utilities for handling provider-specific options
 */

import type { LanguageModelV2CallOptions, JSONValue } from "@ai-sdk/provider";

/**
 * Supported output languages for the Prompt API.
 * Currently supports: English (en), Spanish (es), Japanese (ja)
 */
const SUPPORTED_OUTPUT_LANGUAGES = new Set(["en", "es", "ja"]);

/**
 * Provider-specific options configuration for built-in-ai provider.
 * These options can be passed via providerOptions in call options to override model-level settings.
 */
type BuiltInAIProviderOptionsConfig = {
  /** Whether to execute tool calls in parallel */
  parallelToolExecution?: JSONValue;
  /** Whether to enable debug logging for tool calls */
  debugToolCalls?: JSONValue;
  /** The language for model output (en, es, or ja) */
  outputLanguage?: JSONValue;
};

/**
 * Determines whether tool calls should execute in parallel.
 *
 * Priority order (highest to lowest):
 * 1. Call-specific provider options (providerOptions["built-in-ai"].parallelToolExecution)
 * 2. Model-level configuration (configValue parameter)
 * 3. Default value (false - sequential execution)
 *
 * @param callOptions - The call options that may contain provider-specific settings
 * @param configValue - The model-level configuration value (optional)
 * @returns true if tools should execute in parallel, false for sequential execution
 */
export function shouldExecuteToolsInParallel(
  callOptions: LanguageModelV2CallOptions,
  configValue?: boolean,
): boolean {
  const providerOptions = callOptions.providerOptions?.["built-in-ai"] as
    | BuiltInAIProviderOptionsConfig
    | undefined;

  const providerPreference = providerOptions?.parallelToolExecution;

  if (typeof providerPreference === "boolean") {
    return providerPreference;
  }

  return configValue ?? false;
}

/**
 * Resolves the output language for the model response.
 *
 * Priority order (highest to lowest):
 * 1. Call-specific provider options (providerOptions["built-in-ai"].outputLanguage)
 * 2. Model-level configuration (configValue parameter)
 * 3. Default value ("en")
 *
 * Only supported languages (en, es, ja) are accepted. Invalid values fall through to next priority level.
 *
 * @param callOptions - The call options that may contain provider-specific settings
 * @param configValue - The model-level configuration value (optional)
 * @returns The resolved language code ("en", "es", or "ja")
 */
export function resolveOutputLanguage(
  callOptions: LanguageModelV2CallOptions,
  configValue?: string,
): string {
  const providerOptions = callOptions.providerOptions?.["built-in-ai"] as
    | BuiltInAIProviderOptionsConfig
    | undefined;

  const providerPreference = providerOptions?.outputLanguage;

  if (
    typeof providerPreference === "string" &&
    SUPPORTED_OUTPUT_LANGUAGES.has(providerPreference)
  ) {
    return providerPreference;
  }

  if (
    typeof configValue === "string" &&
    SUPPORTED_OUTPUT_LANGUAGES.has(configValue)
  ) {
    return configValue;
  }

  return "en";
}

/**
 * Determines whether to enable debug logging for tool calls.
 *
 * Priority order (highest to lowest):
 * 1. Call-specific provider options (providerOptions["built-in-ai"].debugToolCalls)
 * 2. Model-level configuration (configValue parameter)
 * 3. Default value (false)
 *
 * @param callOptions - The call options that may contain provider-specific settings
 * @param configValue - The model-level configuration value (optional)
 * @returns true if debug logging should be enabled, false otherwise
 */
export function shouldDebugToolCalls(
  callOptions: LanguageModelV2CallOptions,
  configValue?: boolean,
): boolean {
  const providerOptions = callOptions.providerOptions?.["built-in-ai"] as
    | BuiltInAIProviderOptionsConfig
    | undefined;

  const providerPreference = providerOptions?.debugToolCalls;

  if (typeof providerPreference === "boolean") {
    return providerPreference;
  }

  return configValue ?? false;
}
