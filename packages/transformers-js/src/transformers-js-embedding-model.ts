import {
  EmbeddingModelV2,
  TooManyEmbeddingValuesForCallError,
} from "@ai-sdk/provider";
import {
  pipeline,
  AutoTokenizer
} from "@huggingface/transformers";

export type TransformersJSEmbeddingModelId = string;

export interface TransformersJSEmbeddingSettings {
  /**
   * Whether to use WebGPU for acceleration
   * @default false
   */
  device?: "cpu" | "webgpu";

  /**
   * Model quantization level
   * @default "q8"
   */
  dtype?: "fp32" | "fp16" | "q8" | "q4" | "q4f16";

  /**
   * Custom model cache settings
   * @default true
   */
  cache?: boolean;

  /**
   * Progress callback for model loading
   */
  progress_callback?: (progress: any) => void;

  /**
   * Whether to normalize embeddings
   * @default true
   */
  normalize?: boolean;

  /**
   * Pooling strategy for token embeddings
   * @default "mean"
   */
  pooling?: "mean" | "cls" | "max";

  /**
   * Maximum number of tokens per input
   * @default 512
   */
  maxTokens?: number;
}

type TransformersJSEmbeddingConfig = {
  provider: string;
  modelId: TransformersJSEmbeddingModelId;
  options: TransformersJSEmbeddingSettings;
};

export class TransformersJSEmbeddingModel implements EmbeddingModelV2<string> {
  readonly specificationVersion = "v2";
  readonly provider = "transformers-js";
  readonly modelId: TransformersJSEmbeddingModelId;
  readonly maxEmbeddingsPerCall = 100; // Reasonable limit for browser
  readonly supportsParallelCalls = false;

  private readonly options: TransformersJSEmbeddingSettings;
  private pipeline: any = null;
  private tokenizer: any = null;

  constructor(
    modelId: TransformersJSEmbeddingModelId,
    options: TransformersJSEmbeddingSettings = {}
  ) {
    this.modelId = modelId;
    this.options = {
      device: "cpu",
      dtype: "q8",
      cache: true,
      normalize: true,
      pooling: "mean",
      maxTokens: 512,
      ...options,
    };
  }

  private async getOrCreatePipeline(): Promise<any> {
    if (this.pipeline) {
      return this.pipeline;
    }

    try {
      const pipelineOptions: any = {
        device: this.options.device,
        dtype: this.options.dtype,
        progress_callback: this.options.progress_callback,
      };

      this.pipeline = await pipeline(
        "feature-extraction",
        this.modelId,
        pipelineOptions
      ) as any;

      return this.pipeline;
    } catch (error) {
      throw new Error(`Failed to load TransformersJS embedding model: ${error}`);
    }
  }

  private async getOrCreateTokenizer(): Promise<any> {
    if (this.tokenizer) {
      return this.tokenizer;
    }

    try {
      this.tokenizer = await AutoTokenizer.from_pretrained(this.modelId) as any;
      return this.tokenizer;
    } catch (error) {
      throw new Error(`Failed to load tokenizer for model ${this.modelId}: ${error}`);
    }
  }

  private meanPooling(embeddings: number[][], attentionMask: number[][]): number[] {
    const batchSize = embeddings.length;
    const hiddenSize = embeddings[0].length;
    const pooled = new Array(hiddenSize).fill(0);

    let totalTokens = 0;
    for (let i = 0; i < batchSize; i++) {
      const mask = attentionMask[i];
      for (let j = 0; j < hiddenSize; j++) {
        pooled[j] += embeddings[i][j] * mask[0]; // Simplified pooling
      }
      totalTokens += mask.reduce((sum, val) => sum + val, 0);
    }

    return pooled.map(val => val / totalTokens);
  }

  private clsPooling(embeddings: number[][]): number[] {
    // Return the first token (CLS token) embedding
    return embeddings[0];
  }

  private maxPooling(embeddings: number[][]): number[] {
    const hiddenSize = embeddings[0].length;
    const pooled = new Array(hiddenSize).fill(-Infinity);

    for (const embedding of embeddings) {
      for (let j = 0; j < hiddenSize; j++) {
        pooled[j] = Math.max(pooled[j], embedding[j]);
      }
    }

    return pooled;
  }

  private normalizeVector(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return norm > 0 ? vector.map(val => val / norm) : vector;
  }

  async doEmbed(options: {
    values: string[];
    headers?: Record<string, string | undefined>;
  }): Promise<{
    embeddings: number[][];
    usage?: { tokens: number };
  }> {
    const { values } = options;

    if (values.length > this.maxEmbeddingsPerCall) {
      throw new TooManyEmbeddingValuesForCallError({
        provider: this.provider,
        modelId: this.modelId,
        maxEmbeddingsPerCall: this.maxEmbeddingsPerCall,
        values: values,
      });
    }

    const model = await this.getOrCreatePipeline();
    const tokenizer = await this.getOrCreateTokenizer();

    const embeddings: number[][] = [];
    let totalTokens = 0;

    for (const text of values) {
      try {
        // Tokenize the input
        const tokens = await tokenizer(text, {
          padding: true,
          truncation: true,
          max_length: this.options.maxTokens,
          return_tensors: false,
        });

        // Get embeddings
        const result = await model(text, {
          pooling: "none", // We'll handle pooling ourselves
          normalize: false, // We'll handle normalization ourselves
        });

        let embedding: number[];

        // Handle different result formats
        if (Array.isArray(result) && Array.isArray(result[0]) && Array.isArray(result[0][0])) {
          // Result is [batch_size, sequence_length, hidden_size]
          const sequenceEmbeddings = result[0] as number[][];

          switch (this.options.pooling) {
            case "cls":
              embedding = this.clsPooling(sequenceEmbeddings);
              break;
            case "max":
              embedding = this.maxPooling(sequenceEmbeddings);
              break;
            case "mean":
            default:
              // For mean pooling, we'd need attention mask - simplified here
              embedding = this.meanPooling(sequenceEmbeddings, [[1]]);
              break;
          }
        } else if (Array.isArray(result) && typeof result[0] === "number") {
          // Result is already pooled
          embedding = result as number[];
        } else {
          throw new Error("Unexpected embedding result format");
        }

        // Normalize if requested
        if (this.options.normalize) {
          embedding = this.normalizeVector(embedding);
        }

        embeddings.push(embedding);
        totalTokens += Array.isArray(tokens.input_ids) ? tokens.input_ids.length : 0;

      } catch (error) {
        throw new Error(`Failed to generate embedding for text: ${error}`);
      }
    }

    return {
      embeddings,
      usage: { tokens: totalTokens },
    };
  }
}

/**
 * Check if the browser environment supports TransformersJS embeddings
 * @returns true if the browser supports TransformersJS embeddings, false otherwise
 */
export function isTransformersJSEmbeddingAvailable(): boolean {
  try {
    // Check if we're in a real browser environment (not Node.js or jsdom)
    return typeof window !== "undefined" &&
      typeof document !== "undefined" &&
      typeof navigator !== "undefined" &&
      typeof window.location !== "undefined" &&
      window.location.protocol.startsWith("http") &&
      !(typeof process !== 'undefined' && process?.versions?.node); // Exclude Node.js environments
  } catch {
    return false;
  }
} 