import {
  EmbeddingModelV2,
  NoSuchModelError,
  ProviderV2,
} from "@ai-sdk/provider";
import {
  BuiltInAIChatLanguageModel,
  BuiltInAIChatModelId,
  BuiltInAIChatSettings,
} from "./built-in-ai-language-model";
import {
  BuiltInAIEmbeddingModel,
  BuiltInAIEmbeddingModelSettings,
} from "./built-in-ai-embedding-model";

export interface BuiltInAIProvider extends ProviderV2 {
  (
    modelId?: BuiltInAIChatModelId,
    settings?: BuiltInAIChatSettings,
  ): BuiltInAIChatLanguageModel;

  /**
   * Creates a model for text generation.
   */
  languageModel(
    modelId: BuiltInAIChatModelId,
    settings?: BuiltInAIChatSettings,
  ): BuiltInAIChatLanguageModel;

  /**
   * Creates a model for text generation.
   */
  chat(
    modelId: BuiltInAIChatModelId,
    settings?: BuiltInAIChatSettings,
  ): BuiltInAIChatLanguageModel;

  textEmbedding(
    modelId: "embedding",
    settings?: BuiltInAIEmbeddingModelSettings,
  ): EmbeddingModelV2<string>;

  textEmbeddingModel: (
    modelId: "embedding",
    settings?: BuiltInAIEmbeddingModelSettings,
  ) => EmbeddingModelV2<string>;

  // Not implemented
  imageModel(modelId: string): never;
  speechModel(modelId: string): never;
  transcriptionModel(modelId: string): never;
}

export interface BuiltInAIProviderSettings {
  // Currently empty - provider settings are minimal for BuiltInAI
  // Future provider-level settings can be added here
}

/**
 * Create a BuiltInAI provider instance.
 */
export function createBuiltInAI(
  options: BuiltInAIProviderSettings = {},
): BuiltInAIProvider {
  const createChatModel = (
    modelId: BuiltInAIChatModelId,
    settings?: BuiltInAIChatSettings,
  ) => {
    return new BuiltInAIChatLanguageModel(modelId, settings);
  };

  const createEmbeddingModel = (
    modelId: "embedding",
    settings?: BuiltInAIEmbeddingModelSettings,
  ) => {
    return new BuiltInAIEmbeddingModel(settings);
  };

  const provider = function (
    modelId: BuiltInAIChatModelId = "text",
    settings?: BuiltInAIChatSettings,
  ) {
    if (new.target) {
      throw new Error(
        "The BuiltInAI model function cannot be called with the new keyword.",
      );
    }

    return createChatModel(modelId, settings);
  };

  provider.languageModel = createChatModel;
  provider.chat = createChatModel;
  provider.textEmbedding = createEmbeddingModel;
  provider.textEmbeddingModel = createEmbeddingModel;

  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: "imageModel" });
  };

  provider.speechModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: "speechModel" });
  };

  provider.transcriptionModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: "transcriptionModel" });
  };

  return provider;
}

/**
 * Default BuiltInAI provider instance.
 */
export const builtInAI = createBuiltInAI();
