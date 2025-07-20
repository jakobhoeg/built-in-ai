import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  BuiltInAIChatLanguageModel,
  BuiltInAIChatSettings,
} from "../src/built-in-ai-language-model";

import { generateText, streamText, generateObject, streamObject } from "ai";
import { LoadSettingError } from "@ai-sdk/provider";
import { z } from "zod";

describe("BuiltInAIChatLanguageModel", () => {
  let mockSession: any;
  let mockPrompt: any;
  let mockPromptStreaming: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock session
    mockPrompt = vi.fn();
    mockPromptStreaming = vi.fn();
    mockSession = {
      prompt: mockPrompt,
      promptStreaming: mockPromptStreaming,
    };
    // Mock the global LanguageModel API
    vi.stubGlobal("LanguageModel", {
      availability: vi.fn().mockResolvedValue("available"),
      create: vi.fn().mockResolvedValue(mockSession),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should instantiate correctly", () => {
    const model = new BuiltInAIChatLanguageModel("text");
    expect(model).toBeInstanceOf(BuiltInAIChatLanguageModel);
    expect(model.modelId).toBe("text");
    expect(model.provider).toBe("browser-ai");
    expect(model.specificationVersion).toBe("v2");
  });
  it("should throw when LanguageModel is not available", async () => {
    vi.stubGlobal("LanguageModel", undefined);

    await expect(() =>
      generateText({
        model: new BuiltInAIChatLanguageModel("text"),
        prompt: "test",
      }),
    ).rejects.toThrow(LoadSettingError);
  });
  it("should throw when model is unavailable", async () => {
    vi.stubGlobal("LanguageModel", {
      availability: vi.fn().mockResolvedValue("unavailable"),
    });

    await expect(() =>
      generateText({
        model: new BuiltInAIChatLanguageModel("text"),
        prompt: "test",
      }),
    ).rejects.toThrow(LoadSettingError);
  });

  it("should generate text successfully", async () => {
    mockPrompt.mockResolvedValue("Hello, world!");

    const result = await generateText({
      model: new BuiltInAIChatLanguageModel("text"),
      prompt: "Say hello",
    });

    expect(result.text).toBe("Hello, world!");
    expect(mockPrompt).toHaveBeenCalledWith(
      [
        {
          role: "user",
          content: [{ type: "text", value: "Say hello" }],
        },
      ],
      {},
    );
  });

  it("should handle system messages", async () => {
    mockPrompt.mockResolvedValue("I am a helpful assistant.");

    const result = await generateText({
      model: new BuiltInAIChatLanguageModel("text"),
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Who are you?" },
      ],
    });

    expect(result.text).toBe("I am a helpful assistant.");
    expect(mockPrompt).toHaveBeenCalledWith(
      [
        {
          role: "user",
          content: [{ type: "text", value: "Who are you?" }],
        },
      ],
      {},
    );
  });

  it("should handle conversation history", async () => {
    mockPrompt.mockResolvedValue("I can help you with that!");

    const result = await generateText({
      model: new BuiltInAIChatLanguageModel("text"),
      messages: [
        { role: "user", content: "Can you help me?" },
        { role: "assistant", content: "Of course! What do you need?" },
        { role: "user", content: "I need assistance with coding." },
      ],
    });

    expect(result.text).toBe("I can help you with that!");
    expect(mockPrompt).toHaveBeenCalledWith(
      [
        {
          role: "user",
          content: [{ type: "text", value: "Can you help me?" }],
        },
        {
          role: "assistant",
          content: "Of course! What do you need?",
        },
        {
          role: "user",
          content: [{ type: "text", value: "I need assistance with coding." }],
        },
      ],
      {},
    );
  });

  it("should stream text successfully", async () => {
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue("Hello");
        controller.enqueue(", ");
        controller.enqueue("world!");
        controller.close();
      },
    });

    mockPromptStreaming.mockReturnValue(mockStream);

    const result = await streamText({
      model: new BuiltInAIChatLanguageModel("text"),
      prompt: "Say hello",
    });

    let text = "";
    for await (const chunk of result.textStream) {
      text += chunk;
    }

    expect(text).toBe("Hello, world!");
    expect(mockPromptStreaming).toHaveBeenCalledWith(
      [
        {
          role: "user",
          content: [{ type: "text", value: "Say hello" }],
        },
      ],
      {
        signal: undefined,
      },
    );
  });

  it("should handle JSON response format", async () => {
    const jsonResponse = JSON.stringify({ name: "John", age: 30 });
    mockPrompt.mockResolvedValue(jsonResponse);

    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const { object } = await generateObject({
      model: new BuiltInAIChatLanguageModel("text"),
      schema,
      prompt: "Create a person",
    });

    expect(object).toEqual({ name: "John", age: 30 });
    expect(mockPrompt).toHaveBeenCalledWith(
      [
        {
          role: "user",
          content: [{ type: "text", value: "Create a person" }],
        },
      ],
      {
        responseConstraint: {
          $schema: "http://json-schema.org/draft-07/schema#",
          additionalProperties: false,
          properties: {
            age: { type: "number" },
            name: { type: "string" },
          },
          required: ["name", "age"],
          type: "object",
        },
      },
    );
  });

  it("should handle object generation mode", async () => {
    const jsonResponse = JSON.stringify({ users: ["Alice", "Bob"] });
    mockPrompt.mockResolvedValue(jsonResponse);

    const schema = z.object({
      users: z.array(z.string()),
    });

    const { object } = await generateObject({
      model: new BuiltInAIChatLanguageModel("text"),
      schema,
      prompt: "List some users",
    });

    expect(object).toEqual({ users: ["Alice", "Bob"] });
    expect(mockPrompt).toHaveBeenCalledWith(
      [
        {
          role: "user",
          content: [{ type: "text", value: "List some users" }],
        },
      ],
      {
        responseConstraint: {
          $schema: "http://json-schema.org/draft-07/schema#",
          additionalProperties: false,
          properties: {
            users: {
              items: { type: "string" },
              type: "array",
            },
          },
          required: ["users"],
          type: "object",
        },
      },
    );
  });

  it("should handle complex JSON schemas", async () => {
    const jsonResponse = JSON.stringify({
      users: [
        { id: 1, name: "Alice", active: true },
        { id: 2, name: "Bob", active: false },
      ],
      total: 2,
    });

    mockPrompt.mockResolvedValue(jsonResponse);

    const schema = z.object({
      users: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          active: z.boolean(),
        }),
      ),
      total: z.number(),
    });

    const { object } = await generateObject({
      model: new BuiltInAIChatLanguageModel("text"),
      schema,
      prompt: "Create a user list",
    });

    expect(object).toEqual({
      users: [
        { id: 1, name: "Alice", active: true },
        { id: 2, name: "Bob", active: false },
      ],
      total: 2,
    });
  });

  it("should handle empty content arrays", async () => {
    mockPrompt.mockResolvedValue("Response");

    const result = await generateText({
      model: new BuiltInAIChatLanguageModel("text"),
      messages: [
        {
          role: "user",
          content: [],
        },
      ],
    });

    expect(result.text).toBe("Response");
    expect(mockPrompt).toHaveBeenCalledWith(
      [
        {
          role: "user",
          content: [],
        },
      ],
      {},
    );
  });

  describe("multimodal support", () => {
    beforeEach(() => {
      // Mock LanguageModel.create to capture the options passed to it
      LanguageModel.create = vi.fn().mockResolvedValue(mockSession);
    });

    it("should handle image files in messages", async () => {
      mockPrompt.mockResolvedValue("I can see an image.");

      const result = await generateText({
        model: new BuiltInAIChatLanguageModel("text"),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "What's in this image?" },
              {
                type: "file",
                mediaType: "image/png",
                data: "SGVsbG8gV29ybGQ=", // "Hello World" in base64
              },
            ],
          },
        ],
      });

      expect(result.text).toBe("I can see an image.");

      // Verify that the session was created with expected inputs for image
      expect(LanguageModel.create).toHaveBeenCalledWith(
        expect.objectContaining<Partial<BuiltInAIChatSettings>>({
          expectedInputs: [{ type: "image" }],
        }),
      );
    });

    it("should handle audio files in messages", async () => {
      mockPrompt.mockResolvedValue("I can hear the audio.");

      const result = await generateText({
        model: new BuiltInAIChatLanguageModel("text"),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "What's in this audio?" },
              {
                type: "file",
                mediaType: "audio/wav",
                data: new Uint8Array([82, 73, 70, 70]), // "RIFF" header
              },
            ],
          },
        ],
      });

      expect(result.text).toBe("I can hear the audio.");

      // Verify that the session was created with expected inputs for audio
      expect(LanguageModel.create).toHaveBeenCalledWith(
        expect.objectContaining<Partial<BuiltInAIChatSettings>>({
          expectedInputs: [{ type: "audio" }],
        }),
      );
    });

    it("should handle both image and audio content", async () => {
      mockPrompt.mockResolvedValue("I can see and hear the content.");

      const result = await generateText({
        model: new BuiltInAIChatLanguageModel("text"),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this:" },
              {
                type: "file",
                mediaType: "image/jpeg",
                data: "SGVsbG8=", // "Hello" in base64
              },
              { type: "text", text: "And this:" },
              {
                type: "file",
                mediaType: "audio/mp3",
                data: new Uint8Array([1, 2, 3]),
              },
            ],
          },
        ],
      });

      expect(result.text).toBe("I can see and hear the content.");

      // Verify that the session was created with expected inputs for both image and audio
      expect(LanguageModel.create).toHaveBeenCalledWith(
        expect.objectContaining<Partial<BuiltInAIChatSettings>>({
          expectedInputs: expect.arrayContaining([
            { type: "image" },
            { type: "audio" },
          ]),
        }),
      );
    });

    it("should handle URL-based image data", async () => {
      mockPrompt.mockResolvedValue("I can see the image from the URL.");

      const result = await generateText({
        model: new BuiltInAIChatLanguageModel("text"),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "file",
                mediaType: "image/png",
                data: new URL("https://example.com/image.png"),
              },
            ],
          },
        ],
      });

      expect(result.text).toBe("I can see the image from the URL.");

      // Verify that the session was created with expected inputs for image
      expect(LanguageModel.create).toHaveBeenCalledWith(
        expect.objectContaining<Partial<BuiltInAIChatSettings>>({
          expectedInputs: [{ type: "image" }],
        }),
      );
    });
  });

  describe("createSessionWithProgress", () => {
    let mockEventTarget: {
      addEventListener: ReturnType<typeof vi.fn>;
      removeEventListener: ReturnType<typeof vi.fn>;
      dispatchEvent: ReturnType<typeof vi.fn>;
      ondownloadprogress: null;
    };

    beforeEach(() => {
      // Create a mock CreateMonitor that matches the DOM API
      mockEventTarget = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        ondownloadprogress: null,
      };

      // Mock LanguageModel.create to capture monitor option and simulate its usage
      LanguageModel.create = vi.fn((options: LanguageModelCreateOptions) => {
        // If a monitor option is provided, call it to set up event listeners
        if (options.monitor) {
          options.monitor(mockEventTarget as CreateMonitor);
        }
        return Promise.resolve(mockSession);
      });
    });

    it("should create a session without progress callback", async () => {
      const model = new BuiltInAIChatLanguageModel("text");
      const session = await model.createSessionWithProgress();

      expect(session).toBe(mockSession);
      expect(LanguageModel.create).toHaveBeenCalledWith(
        expect.not.objectContaining({
          monitor: expect.any(Function),
        }),
      );
    });

    it("should create a session with progress callback and forward progress events", async () => {
      const model = new BuiltInAIChatLanguageModel("text");
      const progressCallback = vi.fn();

      // Mock LanguageModel.create to simulate progress events
      LanguageModel.create = vi.fn((options: LanguageModelCreateOptions) => {
        if (options.monitor) {
          options.monitor(mockEventTarget as CreateMonitor);

          // Simulate the addEventListener call and trigger progress events
          const addEventListenerCall =
            mockEventTarget.addEventListener.mock.calls.find(
              (call) => call[0] === "downloadprogress",
            );

          if (addEventListenerCall) {
            const progressHandler = addEventListenerCall[1];

            // Simulate progress events
            setTimeout(() => {
              progressHandler({ loaded: 0.0 });
              progressHandler({ loaded: 0.5 });
              progressHandler({ loaded: 1.0 });
            }, 0);
          }
        }
        return Promise.resolve(mockSession);
      });

      const session = await model.createSessionWithProgress(progressCallback);

      expect(session).toBe(mockSession);
      expect(LanguageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          monitor: expect.any(Function),
        }),
      );
      expect(mockEventTarget.addEventListener).toHaveBeenCalledWith(
        "downloadprogress",
        expect.any(Function),
      );

      // Wait for the setTimeout to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(progressCallback).toHaveBeenCalledTimes(3);
      expect(progressCallback).toHaveBeenNthCalledWith(1, 0.0);
      expect(progressCallback).toHaveBeenNthCalledWith(2, 0.5);
      expect(progressCallback).toHaveBeenNthCalledWith(3, 1.0);
    });

    it("should reuse existing session on subsequent calls", async () => {
      const model = new BuiltInAIChatLanguageModel("text");

      // First call should create a new session
      const session1 = await model.createSessionWithProgress();
      expect(session1).toBe(mockSession);
      expect(LanguageModel.create).toHaveBeenCalledTimes(1);

      // Second call should reuse the existing session
      const session2 = await model.createSessionWithProgress();
      expect(session2).toBe(mockSession);
      expect(session1).toBe(session2);
      expect(LanguageModel.create).toHaveBeenCalledTimes(1);
    });

    it("should throw LoadSettingError when LanguageModel is unavailable", async () => {
      vi.stubGlobal("LanguageModel", undefined);
      const model = new BuiltInAIChatLanguageModel("text");

      await expect(model.createSessionWithProgress()).rejects.toThrow(
        LoadSettingError,
      );
    });
  });
});
