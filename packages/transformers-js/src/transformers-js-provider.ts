import {
  EmbeddingModelV2,
  LanguageModelV2,
  NoSuchModelError,
  ProviderV2,
} from '@ai-sdk/provider';
import {
  TransformersJSLanguageModel,
  TransformersJSModelId,
  TransformersJSModelSettings,
  isServerEnvironment,
} from "./chat/transformers-js-language-model";
import {
  TransformersJSEmbeddingModel,
  TransformersJSEmbeddingModelId,
  TransformersJSEmbeddingSettings
} from "./transformers-js-embedding-model";

export interface TransformersJSProvider extends ProviderV2 {
  (modelId: TransformersJSModelId, settings?: TransformersJSModelSettings): TransformersJSLanguageModel;

  /**
   * Creates a model for text generation.
   */
  languageModel(modelId: TransformersJSModelId, settings?: TransformersJSModelSettings): TransformersJSLanguageModel;

  /**
   * Creates a model for text generation.
   */
  chat(modelId: TransformersJSModelId, settings?: TransformersJSModelSettings): TransformersJSLanguageModel;

  textEmbedding(modelId: TransformersJSEmbeddingModelId, settings?: TransformersJSEmbeddingSettings): EmbeddingModelV2<string>;

  textEmbeddingModel: (
    modelId: TransformersJSEmbeddingModelId,
    settings?: TransformersJSEmbeddingSettings,
  ) => EmbeddingModelV2<string>;
}

export interface TransformersJSProviderSettings {
  // Currently empty - provider settings are minimal for TransformersJS
  // Future provider-level settings can be added here
}

/**
 * Create a TransformersJS provider instance.
 */
export function createTransformersJS(
  options: TransformersJSProviderSettings = {},
): TransformersJSProvider {
  const createChatModel = (modelId: TransformersJSModelId, settings?: TransformersJSModelSettings) => {

    // On the server, return a singleton per model + device + dtype + isVision configuration
    // so initialization state persists across uses (e.g. within a warm process).
    if (isServerEnvironment()) {
      // Avoid carrying a worker field on the server (workers are not used)
      const { worker: _ignoredWorker, ...serverSettings } = (settings || {}) as TransformersJSModelSettings & { worker?: unknown };

      const key = getLanguageModelKey(modelId, serverSettings);
      const cached = serverLanguageModelSingletons.get(key);
      if (cached) return cached;

      const instance = new TransformersJSLanguageModel(modelId, serverSettings);
      serverLanguageModelSingletons.set(key, instance);
      return instance;
    }

    return new TransformersJSLanguageModel(modelId, settings);
  };

  const createEmbeddingModel = (modelId: TransformersJSEmbeddingModelId, settings?: TransformersJSEmbeddingSettings) => {
    return new TransformersJSEmbeddingModel(modelId, settings);
  };

  const provider = function (modelId: TransformersJSModelId, settings?: TransformersJSModelSettings) {
    if (new.target) {
      throw new Error(
        'The TransformersJS model function cannot be called with the new keyword.',
      );
    }

    return createChatModel(modelId, settings);
  };

  provider.languageModel = createChatModel;
  provider.chat = createChatModel;
  provider.textEmbedding = createEmbeddingModel;
  provider.textEmbeddingModel = createEmbeddingModel;

  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: 'imageModel' });
  };

  provider.speechModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: 'speechModel' });
  };

  provider.transcriptionModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: 'transcriptionModel' });
  };

  return provider;
}

/**
 * Default TransformersJS provider instance.
 */
export const transformersJS = createTransformersJS();

// Server-side singleton cache for language model instances
const serverLanguageModelSingletons = new Map<string, TransformersJSLanguageModel>();

function getLanguageModelKey(modelId: string, settings?: TransformersJSModelSettings): string {
  const device = (settings?.device ?? "auto").toString();
  const dtype = (settings?.dtype ?? "auto").toString();
  const isVision = !!settings?.isVisionModel;
  return `${modelId}::${device}::${dtype}::${isVision ? "vision" : "text"}`;
}