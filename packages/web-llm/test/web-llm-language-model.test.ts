import { describe, it, expect } from "vitest";
import { WebLLMLanguageModel, webLLM } from "../src";

describe("WebLLMLanguageModel", () => {
  it("should create a WebLLMLanguageModel instance", () => {
    const model = new WebLLMLanguageModel("Llama-3.1-8B-Instruct-q4f32_1-MLC");

    expect(model).toBeInstanceOf(WebLLMLanguageModel);
    expect(model.specificationVersion).toBe("v2");
    expect(model.provider).toBe("web-llm");
    expect(model.modelId).toBe("Llama-3.1-8B-Instruct-q4f32_1-MLC");
  });

  it("should create a model using the factory function", () => {
    const model = webLLM("Llama-3.1-8B-Instruct-q4f32_1-MLC");

    expect(model).toBeInstanceOf(WebLLMLanguageModel);
    expect(model.modelId).toBe("Llama-3.1-8B-Instruct-q4f32_1-MLC");
  });

  it("should accept settings in the factory function", () => {
    const model = webLLM("Llama-3.1-8B-Instruct-q4f32_1-MLC", {
      initProgressCallback: (progress) => console.log(progress),
    });

    expect(model).toBeInstanceOf(WebLLMLanguageModel);
  });
});
