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

// Cache for model instances to prevent reloading
const modelCache = new Map<string, TransformersJSLanguageModel | TransformersJSEmbeddingModel>();

// Helper function to create a cache key from model ID and settings
function createCacheKey(modelId: string, settings?: any): string {
  const settingsStr = settings ? JSON.stringify(settings, Object.keys(settings).sort()) : '';
  return `${modelId}:${settingsStr}`;
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

/**
 * Legacy factory pattern support - Create a TransformersJS provider with factory methods
 * @param options - Configuration options for the provider
 * @returns Provider object with languageModel and embeddingModel factories
 * @deprecated Use direct constructor pattern: transformersJS(modelId, settings)
 */
export function transformersJS(
  options?: {
    /**
     * Base URL for downloading models (optional)
     * @default 'https://huggingface.co'
     */
    baseUrl?: string;
  }
): TransformersJSProvider;

export function transformersJS(
  modelIdOrOptions?: TransformersJSModelId | TransformersJSEmbeddingModelId | { baseUrl?: string },
  settings?: TransformersJSModelSettings | (TransformersJSEmbeddingSettings & { type: 'embedding' })
): TransformersJSLanguageModel | TransformersJSEmbeddingModel | TransformersJSProvider {

  // Legacy factory pattern support
  if (typeof modelIdOrOptions === 'object' && modelIdOrOptions !== null && !Array.isArray(modelIdOrOptions)) {
    const options = modelIdOrOptions as { baseUrl?: string };
    return {
      languageModel: (
        modelId: TransformersJSModelId,
        settings?: TransformersJSModelSettings
      ) => {
        const cacheKey = createCacheKey(modelId, settings);
        let cachedModel = modelCache.get(cacheKey) as TransformersJSLanguageModel;

        if (!cachedModel) {
          cachedModel = new TransformersJSLanguageModel(modelId, settings);
          modelCache.set(cacheKey, cachedModel);
        }

        return cachedModel;
      },

      embeddingModel: (
        modelId: TransformersJSEmbeddingModelId,
        settings?: TransformersJSEmbeddingSettings
      ) => {
        const cacheKey = createCacheKey(modelId, settings);
        let cachedModel = modelCache.get(cacheKey) as TransformersJSEmbeddingModel;

        if (!cachedModel) {
          cachedModel = new TransformersJSEmbeddingModel(modelId, settings);
          modelCache.set(cacheKey, cachedModel);
        }

        return cachedModel;
      },
    };
  }

  // New direct constructor pattern
  const modelId = modelIdOrOptions as string;

  // Check if it's an embedding model
  if (settings && typeof settings === 'object' && 'type' in settings && settings.type === 'embedding') {
    const { type, ...embeddingSettings } = settings;
    const cacheKey = createCacheKey(modelId, embeddingSettings);
    let cachedModel = modelCache.get(cacheKey) as TransformersJSEmbeddingModel;

    if (!cachedModel) {
      cachedModel = new TransformersJSEmbeddingModel(modelId, embeddingSettings as TransformersJSEmbeddingSettings);
      modelCache.set(cacheKey, cachedModel);
    }

    return cachedModel;
  }

  // Default to language model
  const cacheKey = createCacheKey(modelId, settings);
  let cachedModel = modelCache.get(cacheKey) as TransformersJSLanguageModel;

  if (!cachedModel) {
    cachedModel = new TransformersJSLanguageModel(modelId, settings as TransformersJSModelSettings);
    modelCache.set(cacheKey, cachedModel);
  }

  return cachedModel;
}

/**
 * Default TransformersJS provider instance (legacy)
 * @deprecated Use direct constructor pattern: transformersJS(modelId, settings)
 */
export const transformersjs = transformersJS();

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

/**
 * Popular model configurations for quick setup
 */
export const models = {
  // Text Generation Models
  text: {
    gpt2: "Xenova/gpt2",
    distilgpt2: "Xenova/distilgpt2",
    tinyLlama: "Xenova/TinyLlama-1.1B-Chat-v1.0",
    phi3: "Xenova/Phi-3-mini-4k-instruct",
  },

  // Embedding Models
  embedding: {
    allMiniLM: "Xenova/all-MiniLM-L6-v2",
    allDistilroberta: "Xenova/all-distilroberta-v1",
    bgeSmall: "Xenova/bge-small-en-v1.5",
    e5Small: "Xenova/e5-small-v2",
  },
} as const;

/**
 * Helper function to check if the current environment supports TransformersJS
 * @returns Promise that resolves to true if TransformersJS is available
 */
export async function checkTransformersJSSupport(): Promise<{
  supported: boolean;
  webgpu: boolean;
  features: {
    wasm: boolean;
    sharedArrayBuffer: boolean;
    crossOriginIsolated: boolean;
  };
}> {
  const features = {
    wasm: typeof WebAssembly !== "undefined",
    sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
    crossOriginIsolated: typeof crossOriginIsolated !== "undefined" ? crossOriginIsolated : false,
  };

  let webgpu = false;
  try {
    webgpu = typeof navigator !== "undefined" && "gpu" in navigator;
  } catch {
    // Ignore errors
  }

  const supported =
    typeof window !== "undefined" &&
    features.wasm &&
    (features.crossOriginIsolated || !features.sharedArrayBuffer);

  return {
    supported,
    webgpu,
    features,
  };
} 