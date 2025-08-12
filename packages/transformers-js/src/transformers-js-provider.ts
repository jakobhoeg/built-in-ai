import {
  TransformersJSLanguageModel,
  TransformersJSModelId,
  TransformersJSModelSettings
} from "./chat/transformers-js-language-model";
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
 * Create a new TransformersJS language model (default behavior).
 * @param modelId - The model identifier (e.g., 'Xenova/gpt2')
 * @param settings - Configuration options for the language model (without type field)
 * @returns TransformersJS language model instance
 */
export function transformersJS(
  modelId: TransformersJSModelId,
  settings?: Omit<TransformersJSModelSettings, 'type'>,
): TransformersJSLanguageModel;

/**
 * Create a new TransformersJS embedding model.
 * @param modelId - The model identifier for embeddings
 * @param settings - Configuration options with type: 'embedding'
 * @returns TransformersJS embedding model instance
 */
export function transformersJS(
  modelId: TransformersJSEmbeddingModelId,
  settings: TransformersJSEmbeddingSettings & { type: 'embedding' },
): TransformersJSEmbeddingModel;

// Implementation with proper function overload resolution
export function transformersJS(
  modelId: string,
  settings?: any
): TransformersJSLanguageModel | TransformersJSEmbeddingModel {
  // Check if it's an embedding model
  if (settings?.type === 'embedding') {
    const { type, ...embeddingSettings } = settings;
    return getCachedModel(modelId, embeddingSettings, () =>
      new TransformersJSEmbeddingModel(modelId, embeddingSettings)
    );
  }

  // Default to language model (even if settings has other properties)
  return getCachedModel(modelId, settings, () =>
    new TransformersJSLanguageModel(modelId, settings)
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