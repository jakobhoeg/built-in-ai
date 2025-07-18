import { describe, it, expect, vi, beforeEach } from "vitest";
import { TransformersJSLanguageModel, isTransformersJSAvailable } from "../src/transformers-js-language-model";

// Mock the transformers module
vi.mock("@huggingface/transformers", () => ({
  pipeline: vi.fn(),
  AutoTokenizer: {
    from_pretrained: vi.fn(),
  },
  AutoModelForCausalLM: {
    from_pretrained: vi.fn(),
  },
  TextStreamer: vi.fn(),
  StoppingCriteria: vi.fn(),
}));

// Mock navigator.gpu
Object.defineProperty(global, 'navigator', {
  value: {
    gpu: {
      requestAdapter: vi.fn().mockResolvedValue({
        features: {
          has: vi.fn().mockReturnValue(true),
        },
      }),
    },
  },
  writable: true,
});

// Mock window, document, etc for browser environment check
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

Object.defineProperty(global, 'SharedArrayBuffer', {
  value: function SharedArrayBuffer() { },
  writable: true,
});

Object.defineProperty(global, 'crossOriginIsolated', {
  value: true,
  writable: true,
});

describe("TransformersJSLanguageModel", () => {
  let model: TransformersJSLanguageModel;

  beforeEach(() => {
    vi.clearAllMocks();
    model = new TransformersJSLanguageModel("Xenova/gpt2");
  });

  describe("constructor", () => {
    it("should create instance with correct properties", () => {
      expect(model.specificationVersion).toBe("v2");
      expect(model.provider).toBe("transformers-js");
      expect(model.modelId).toBe("Xenova/gpt2");
      expect(model.supportsParallelCalls).toBe(false);
    });

    it("should accept optional settings", () => {
      const modelWithSettings = new TransformersJSLanguageModel("Xenova/gpt2", {
        device: "cpu",
        dtype: "q4f16",
      });
      expect(modelWithSettings.modelId).toBe("Xenova/gpt2");
    });

    it("should use default settings when none provided", () => {
      const defaultModel = new TransformersJSLanguageModel("HuggingFaceTB/SmolLM2-1.7B-Instruct");
      expect(defaultModel.modelId).toBe("HuggingFaceTB/SmolLM2-1.7B-Instruct");
      // Default settings are applied in the config object
    });

    it("should accept progress callback", () => {
      const progressCallback = vi.fn();
      const modelWithCallback = new TransformersJSLanguageModel("Xenova/gpt2", {
        initProgressCallback: progressCallback,
      });
      expect(modelWithCallback.modelId).toBe("Xenova/gpt2");
    });
  });

  describe("supportedUrls", () => {
    it("should return empty object", () => {
      expect(model.supportedUrls).toEqual({});
    });
  });
});

describe("isTransformersJSAvailable", () => {
  it("should return true in mocked browser environment", () => {
    expect(isTransformersJSAvailable()).toBe(true);
  });

  it("should return false when window is undefined", () => {
    const originalWindow = global.window;
    // @ts-ignore
    delete global.window;

    expect(isTransformersJSAvailable()).toBe(false);

    global.window = originalWindow;
  });

  it("should return false when document is undefined", () => {
    const originalDocument = global.document;
    // @ts-ignore
    delete global.document;

    expect(isTransformersJSAvailable()).toBe(false);

    global.document = originalDocument;
  });

  it("should return false when navigator is undefined", () => {
    const originalNavigator = global.navigator;
    // @ts-ignore
    delete global.navigator;

    expect(isTransformersJSAvailable()).toBe(false);

    global.navigator = originalNavigator;
  });
}); 