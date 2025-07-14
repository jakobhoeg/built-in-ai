import {
  BuiltInAIChatLanguageModel,
  BuiltInAIChatModelId,
  BuiltInAIChatSettings,
} from './built-in-ai-language-model';

/**
 * Create a new BuiltInAIChatLanguageModel.
 * @param modelId 'text'
 * @param settings Options for the model, including optional fallback model
 */
export function builtInAI(
  modelId?: BuiltInAIChatModelId,
  settings?: BuiltInAIChatSettings
): BuiltInAIChatLanguageModel;
export function builtInAI(modelId: unknown = 'text', settings: unknown = {}) {
  return new BuiltInAIChatLanguageModel(
    modelId as BuiltInAIChatModelId,
    settings as BuiltInAIChatSettings
  );
} 