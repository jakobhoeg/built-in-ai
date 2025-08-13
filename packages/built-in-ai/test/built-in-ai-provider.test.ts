import { describe, it, expect, vi, beforeEach } from "vitest";
import { builtInAI, createBuiltInAI } from "../src/built-in-ai-provider";
import { BuiltInAIChatLanguageModel } from "../src/built-in-ai-language-model";
import { BuiltInAIEmbeddingModel } from "../src/built-in-ai-embedding-model";

// Mock the dependencies
vi.mock("../src/built-in-ai-language-model", () => ({
  BuiltInAIChatLanguageModel: vi.fn(),
}));

vi.mock("../src/built-in-ai-embedding-model", () => ({
  BuiltInAIEmbeddingModel: vi.fn(),
}));

describe("BuiltInAI Provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createBuiltInAI", () => {
    it("should create a provider with all expected methods", () => {
      const provider = createBuiltInAI();

      expect(provider).toBeInstanceOf(Function);
      expect(provider.languageModel).toBeInstanceOf(Function);
      expect(provider.chat).toBeInstanceOf(Function);
      expect(provider.textEmbedding).toBeInstanceOf(Function);
      expect(provider.textEmbeddingModel).toBeInstanceOf(Function);
      expect(provider.imageModel).toBeInstanceOf(Function);
      expect(provider.speechModel).toBeInstanceOf(Function);
      expect(provider.transcriptionModel).toBeInstanceOf(Function);
    });

    it("should prevent calling with new keyword", () => {
      const provider = createBuiltInAI();

      expect(() => {
        // @ts-expect-error - intentionally testing invalid usage
        new provider("text");
      }).toThrow(
        "The BuiltInAI model function cannot be called with the new keyword.",
      );
    });
  });

  describe("Language Model Creation", () => {
    it("should create language model via direct call with explicit model ID", () => {
      const provider = createBuiltInAI();
      provider("text", { temperature: 0.5 });

      expect(BuiltInAIChatLanguageModel).toHaveBeenCalledWith("text", {
        temperature: 0.5,
      });
    });

    it("should create language model via direct call with default model ID", () => {
      const provider = createBuiltInAI();
      provider(undefined, { temperature: 0.5 });

      expect(BuiltInAIChatLanguageModel).toHaveBeenCalledWith("text", {
        temperature: 0.5,
      });
    });

    it("should create language model via direct call with no parameters", () => {
      const provider = createBuiltInAI();
      provider();

      expect(BuiltInAIChatLanguageModel).toHaveBeenCalledWith(
        "text",
        undefined,
      );
    });

    it("should create language model via languageModel method", () => {
      const provider = createBuiltInAI();
      provider.languageModel("text", { temperature: 0.7 });

      expect(BuiltInAIChatLanguageModel).toHaveBeenCalledWith("text", {
        temperature: 0.7,
      });
    });

    it("should create language model via chat method", () => {
      const provider = createBuiltInAI();
      provider.chat("text", { temperature: 0.9 });

      expect(BuiltInAIChatLanguageModel).toHaveBeenCalledWith("text", {
        temperature: 0.9,
      });
    });
  });

  describe("Embedding Model Creation", () => {
    it("should create embedding model via textEmbedding method", () => {
      const provider = createBuiltInAI();
      const settings = { l2Normalize: true };
      provider.textEmbedding("embedding", settings);

      expect(BuiltInAIEmbeddingModel).toHaveBeenCalledWith(settings);
    });

    it("should create embedding model via textEmbeddingModel method", () => {
      const provider = createBuiltInAI();
      const settings = { quantize: true };
      provider.textEmbeddingModel("embedding", settings);

      expect(BuiltInAIEmbeddingModel).toHaveBeenCalledWith(settings);
    });
  });

  describe("Unsupported Model Types", () => {
    it("should throw NoSuchModelError for image models", () => {
      const provider = createBuiltInAI();

      expect(() => provider.imageModel("image")).toThrow();
    });

    it("should throw NoSuchModelError for speech models", () => {
      const provider = createBuiltInAI();

      expect(() => provider.speechModel("speech")).toThrow();
    });

    it("should throw NoSuchModelError for transcription models", () => {
      const provider = createBuiltInAI();

      expect(() => provider.transcriptionModel("transcribe")).toThrow();
    });
  });

  describe("Default Provider Instance", () => {
    it("should export a default provider instance", () => {
      expect(builtInAI).toBeInstanceOf(Function);
      expect(builtInAI.textEmbedding).toBeInstanceOf(Function);
      expect(builtInAI.chat).toBeInstanceOf(Function);
    });

    it("should work with the new API pattern", () => {
      builtInAI.textEmbedding("embedding", { l2Normalize: true });

      expect(BuiltInAIEmbeddingModel).toHaveBeenCalledWith({
        l2Normalize: true,
      });
    });
  });
});
