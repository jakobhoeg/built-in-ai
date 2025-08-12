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

/**
 * Create a TransformersJS language model
 * @param modelId - The model identifier
 * @param settings - Configuration options for the language model
 * @returns Language model instance
 */
export function transformersJS(
  modelId: TransformersJSModelId,
  settings?: TransformersJSModelSettings
): TransformersJSLanguageModel;

/**
 * Create a TransformersJS embedding model
 * @param modelId - The model identifier
 * @param settings - Configuration options with type: 'embedding'
 * @returns Embedding model instance
 */
export function transformersJS(
  modelId: TransformersJSEmbeddingModelId,
  settings: TransformersJSEmbeddingSettings & { type: 'embedding' }
): TransformersJSEmbeddingModel;

export function transformersJS(
  modelId: string,
  settings?: TransformersJSModelSettings | (TransformersJSEmbeddingSettings & { type: 'embedding' })
): TransformersJSLanguageModel | TransformersJSEmbeddingModel {
  if (settings && 'type' in settings && settings.type === 'embedding') {
    const { type, ...embeddingSettings } = settings;
    return new TransformersJSEmbeddingModel(modelId, embeddingSettings);
  }

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

  return new TransformersJSLanguageModel(modelId, settings as TransformersJSModelSettings);
}

// Server-side singleton cache for language model instances
const serverLanguageModelSingletons = new Map<string, TransformersJSLanguageModel>();

function getLanguageModelKey(modelId: string, settings?: TransformersJSModelSettings): string {
  const device = (settings?.device ?? "auto").toString();
  const dtype = (settings?.dtype ?? "auto").toString();
  const isVision = !!settings?.isVisionModel;
  return `${modelId}::${device}::${dtype}::${isVision ? "vision" : "text"}`;
}