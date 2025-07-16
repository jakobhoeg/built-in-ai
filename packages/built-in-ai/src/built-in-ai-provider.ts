import {
  BuiltInAIChatLanguageModel,
  BuiltInAIChatModelId,
  BuiltInAIChatSettings,
} from "./built-in-ai-language-model";
import {
  BuiltInAIEmbeddingModel,
  BuiltInAIEmbeddingModelSettings,
} from "./built-in-ai-embedding-model";

/**
 * Create a new BuiltInAIChatLanguageModel.
 * @param modelId 'text'
 * @param settings Options for the model
 */
export function builtInAI(
  modelId?: BuiltInAIChatModelId,
  settings?: BuiltInAIChatSettings,
): BuiltInAIChatLanguageModel;

/**
 * Create a new BuiltInAIEmbeddingModel.
 * @param modelId 'embedding'
 * @param settings Options for the embedding model
 */
export function builtInAI(
  modelId: "embedding",
  settings?: BuiltInAIEmbeddingModelSettings,
): BuiltInAIEmbeddingModel;

export function builtInAI(modelId: unknown = "text", settings: unknown = {}) {
  if (modelId === "embedding") {
    return new BuiltInAIEmbeddingModel(
      settings as BuiltInAIEmbeddingModelSettings,
    );
  }

  return new BuiltInAIChatLanguageModel(
    modelId as BuiltInAIChatModelId,
    settings as BuiltInAIChatSettings,
  );
}
