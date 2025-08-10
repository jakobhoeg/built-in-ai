import type {
  PreTrainedTokenizer,
  PreTrainedModel,
  PretrainedModelOptions,
  Processor,
} from "@huggingface/transformers";

/**
 * Progress callback type for model loading in workers
 */
export type TransformersJSProgressCallback = (progress: {
  status: string;
  progress?: number;
  loaded?: number;
  total?: number;
  file?: string;
  message?: string;
}) => void;

/**
 * Message types for worker communication
 */
export type TransformersJSWorkerMessage = {
  type: 'load' | 'generate' | 'interrupt' | 'reset';
  data?: any;
};

/**
 * Worker response types
 */
export type TransformersJSWorkerResponse = {
  status: 'loading' | 'ready' | 'start' | 'update' | 'complete' | 'error';
  output?: string | string[];
  data?: string;
  tps?: number;
  numTokens?: number;
  progress?: number;
  message?: string;
};

/**
 * Type for model generation output
 */
export type TransformersJSGenerationOutput = {
  past_key_values?: any;
  sequences: any;
};

/**
 * Type for key-value cache from model generation
 */
export type TransformersJSKeyValueCache = {
  [key: string]: any; // The exact structure depends on the model architecture
} | null;

/**
 * Type for worker global scope
 */
export interface TransformersJSWorkerGlobalScope {
  postMessage(message: any): void;
  addEventListener(type: string, listener: (e: any) => void): void;
}

/**
 * Return type for TextGenerationPipeline.getInstance() - text models
 */
export type TransformersJSModelInstance = [PreTrainedTokenizer, PreTrainedModel];

/**
 * Return type for VisionGenerationPipeline.getInstance() - vision models
 */
export type TransformersJSVisionModelInstance = [Processor, PreTrainedModel];

/**
 * Configuration options for worker model loading
 */
export interface TransformersJSWorkerLoadOptions {
  modelId?: string;
  dtype?: PretrainedModelOptions["dtype"];
  device?: PretrainedModelOptions["device"];
  use_external_data_format?: boolean;
  isVisionModel?: boolean;
}
