import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { WebLLMLanguageModel, webLLM } from "../src";
import { generateText, streamText } from "ai";
import { LoadSettingError } from "@ai-sdk/provider";

// Mock the external dependency
const mockChatCompletionsCreate = vi.fn();
const mockInterruptGenerate = vi.fn();
const mockReload = vi.fn();
const mockEngineConstructor = vi.fn();

vi.mock("@mlc-ai/web-llm", () => ({
  MLCEngine: vi.fn().mockImplementation((config) => {
    mockEngineConstructor(config);
    return {
      chat: {
        completions: {
          create: mockChatCompletionsCreate,
        },
      },
      reload: mockReload,
      interruptGenerate: mockInterruptGenerate,
    };
  }),
  CreateWebWorkerMLCEngine: vi.fn().mockImplementation(() =>
    Promise.resolve({
      chat: {
        completions: {
          create: mockChatCompletionsCreate,
        },
      },
      interruptGenerate: mockInterruptGenerate,
    }),
  ),
}));

describe("WebLLMLanguageModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock navigator.gpu
    Object.defineProperty(global.navigator, "gpu", {
      value: {},
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore original navigator.gpu
    Object.defineProperty(global.navigator, "gpu", {
      value: undefined,
      configurable: true,
    });
  });

  describe("constructor", () => {
    it("should create a WebLLMLanguageModel instance", () => {
      const model = new WebLLMLanguageModel(
        "Llama-3.1-8B-Instruct-q4f32_1-MLC",
      );

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

  describe("availability", () => {
    it("should return 'unavailable' if navigator.gpu is not supported", async () => {
      Object.defineProperty(global.navigator, "gpu", {
        value: undefined,
        configurable: true,
      });
      const model = new WebLLMLanguageModel("test-model");
      const availability = await model.availability();
      expect(availability).toBe("unavailable");
    });

    it("should return 'downloadable' if not initialized", async () => {
      const model = new WebLLMLanguageModel("test-model");
      const availability = await model.availability();
      expect(availability).toBe("downloadable");
    });

    it("should return 'available' if initialized", async () => {
      const model = new WebLLMLanguageModel("test-model");
      // Manually set as initialized for test purposes
      (model as any).isInitialized = true;
      const availability = await model.availability();
      expect(availability).toBe("available");
    });
  });

  describe("doGenerate", () => {
    it("should throw LoadSettingError if WebLLM is not supported", async () => {
      Object.defineProperty(global.navigator, "gpu", {
        value: undefined,
        configurable: true,
      });
      const model = new WebLLMLanguageModel("test-model");
      await expect(
        model.doGenerate({
          prompt: [
            { role: "user", content: [{ type: "text", text: "hello" }] },
          ],
        }),
      ).rejects.toThrow(
        new LoadSettingError({
          message:
            "WebLLM is not available. This library requires a browser with WebGPU support.",
        }),
      );
    });

    it("should generate text successfully", async () => {
      mockChatCompletionsCreate.mockResolvedValue({
        choices: [
          {
            message: { content: "Hello, world!" },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      });

      const model = new WebLLMLanguageModel("test-model");
      const { text, usage } = await generateText({
        model,
        prompt: "Say hello",
      });

      expect(text).toBe("Hello, world!");
      expect(usage).toEqual({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      });
      expect(mockReload).toHaveBeenCalledWith("test-model");
      expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: "user", content: "Say hello" }],
          stream: false,
        }),
      );
    });
  });

  describe("doStream", () => {
    it("should stream text successfully", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async function* createAsyncGenerator(): AsyncGenerator<
        any,
        void,
        unknown
      > {
        yield {
          choices: [{ delta: { content: "Hello" } }],
        };
        yield {
          choices: [{ delta: { content: ", " } }],
        };
        yield {
          choices: [{ delta: { content: "world!" } }],
        };
        yield {
          choices: [
            {
              delta: {},
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        };
      }

      mockChatCompletionsCreate.mockResolvedValue(createAsyncGenerator());

      const model = new WebLLMLanguageModel("test-model");
      const { textStream, usage } = await streamText({
        model,
        prompt: "Say hello",
      });

      let text = "";
      for await (const chunk of textStream) {
        text += chunk;
      }

      expect(text).toBe("Hello, world!");
      const usageResult = await usage;
      expect(usageResult).toEqual({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      });

      expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: "user", content: "Say hello" }],
          stream: true,
        }),
      );
    });
  });

  describe("createSessionWithProgress", () => {
    it("should call initProgressCallback during initialization", async () => {
      mockEngineConstructor.mockImplementation((config) => {
        if (config.initProgressCallback) {
          config.initProgressCallback({ progress: 0.5, text: "loading" });
        }
      });

      const model = new WebLLMLanguageModel("test-model");
      const initProgressCallback = vi.fn();

      await model.createSessionWithProgress(initProgressCallback);

      expect(initProgressCallback).toHaveBeenCalledWith({
        progress: 0.5,
        text: "loading",
      });
    });
  });
});
