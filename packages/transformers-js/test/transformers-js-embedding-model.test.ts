import { describe, it, expect, vi, beforeEach } from "vitest";
// Import the embedding model directly to avoid pulling in chat LM and its extra mocks
import { TransformersJSEmbeddingModel } from "../src/embedding/transformers-js-embedding-model";

const mockPipelineFn = vi.fn();
const mockTokenizer: any = { call: vi.fn() };

vi.mock("@huggingface/transformers", () => {
  return {
    pipeline: vi
      .fn()
      .mockImplementation((task: string, modelId: string, _opts: any) => {
        mockPipelineFn(task, modelId);
        // Return a function that simulates feature-extraction pipeline
        return vi.fn().mockImplementation(async (_text: string, _opts: any) => {
          // [batch, seqLen, hidden] shape
          return [
            [
              [1, 2, 3, 4],
              [2, 3, 4, 5],
              [0, 0, 0, 1],
            ],
          ];
        });
      }),
    AutoTokenizer: {
      from_pretrained: vi.fn().mockResolvedValue(
        // Minimal tokenizer that returns token ids length
        (input: string) => ({
          input_ids: new Array(Math.max(1, input.length % 5)).fill(1),
        }),
      ),
    },
  };
});

describe("TransformersJSEmbeddingModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("embeds a single value with mean pooling and normalization", async () => {
    const model = new TransformersJSEmbeddingModel("Xenova/all-MiniLM-L6-v2");
    const { embeddings, usage } = await model.doEmbed({ values: ["hello"] });

    expect(embeddings).toHaveLength(1);
    expect(embeddings[0].length).toBe(4);
    // Vector should be normalized (L2 norm ~1)
    const norm = Math.sqrt(embeddings[0].reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
    expect(usage?.tokens).toBeGreaterThan(0);
    expect(mockPipelineFn).toHaveBeenCalledWith(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
    );
  });

  it("throws when exceeding maxEmbeddingsPerCall", async () => {
    const model = new TransformersJSEmbeddingModel("Xenova/all-MiniLM-L6-v2");
    const inputs = new Array(101).fill("x");
    await expect(model.doEmbed({ values: inputs })).rejects.toThrow();
  });
});
