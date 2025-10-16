import { describe, it, expect, beforeEach } from "vitest";
import { ToolCallFenceDetector } from "../src/streaming/tool-call-detector";

describe("ToolCallFenceDetector", () => {
  let detector: ToolCallFenceDetector;

  beforeEach(() => {
    detector = new ToolCallFenceDetector();
  });

  describe("basic functionality", () => {
    it("detects complete fence in single chunk", () => {
      detector.addChunk("```tool_call\n<tool_call><name>test</name></tool_call>\n```");
      const result = detector.detectFence();

      expect(result.fence).toContain("```tool_call");
      expect(result.fence).toContain("```");
      expect(result.prefixText).toBe("");
    });

    it("handles text before fence", () => {
      detector.addChunk("Hello world ```tool_call\n<tool_call></tool_call>\n```");
      const result = detector.detectFence();

      expect(result.prefixText).toBe("Hello world ");
      expect(result.fence).toContain("```tool_call");
    });

    it("handles text after fence", () => {
      detector.addChunk("```tool_call\n<tool_call></tool_call>\n``` after text");
      const result = detector.detectFence();

      expect(result.fence).toContain("```tool_call");
      expect(result.remainingText).toBe(" after text");
    });
  });

  describe("fence split across chunks", () => {
    it("detects fence split into two chunks", () => {
      detector.addChunk("```tool_call\n<tool_call>");
      let result = detector.detectFence();
      expect(result.fence).toBeNull();

      detector.addChunk("</tool_call>\n```");
      result = detector.detectFence();
      expect(result.fence).toContain("```tool_call");
    });

    it("detects fence split into multiple chunks", () => {
      detector.addChunk("```");
      let result = detector.detectFence();
      expect(result.fence).toBeNull();

      detector.addChunk("tool_call\n<tool_call>");
      result = detector.detectFence();
      expect(result.fence).toBeNull();

      detector.addChunk("<name>test</name>");
      result = detector.detectFence();
      expect(result.fence).toBeNull();

      detector.addChunk("</tool_call>\n```");
      result = detector.detectFence();
      expect(result.fence).toContain("```tool_call");
    });
  });

  describe("overlap detection", () => {
    it("holds back potential fence start", () => {
      detector.addChunk("Some text ``");
      const result = detector.detectFence();

      // Should emit "Some text " and hold back "``"
      expect(result.prefixText).toBe("Some text ");
      expect(result.fence).toBeNull();
      expect(detector.getBuffer()).toBe("``");
    });

    it("holds back single backtick", () => {
      detector.addChunk("hello `");
      const result = detector.detectFence();

      expect(result.prefixText).toBe("hello ");
      expect(detector.getBuffer()).toBe("`");
    });

    it("emits text when no overlap possible", () => {
      detector.addChunk("hello world");
      const result = detector.detectFence();

      expect(result.prefixText).toBe("hello world");
      expect(detector.getBuffer()).toBe("");
    });

    it("completes fence after overlap", () => {
      detector.addChunk("text ``");
      let result = detector.detectFence();
      expect(detector.getBuffer()).toBe("``");

      detector.addChunk("`tool_call\n```");
      result = detector.detectFence();
      expect(result.fence).toContain("```tool_call");
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
      expect(detector.hasContent()).toBe(true);
      detector.clearBuffer();
      expect(detector.hasContent()).toBe(false);
    });

    it("getBuffer returns current buffer content", () => {
      detector.addChunk("hello");
      expect(detector.getBuffer()).toBe("hello");
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

    it("handles incomplete fence gracefully", () => {
      detector.addChunk("```tool_call\n<tool_call>");
      const result = detector.detectFence();

      expect(result.fence).toBeNull();
      // Should keep the buffer since fence isn't complete
      expect(detector.hasContent()).toBe(true);
    });

    it("handles fence start without end", () => {
      detector.addChunk("text ```tool_call more text");
      const result = detector.detectFence();

      // Should emit text before fence start, keep the rest
      expect(result.prefixText).toBe("text ");
      expect(result.fence).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("handles empty chunks", () => {
      detector.addChunk("");
      const result = detector.detectFence();

      expect(result.fence).toBeNull();
      expect(result.prefixText).toBe("");
    });

    it("handles multiple fences in sequence", () => {
      detector.addChunk("```tool_call\n<tool_call></tool_call>\n```");
      let result = detector.detectFence();
      expect(result.fence).not.toBeNull();

      // Add another fence
      detector.clearBuffer();
      detector.addChunk("```tool_call\n<tool_call><name>second</name></tool_call>\n```");
      result = detector.detectFence();
      expect(result.fence).toContain("<name>second</name>");
    });

    it("handles backticks in text content", () => {
      detector.addChunk("Use `code` in markdown");
      const result = detector.detectFence();

      // Should emit most text, but might hold back "`" at end
      expect(result.prefixText.length).toBeGreaterThan(0);
    });

    it("handles fence marker in different positions", () => {
      detector.addChunk("```tool_call at start\n```");
      let result = detector.detectFence();
      expect(result.fence).toContain("```tool_call");

      detector.clearBuffer();
      detector.addChunk("middle ```tool_call\n``` text");
      result = detector.detectFence();
      expect(result.fence).toContain("```tool_call");
      expect(result.prefixText).toBe("middle ");
    });
  });

  describe("real-world scenarios", () => {
    it("handles typical streaming response", () => {
      const chunks = [
        "Let me search for that.\n",
        "``",
        "`tool_call\n",
        "<tool_call>\n",
        "<name>search</name>\n",
        "<parameters>\n",
        "<query type=\"string\">test query</query>\n",
        "</parameters>\n",
        "</tool_call>\n",
        "```\n",
        "I'll look that up for you.",
      ];

      let fenceFound = false;
      let allPrefixText = "";

      for (const chunk of chunks) {
        detector.addChunk(chunk);
        const result = detector.detectFence();

        if (result.prefixText) {
          allPrefixText += result.prefixText;
        }

        if (result.fence) {
          fenceFound = true;
          expect(result.fence).toContain("<name>search</name>");
          // The last chunk "I'll look that up for you." would be added after the fence is found
          // so it won't be in remainingText, it would be processed as the next chunk
          expect(result.remainingText).toBe("\n");
          break;
        }
      }

      expect(fenceFound).toBe(true);
      expect(allPrefixText).toBe("Let me search for that.\n");
    });
  });
});
