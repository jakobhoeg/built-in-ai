import { describe, it, expect, beforeEach } from "vitest";
import { ToolCallFenceDetector } from "../src/streaming/tool-call-detector";

describe("ToolCallFenceDetector", () => {
  let detector: ToolCallFenceDetector;

  beforeEach(() => {
    detector = new ToolCallFenceDetector();
  });

  describe("basic functionality", () => {
    it("detects complete fence in single chunk", () => {
      detector.addChunk('```tool_call\n{"name":"test"}\n```');
      const result = detector.detectFence();

      expect(result.fence).toContain("```tool_call");
      expect(result.prefixText).toBe("");
    });

    it("handles text before fence", () => {
      detector.addChunk('Hello ```tool_call\n{"name":"test"}\n```');
      const result = detector.detectFence();

      expect(result.prefixText).toBe("Hello ");
      expect(result.fence).toContain("```tool_call");
    });

    it("handles text after fence", () => {
      detector.addChunk('```tool_call\n{"name":"test"}\n``` after');
      const result = detector.detectFence();

      expect(result.fence).toContain("```tool_call");
      expect(result.remainingText).toBe(" after");
    });
  });

  describe("fence split across chunks", () => {
    it("detects fence split into two chunks", () => {
      detector.addChunk('```tool_call\n{"name":');
      expect(detector.detectFence().fence).toBeNull();

      detector.addChunk('"test"}\n```');
      expect(detector.detectFence().fence).toContain("```tool_call");
    });

    it("detects fence split into multiple chunks", () => {
      detector.addChunk("```");
      expect(detector.detectFence().fence).toBeNull();

      detector.addChunk("tool_call\n{");
      expect(detector.detectFence().fence).toBeNull();

      detector.addChunk('"name":"test"}\n```');
      expect(detector.detectFence().fence).toContain("```tool_call");
    });
  });

  describe("overlap detection", () => {
    it("holds back potential fence start", () => {
      detector.addChunk("Some text ``");
      const result = detector.detectFence();

      expect(result.prefixText).toBe("Some text ");
      expect(detector.getBuffer()).toBe("``");
    });

    it("emits text when no overlap possible", () => {
      detector.addChunk("hello world");
      const result = detector.detectFence();

      expect(result.prefixText).toBe("hello world");
      expect(detector.getBuffer()).toBe("");
    });
  });

  describe("buffer management", () => {
    it("hasContent returns true when buffer has data", () => {
      expect(detector.hasContent()).toBe(false);
      detector.addChunk("test");
      expect(detector.hasContent()).toBe(true);
    });

    it("clearBuffer empties the buffer", () => {
      detector.addChunk("test");
      detector.clearBuffer();
      expect(detector.hasContent()).toBe(false);
    });

    it("getBufferSize returns correct size", () => {
      expect(detector.getBufferSize()).toBe(0);
      detector.addChunk("test");
      expect(detector.getBufferSize()).toBe(4);
    });
  });

  describe("no fence scenarios", () => {
    it("returns no fence for plain text", () => {
      detector.addChunk("Just plain text");
      const result = detector.detectFence();

      expect(result.fence).toBeNull();
      expect(result.prefixText).toBe("Just plain text");
    });

    it("handles empty chunks", () => {
      detector.addChunk("");
      const result = detector.detectFence();

      expect(result.fence).toBeNull();
      expect(result.prefixText).toBe("");
    });
  });

  describe("streaming fence detection", () => {
    it("transitions to inFence state when fence starts", () => {
      detector.addChunk('```tool_call\n{"name":');
      detector.detectStreamingFence();

      expect(detector.isInFence()).toBe(true);
    });

    it("returns complete fence when fence ends", () => {
      detector.addChunk('```tool_call\n{"name":"test"}\n```');

      // First call transitions to inFence state
      detector.detectStreamingFence();

      // Second call detects the fence end and returns complete fence
      const result = detector.detectStreamingFence();

      expect(result.completeFence).toContain("```tool_call");
      expect(detector.isInFence()).toBe(false);
    });

    it("resets streaming state", () => {
      detector.addChunk("```tool_call\n");
      detector.detectStreamingFence();
      expect(detector.isInFence()).toBe(true);

      detector.resetStreamingState();
      expect(detector.isInFence()).toBe(false);
    });
  });
});
