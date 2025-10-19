import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateText, streamText, generateObject } from "ai";
import { z } from "zod";

vi.mock("@huggingface/transformers", () => {
  // Create a tokenizer function that also has methods
  const tokenizer = vi.fn().mockReturnValue({ input_ids: [1, 2, 3] });
  (tokenizer as any).apply_chat_template = vi.fn();
  (tokenizer as any).decode = vi.fn();

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
    AutoModelForCausalLM: { from_pretrained: vi.fn().mockResolvedValue(model) },
    TextStreamer,
    StoppingCriteria,
    StoppingCriteriaList,
    __TEST_MOCK__: { tokenizer, model },
  };
});

import { TransformersJSLanguageModel } from "../src";

describe("TransformersJSLanguageModel", () => {
  let tokenizerMock: any;
  let modelMock: any;
  beforeEach(() => {
    vi.clearAllMocks();
    // Load mocked module to access test doubles
    return import("@huggingface/transformers").then((m: any) => {
      tokenizerMock = m.__TEST_MOCK__.tokenizer;
      modelMock = m.__TEST_MOCK__.model;
    });
  });

  it("instantiates and reports downloadable before init", async () => {
    const model = new TransformersJSLanguageModel(
      "HuggingFaceTB/SmolLM2-360M-Instruct",
    );
    const availability = await model.availability();
    expect(availability).toBe("downloadable");
  });

  it("generate returns text and usage", async () => {
    const model = new TransformersJSLanguageModel(
      "HuggingFaceTB/SmolLM2-360M-Instruct",
    );

    // tokenizer returns tensors/arrays the class expects
    tokenizerMock.apply_chat_template.mockReturnValue({
      input_ids: { data: new Array(5).fill(1) },
    });

    // mock model.generate to return a sequence longer than input_ids so decode sees new tokens
    const outputIds = new Array(5).fill(1).concat([101, 102, 103]);
    (modelMock.generate as any).mockResolvedValue({ sequences: [outputIds] });
    tokenizerMock.decode.mockReturnValue("Hello");

    const { text, usage } = await generateText({
      model,
      prompt: "Say hello",
    });

    expect(text).toBe("Hello");
    expect(usage).toEqual({
      inputTokens: 5,
      outputTokens: 5 /* length-based */,
      totalTokens: 10,
    });
  });

  it("reports correct availability", async () => {
    const model = new TransformersJSLanguageModel(
      "HuggingFaceTB/SmolLM2-360M-Instruct",
    );
    const availability = await model.availability();
    expect(availability).toBe("downloadable");
  });

  it("should handle system messages", async () => {
    const model = new TransformersJSLanguageModel(
      "HuggingFaceTB/SmolLM2-360M-Instruct",
    );

    tokenizerMock.apply_chat_template.mockReturnValue({
      input_ids: { data: new Array(3).fill(1) },
    });
    const outputIds = new Array(3).fill(1).concat([101, 102]);
    (modelMock.generate as any).mockResolvedValue({ sequences: [outputIds] });
    tokenizerMock.decode.mockReturnValue("I am a helpful assistant.");

    const { text } = await generateText({
      model,
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Who are you?" },
      ],
    });

    expect(text).toBe("I am a helpful assistant.");
    // System message should be prepended to the first user message
    const applyChatCall = tokenizerMock.apply_chat_template.mock.calls[0];
    expect(applyChatCall[0]).toHaveLength(1);
    expect(applyChatCall[0][0].role).toBe("user");
    expect(applyChatCall[0][0].content).toContain(
      "You are a helpful assistant.",
    );
    expect(applyChatCall[0][0].content).toContain("Who are you?");
  });

  it("should handle conversation history", async () => {
    const model = new TransformersJSLanguageModel(
      "HuggingFaceTB/SmolLM2-360M-Instruct",
    );

    tokenizerMock.apply_chat_template.mockReturnValue({
      input_ids: { data: new Array(4).fill(1) },
    });
    const outputIds = new Array(4).fill(1).concat([201, 202]);
    (modelMock.generate as any).mockResolvedValue({ sequences: [outputIds] });
    tokenizerMock.decode.mockReturnValue("I can help you with coding!");

    const { text } = await generateText({
      model,
      messages: [
        { role: "user", content: "Can you help me?" },
        { role: "assistant", content: "Of course! What do you need?" },
        { role: "user", content: "I need assistance with coding." },
      ],
    });

    expect(text).toBe("I can help you with coding!");
    // Should receive full conversation history
    const applyChatCall = tokenizerMock.apply_chat_template.mock.calls[0];
    expect(applyChatCall[0]).toEqual([
      { role: "user", content: "Can you help me?" },
      { role: "assistant", content: "Of course! What do you need?" },
      { role: "user", content: "I need assistance with coding." },
    ]);
  });

  it("should stream text successfully", async () => {
    const model = new TransformersJSLanguageModel(
      "HuggingFaceTB/SmolLM2-360M-Instruct",
    );

    tokenizerMock.apply_chat_template.mockReturnValue({
      input_ids: { data: new Array(2).fill(1) },
    });

    // Mock the generate method to simulate streaming by calling the streamer callback
    (modelMock.generate as any).mockImplementation(async (args: any) => {
      // Simulate streamer callbacks synchronously
      if (args.streamer) {
        args.streamer.on_finalized_text("Hello");
        args.streamer.on_finalized_text(", ");
        args.streamer.on_finalized_text("world!");
      }
      return Promise.resolve();
    });

    const { textStream, usage } = streamText({
      model,
      prompt: "Say hello",
    });

    let acc = "";
    for await (const chunk of textStream) {
      acc += chunk;
    }

    expect(acc).toBe("Hello, world!");
    const usageResult = await usage;
    expect(usageResult.inputTokens).toBe(2);
    expect(usageResult.outputTokens).toBeGreaterThanOrEqual(1);
  });

  it("should handle empty content arrays", async () => {
    const model = new TransformersJSLanguageModel(
      "HuggingFaceTB/SmolLM2-360M-Instruct",
    );

    tokenizerMock.apply_chat_template.mockReturnValue({
      input_ids: { data: new Array(1).fill(1) },
    });
    const outputIds = new Array(1).fill(1).concat([301]);
    (modelMock.generate as any).mockResolvedValue({ sequences: [outputIds] });
    tokenizerMock.decode.mockReturnValue("Response");

    const { text } = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [],
        },
      ],
    });

    expect(text).toBe("Response");
    // Should pass empty content to chat template
    const applyChatCall = tokenizerMock.apply_chat_template.mock.calls[0];
    expect(applyChatCall[0]).toEqual([{ role: "user", content: "" }]);
  });
});
