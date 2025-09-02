import { describe, it, expect, vi, beforeEach } from "vitest";
import { experimental_transcribe as transcribe } from "ai";

vi.mock("@huggingface/transformers", () => {
  // Create a tokenizer function that also has methods
  const tokenizer = vi.fn().mockReturnValue({ input_ids: [1, 2, 3] });
  (tokenizer as any).batch_decode = vi.fn();

  const processor = vi.fn().mockResolvedValue({ input_features: [[1, 2, 3]] });

  const model = {
    generate: vi.fn().mockResolvedValue([1, 2, 3]),
  };

  class TextStreamer {
    constructor(_tokenizer: any, _options?: any) {}
    on_finalized_text(_text: string): void {}
  }
  class StoppingCriteria {
    _call() {
      return [false];
    }
  }
  class StoppingCriteriaList {
    extend(_arr: any[]) {
      /* no-op */
    }
  }

  return {
    AutoTokenizer: { from_pretrained: vi.fn().mockResolvedValue(tokenizer) },
    AutoProcessor: { from_pretrained: vi.fn().mockResolvedValue(processor) },
    WhisperForConditionalGeneration: {
      from_pretrained: vi.fn().mockResolvedValue(model),
    },
    full: vi.fn().mockReturnValue([1, 2, 3]),
    TextStreamer,
    StoppingCriteria,
    StoppingCriteriaList,
    __TEST_MOCK__: { tokenizer, processor, model },
  };
});

import { TransformersJSTranscriptionModel } from "../src";

