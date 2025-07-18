import { describe, it, expect } from "vitest";
import { transformersJS, models, checkTransformersJSSupport } from "../src/transformers-js-provider";
import { TransformersJSLanguageModel } from "../src/transformers-js-language-model";
import { TransformersJSEmbeddingModel } from "../src/transformers-js-embedding-model";

describe("transformersJS provider", () => {
  describe("transformersJS function - legacy provider pattern", () => {
    it("should create provider with language and embedding model factories", () => {
      const provider = transformersJS();

      expect(provider).toHaveProperty("languageModel");
      expect(provider).toHaveProperty("embeddingModel");
      expect(typeof provider.languageModel).toBe("function");
      expect(typeof provider.embeddingModel).toBe("function");
    });

    it("should create language model instance", () => {
      const provider = transformersJS();
      const model = provider.languageModel("Xenova/gpt2");

      expect(model).toBeInstanceOf(TransformersJSLanguageModel);
      expect(model.modelId).toBe("Xenova/gpt2");
    });

    it("should create embedding model instance", () => {
      const provider = transformersJS();
      const model = provider.embeddingModel("Xenova/all-MiniLM-L6-v2");

      expect(model).toBeInstanceOf(TransformersJSEmbeddingModel);
      expect(model.modelId).toBe("Xenova/all-MiniLM-L6-v2");
    });

    it("should accept baseUrl option", () => {
      const provider = transformersJS({ baseUrl: "https://custom-hub.com" });

      expect(provider).toHaveProperty("languageModel");
      expect(provider).toHaveProperty("embeddingModel");
    });
  });

  describe("transformersJS function - direct constructor pattern", () => {
    it("should create language model directly", () => {
      const model = transformersJS("Xenova/gpt2");

      expect(model).toBeInstanceOf(TransformersJSLanguageModel);
      expect(model.modelId).toBe("Xenova/gpt2");
    });

    it("should create language model with settings", () => {
      const model = transformersJS("Xenova/gpt2", {
        device: "cpu",
        dtype: "q4f16",
      });

      expect(model).toBeInstanceOf(TransformersJSLanguageModel);
      expect(model.modelId).toBe("Xenova/gpt2");
    });

    it("should create embedding model when type is specified", () => {
      const model = transformersJS("Xenova/all-MiniLM-L6-v2", {
        type: "embedding",
      });

      expect(model).toBeInstanceOf(TransformersJSEmbeddingModel);
      expect(model.modelId).toBe("Xenova/all-MiniLM-L6-v2");
    });

    it("should create language model with progress callback", () => {
      const progressCallback = () => { };
      const model = transformersJS("Xenova/gpt2", {
        initProgressCallback: progressCallback,
      });

      expect(model).toBeInstanceOf(TransformersJSLanguageModel);
      expect(model.modelId).toBe("Xenova/gpt2");
    });
  });

  describe("models configuration", () => {
    it("should have text generation models", () => {
      expect(models.text).toHaveProperty("gpt2");
      expect(models.text).toHaveProperty("distilgpt2");
      expect(models.text).toHaveProperty("tinyLlama");
      expect(models.text).toHaveProperty("phi3");
    });

    it("should have embedding models", () => {
      expect(models.embedding).toHaveProperty("allMiniLM");
      expect(models.embedding).toHaveProperty("allDistilroberta");
      expect(models.embedding).toHaveProperty("bgeSmall");
      expect(models.embedding).toHaveProperty("e5Small");
    });
  });

  describe("checkTransformersJSSupport", () => {
    it("should return support information", async () => {
      const support = await checkTransformersJSSupport();

      expect(support).toHaveProperty("supported");
      expect(support).toHaveProperty("webgpu");
      expect(support).toHaveProperty("features");
      expect(support.features).toHaveProperty("wasm");
      expect(support.features).toHaveProperty("sharedArrayBuffer");
      expect(support.features).toHaveProperty("crossOriginIsolated");

      expect(typeof support.supported).toBe("boolean");
      expect(typeof support.webgpu).toBe("boolean");
    });
  });
}); 