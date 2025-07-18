import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  TransformersJSEmbeddingModel,
  isTransformersJSEmbeddingAvailable
} from "../src/transformers-js-embedding-model";

// Mock the transformers module
vi.mock("@huggingface/transformers", () => ({
  pipeline: vi.fn(),
  AutoTokenizer: {
    from_pretrained: vi.fn(),
  },
}));

// Mock browser environment for embedding tests
Object.defineProperty(global, 'window', {
  value: {
    location: {
      protocol: 'https:',
    },
  },
  writable: true,
});

Object.defineProperty(global, 'document', {
  value: {},
  writable: true,
});

Object.defineProperty(global, 'navigator', {
  value: {},
  writable: true,
});

// Mock process to exclude Node.js detection  
Object.defineProperty(global, 'process', {
  value: {
    versions: undefined, // This will make the Node.js check fail
  },
  writable: true,
});

describe("TransformersJSEmbeddingModel", () => {
  let model: TransformersJSEmbeddingModel;

  beforeEach(() => {
    vi.clearAllMocks();
    model = new TransformersJSEmbeddingModel("Xenova/all-MiniLM-L6-v2");
  });

  describe("constructor", () => {
    it("should create instance with correct properties", () => {
      expect(model.specificationVersion).toBe("v2");
      expect(model.provider).toBe("transformers-js");
      expect(model.modelId).toBe("Xenova/all-MiniLM-L6-v2");
      expect(model.maxEmbeddingsPerCall).toBe(100);
      expect(model.supportsParallelCalls).toBe(false);
    });

    it("should accept optional settings", () => {
      const modelWithSettings = new TransformersJSEmbeddingModel("Xenova/all-MiniLM-L6-v2", {
        device: "cpu",
        dtype: "q8",
        normalize: false,
        pooling: "cls",
      });
      expect(modelWithSettings.modelId).toBe("Xenova/all-MiniLM-L6-v2");
    });

    it("should use default settings when none provided", () => {
      const defaultModel = new TransformersJSEmbeddingModel("Xenova/bge-small-en-v1.5");
      expect(defaultModel.modelId).toBe("Xenova/bge-small-en-v1.5");
    });

    it("should accept progress callback", () => {
      const progressCallback = vi.fn();
      const modelWithCallback = new TransformersJSEmbeddingModel("Xenova/all-MiniLM-L6-v2", {
        progress_callback: progressCallback,
      });
      expect(modelWithCallback.modelId).toBe("Xenova/all-MiniLM-L6-v2");
    });
  });
});

describe("isTransformersJSEmbeddingAvailable", () => {
  it("should return true in mocked browser environment", () => {
    expect(isTransformersJSEmbeddingAvailable()).toBe(true);
  });

  it("should return false when window is undefined", () => {
    const originalWindow = global.window;
    // @ts-ignore
    delete global.window;

    expect(isTransformersJSEmbeddingAvailable()).toBe(false);

    global.window = originalWindow;
  });

  it("should return false when document is undefined", () => {
    const originalDocument = global.document;
    // @ts-ignore
    delete global.document;

    expect(isTransformersJSEmbeddingAvailable()).toBe(false);

    global.document = originalDocument;
  });

  it("should return false when navigator is undefined", () => {
    const originalNavigator = global.navigator;
    // @ts-ignore
    delete global.navigator;

    expect(isTransformersJSEmbeddingAvailable()).toBe(false);

    global.navigator = originalNavigator;
  });
}); 