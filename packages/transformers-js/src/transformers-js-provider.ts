import {
  TransformersJSLanguageModel,
  TransformersJSModelId,
  TransformersJSModelSettings
} from "./transformers-js-language-model";
import {
  TransformersJSEmbeddingModel,
  TransformersJSEmbeddingModelId,
  TransformersJSEmbeddingSettings
} from "./transformers-js-embedding-model";

const modelCache = new Map<string, TransformersJSLanguageModel | TransformersJSEmbeddingModel>();

function createCacheKey(modelId: string, settings?: any): string {
  return `${modelId}:${settings ? JSON.stringify(settings) : ''}`;
}

function getCachedModel<T>(modelId: string, settings: any, factory: () => T): T {
  const cacheKey = createCacheKey(modelId, settings);
  let cached = modelCache.get(cacheKey) as T;
  if (!cached) {
    cached = factory();
    modelCache.set(cacheKey, cached as any);
  }
  return cached;
}

export interface TransformersJSProvider {
  languageModel: (
    modelId: TransformersJSModelId,
    settings?: TransformersJSModelSettings
  ) => TransformersJSLanguageModel;

  embeddingModel: (
    modelId: TransformersJSEmbeddingModelId,
    settings?: TransformersJSEmbeddingSettings
  ) => TransformersJSEmbeddingModel;
}

/**
 * Create a new TransformersJS language model.
 * @param modelId - The model identifier (e.g., 'Xenova/gpt2')
 * @param settings - Configuration options for the language model
 * @returns TransformersJS language model instance
 */
export function transformersJS(
  modelId: TransformersJSModelId,
  settings?: TransformersJSModelSettings,
): TransformersJSLanguageModel;

/**
 * Create a new TransformersJS embedding model.
 * @param modelId - The model identifier for embeddings
 * @param settings - Configuration options for the embedding model
 * @param type - Explicitly specify 'embedding' to create an embedding model
 */
export function transformersJS(
  modelId: TransformersJSEmbeddingModelId,
  settings: TransformersJSEmbeddingSettings & { type: 'embedding' },
): TransformersJSEmbeddingModel;

export function transformersJS(
  modelIdOrOptions?: TransformersJSModelId | TransformersJSEmbeddingModelId | { baseUrl?: string },
  settings?: TransformersJSModelSettings | (TransformersJSEmbeddingSettings & { type: 'embedding' })
): TransformersJSLanguageModel | TransformersJSEmbeddingModel | TransformersJSProvider {

  const modelId = modelIdOrOptions as string;

  // Check if it's an embedding model
  if (settings && typeof settings === 'object' && 'type' in settings && settings.type === 'embedding') {
    const { type, ...embeddingSettings } = settings;
    return getCachedModel(modelId, embeddingSettings, () =>
      new TransformersJSEmbeddingModel(modelId, embeddingSettings as TransformersJSEmbeddingSettings)
    );
  }

  // Default to language model
  return getCachedModel(modelId, settings, () =>
    new TransformersJSLanguageModel(modelId, settings as TransformersJSModelSettings)
  );
}

/**
 * Clear the model cache to free up memory or force reload models
 * @param modelId - Optional specific model ID to clear. If not provided, clears all cached models
 */
export function clearModelCache(modelId?: string): void {
  if (modelId) {
    // Clear specific model (all variants with different settings)
    const keysToDelete = Array.from(modelCache.keys()).filter(key => key.startsWith(`${modelId}:`));
    keysToDelete.forEach(key => modelCache.delete(key));
  } else {
    // Clear all cached models
    modelCache.clear();
  }
}

/**
 * Get information about currently cached models
 * @returns Array of cached model information
 */
export function getCacheInfo(): Array<{ modelId: string; settings: any; cacheKey: string }> {
  return Array.from(modelCache.keys()).map(cacheKey => {
    const [modelId, settingsStr] = cacheKey.split(':', 2);
    const settings = settingsStr ? JSON.parse(settingsStr) : undefined;
    return { modelId, settings, cacheKey };
  });
}