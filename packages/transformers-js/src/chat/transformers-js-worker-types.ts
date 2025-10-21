import type {
  PreTrainedTokenizer,
  PreTrainedModel,
  PretrainedModelOptions,
  Processor,
  ProgressInfo,
} from "@huggingface/transformers";

export interface GenerationOptions {
  max_new_tokens?: number;
  temperature?: number;
  top_k?: number;
  top_p?: number;
  do_sample?: boolean;
  repetition_penalty?: number;
  num_beams?: number;
  early_stopping?: boolean;
}

export type { ProgressInfo } from "@huggingface/transformers";

/**
 * Message types for worker communication
 */
export type WorkerMessage = {
  type: "load" | "generate" | "interrupt" | "reset";
  data?: any;
  generationOptions?: {
    max_new_tokens?: number;
    temperature?: number;
    top_k?: number;
    top_p?: number;
    do_sample?: boolean;
    repetition_penalty?: number;
  };
  tools?: any[]; // Tool definitions for tool calling
};

/**
 * Worker response types
 */
export type WorkerResponse =
  | {
      status: "loading" | "ready" | "start" | "update" | "complete" | "error";
      output?: string | string[];
      data?: string;
      tps?: number;
      numTokens?: number;
      toolCalls?: any[]; // Parsed tool calls from the response
    }
  | ProgressInfo;

/**
 * Type for worker global scope
 */
export interface WorkerGlobalScope {
  postMessage(message: any): void;
  addEventListener(type: string, listener: (e: any) => void): void;
}

/**
 * Model instance types
 */
export type ModelInstance =
  | [PreTrainedTokenizer, PreTrainedModel]
  | [Processor, PreTrainedModel];

/**
 * Configuration options for worker model loading
 */
export interface WorkerLoadOptions
  extends Pick<PretrainedModelOptions, "dtype" | "device"> {
  modelId?: string;
  use_external_data_format?: boolean;
  isVisionModel?: boolean;
}
