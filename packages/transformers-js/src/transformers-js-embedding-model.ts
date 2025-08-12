import {
  EmbeddingModelV2,
  TooManyEmbeddingValuesForCallError,
} from "@ai-sdk/provider";
import {
  pipeline,
  AutoTokenizer,
  type PreTrainedTokenizer,
  type ProgressInfo,
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
  progress_callback?: (progress: ProgressInfo) => void;

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

export class TransformersJSEmbeddingModel implements EmbeddingModelV2<string> {
  readonly specificationVersion = "v2";
  readonly provider = "transformers-js";
  readonly modelId: TransformersJSEmbeddingModelId;
  readonly maxEmbeddingsPerCall = 100; // Reasonable limit for browser
  readonly supportsParallelCalls = false;

  private readonly options: TransformersJSEmbeddingSettings;
  private pipeline: any = null; // FeatureExtractionPipelineType causes complex union type error
  private tokenizer: PreTrainedTokenizer | null = null;

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

  private async getOrCreatePipeline() {
    if (!this.pipeline) {
      try {
        this.pipeline = await pipeline("feature-extraction", this.modelId, {
          device: this.options.device as any,
          dtype: this.options.dtype as any,
          progress_callback: this.options.progress_callback,
        });
      } catch (error) {
        throw new Error(`Failed to load TransformersJS embedding model: ${error}`);
      }
    }
    return this.pipeline;
  }

  private async getOrCreateTokenizer(): Promise<PreTrainedTokenizer> {
    if (!this.tokenizer) {
      try {
        this.tokenizer = await AutoTokenizer.from_pretrained(this.modelId);
      } catch (error) {
        throw new Error(`Failed to load tokenizer for model ${this.modelId}: ${error}`);
      }
    }
    return this.tokenizer;
  }

  private applyPooling(embeddings: number[][], pooling: string): number[] {
    if (pooling === "cls") {
      return embeddings[0]; // Return first token (CLS token)
    }

    const hiddenSize = embeddings[0].length;

    if (pooling === "max") {
      const pooled = new Array(hiddenSize).fill(-Infinity);
      for (const embedding of embeddings) {
        for (let j = 0; j < hiddenSize; j++) {
          pooled[j] = Math.max(pooled[j], embedding[j]);
        }
      }
      return pooled;
    }

    // Default: mean pooling
    const result = new Array(hiddenSize).fill(0);
    for (const embedding of embeddings) {
      for (let j = 0; j < hiddenSize; j++) {
        result[j] += embedding[j];
      }
    }
    return result.map(val => val / embeddings.length);
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

    const embeddings = await Promise.all(
      values.map(async (text) => {
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
            embedding = this.applyPooling(result[0] as number[][], this.options.pooling || "mean");
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

          return { embedding, tokenCount: Array.isArray(tokens.input_ids) ? tokens.input_ids.length : 0 };
        } catch (error) {
          throw new Error(`Failed to generate embedding for text: ${error}`);
        }
      })
    );

    const totalTokens = embeddings.reduce((sum, { tokenCount }) => sum + tokenCount, 0);

    return {
      embeddings: embeddings.map(({ embedding }) => embedding),
      usage: { tokens: totalTokens },
    };
  }
}