describe("TransformersJSTranscriptionModel", () => {
  let tokenizerMock: any;
  let processorMock: any;
  let modelMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Load mocked module to access test doubles
    return import("@huggingface/transformers").then((m: any) => {
      tokenizerMock = m.__TEST_MOCK__.tokenizer;
      processorMock = m.__TEST_MOCK__.processor;
      modelMock = m.__TEST_MOCK__.model;
    });
  });

  it("instantiates and reports downloadable before init", async () => {
    const model = new TransformersJSTranscriptionModel(
      "onnx-community/whisper-base",
    );
    const availability = await model.availability();
    expect(availability).toBe("downloadable");
  });

  it("should pass the model ID during initialization", async () => {
    const model = new TransformersJSTranscriptionModel(
      "onnx-community/whisper-base",
    );

    tokenizerMock.batch_decode.mockReturnValue([
      "Hello from the Vercel AI SDK!",
    ]);
    processorMock.mockResolvedValue({ input_features: [[1, 2, 3]] });
    modelMock.generate.mockResolvedValue([101, 102, 103]);

    const audioData = new Uint8Array([1, 2, 3, 4, 5]);

    const result = await transcribe({
      model,
      audio: audioData,
    });

    expect(result.text).toBe("Hello from the Vercel AI SDK!");
  });

  it("should handle Uint8Array audio input", async () => {
    const model = new TransformersJSTranscriptionModel(
      "onnx-community/whisper-base",
    );

    tokenizerMock.batch_decode.mockReturnValue(["Test transcription"]);
    processorMock.mockResolvedValue({ input_features: [[1, 2, 3]] });
    modelMock.generate.mockResolvedValue([101, 102]);

    const audioData = new Uint8Array([1, 2, 3, 4, 5]);

    const result = await transcribe({
      model,
      audio: audioData,
    });

    expect(result.text).toBe("Test transcription");
    expect(result.segments).toEqual([]);
    expect(result.language).toBeUndefined();
    expect(result.durationInSeconds).toBe(0.0003125);
    expect(result.warnings).toEqual([]);
  });

  it("should handle ArrayBuffer audio input", async () => {
    const model = new TransformersJSTranscriptionModel(
      "onnx-community/whisper-base",
    );

    tokenizerMock.batch_decode.mockReturnValue(["ArrayBuffer transcription"]);
    processorMock.mockResolvedValue({ input_features: [[1, 2, 3]] });
    modelMock.generate.mockResolvedValue([201, 202]);

    const audioData = new ArrayBuffer(8);
    const view = new Uint8Array(audioData);
    view.set([1, 2, 3, 4, 5, 6, 7, 8]);

    const result = await transcribe({
      model,
      audio: audioData,
    });

    expect(result.text).toBe("ArrayBuffer transcription");
  });

  it("should handle base64 string audio input", async () => {
    const model = new TransformersJSTranscriptionModel(
      "onnx-community/whisper-base",
    );

    tokenizerMock.batch_decode.mockReturnValue(["Base64 transcription"]);
    processorMock.mockResolvedValue({ input_features: [[1, 2, 3]] });
    modelMock.generate.mockResolvedValue([301, 302]);

    // Simple base64 string
    const audioData = btoa("test audio data");

    const result = await transcribe({
      model,
      audio: audioData,
    });

    expect(result.text).toBe("Base64 transcription");
  });

  it("should pass language option to model generation", async () => {
    const model = new TransformersJSTranscriptionModel(
      "onnx-community/whisper-base",
    );

    tokenizerMock.batch_decode.mockReturnValue(["Bonjour le monde"]);
    processorMock.mockResolvedValue({ input_features: [[1, 2, 3]] });
    modelMock.generate.mockResolvedValue([401, 402]);

    const audioData = new Uint8Array([1, 2, 3, 4, 5]);

    const result = await transcribe({
      model,
      audio: audioData,
      providerOptions: {
        "transformers-js": {
          language: "fr",
        },
      },
    });

    expect(result.text).toBe("Bonjour le monde");

    // Check that language was passed to generate
    expect(modelMock.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        language: "fr",
      }),
    );
  });

  it("should pass return_timestamps option to model generation", async () => {
    const model = new TransformersJSTranscriptionModel(
      "onnx-community/whisper-base",
    );

    tokenizerMock.batch_decode.mockReturnValue(["Timestamped transcription"]);
    processorMock.mockResolvedValue({ input_features: [[1, 2, 3]] });
    modelMock.generate.mockResolvedValue([501, 502]);

    const audioData = new Uint8Array([1, 2, 3, 4, 5]);

    const result = await transcribe({
      model,
      audio: audioData,
      providerOptions: {
        "transformers-js": {
          returnTimestamps: true,
        },
      },
    });

    expect(result.text).toBe("Timestamped transcription");

    // Check that return_timestamps was passed to generate
    expect(modelMock.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        return_timestamps: true,
      }),
    );
  });

  it("should pass max_new_tokens option to model generation", async () => {
    const model = new TransformersJSTranscriptionModel(
      "onnx-community/whisper-base",
    );

    tokenizerMock.batch_decode.mockReturnValue(["Limited tokens"]);
    processorMock.mockResolvedValue({ input_features: [[1, 2, 3]] });
    modelMock.generate.mockResolvedValue([601, 602]);

    const audioData = new Uint8Array([1, 2, 3, 4, 5]);

    const result = await transcribe({
      model,
      audio: audioData,
      providerOptions: {
        "transformers-js": {
          maxNewTokens: 100,
        },
      },
    });

    expect(result.text).toBe("Limited tokens");

    // Check that max_new_tokens was passed to generate
    expect(modelMock.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        max_new_tokens: 100,
      }),
    );
  });

  it("should use default settings when no provider options provided", async () => {
    const model = new TransformersJSTranscriptionModel(
      "onnx-community/whisper-base",
      {
        maxNewTokens: 512,
        language: "en",
        returnTimestamps: false,
      },
    );

    tokenizerMock.batch_decode.mockReturnValue(["Default settings"]);
    processorMock.mockResolvedValue({ input_features: [[1, 2, 3]] });
    modelMock.generate.mockResolvedValue([701, 702]);

    const audioData = new Uint8Array([1, 2, 3, 4, 5]);

    const result = await transcribe({
      model,
      audio: audioData,
    });

    expect(result.text).toBe("Default settings");

    // Check that default settings were used
    expect(modelMock.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        max_new_tokens: 512,
        language: "en",
        return_timestamps: false,
      }),
    );
  });

  it("should report correct availability after initialization", async () => {
    const model = new TransformersJSTranscriptionModel(
      "onnx-community/whisper-base",
    );

    // Initially downloadable
    expect(await model.availability()).toBe("downloadable");

    // Initialize the model
    tokenizerMock.batch_decode.mockReturnValue(["Test"]);
    processorMock.mockResolvedValue({ input_features: [[1, 2, 3]] });
    modelMock.generate.mockResolvedValue([901]);

    await transcribe({
      model,
      audio: new Uint8Array([1, 2, 3]),
    });

    // Should be available after initialization
    expect(await model.availability()).toBe("available");
  });

  it("should handle transcription errors gracefully", async () => {
    const model = new TransformersJSTranscriptionModel(
      "onnx-community/whisper-base",
    );

    // Mock processor to throw an error
    processorMock.mockRejectedValue(new Error("Processing failed"));

    const audioData = new Uint8Array([1, 2, 3, 4, 5]);

    await expect(
      transcribe({
        model,
        audio: audioData,
      }),
    ).rejects.toThrow("TransformersJS transcription failed");
  });
});
