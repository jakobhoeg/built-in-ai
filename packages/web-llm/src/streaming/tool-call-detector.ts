/**
 * ToolCallFenceDetector - Detects and extracts tool call fences from streaming text
 *
 * This module handles the complex task of detecting tool call fences in a stream
 * where fences might be split across multiple chunks. It uses overlap detection
 * to avoid emitting text that might be the beginning of a fence.
 */

/**
 * Result of fence detection operation
 */
export interface FenceDetectionResult {
  fence: string | null;
  prefixText: string;
  remainingText: string;
  overlapLength: number;
}

/**
 * Result of streaming fence content detection
 */
export interface StreamingFenceResult {
  inFence: boolean;
  safeContent: string;
  completeFence: string | null;
  textAfterFence: string;
}

/**
 * Detects tool call fences in streaming text with support for partial matches
 *
 * @example
 * ```typescript
 * const detector = new ToolCallFenceDetector();
 *
 * // Add chunks as they arrive
 * detector.addChunk("Here's the answer: ");
 * detector.addChunk("```tool_call\n<tool_call>");
 * detector.addChunk("<name>search</name></tool_call>\n```");
 *
 * // Detect fence
 * const result = detector.detectFence();
 * if (result.fence) {
 *   console.log("Found tool call!");
 * }
 * ```
 */
export class ToolCallFenceDetector {
  private readonly FENCE_STARTS = ["```tool_call"];
  private readonly FENCE_END = "```";
  private buffer = "";

  private inFence = false;
  private fenceStartBuffer = "";

  addChunk(chunk: string): void {
    this.buffer += chunk;
  }

  getBuffer(): string {
    return this.buffer;
  }

  clearBuffer(): void {
    this.buffer = "";
  }

  /**
   * Detects if there's a complete fence in the buffer
   *
   * 1. Searches for fence start markers
   * 2. If found, looks for closing fence
   * 3. Computes overlap for partial fences
   * 4. Returns safe text that can be emitted
   *
   * @returns Detection result with fence info and safe text
   */
  detectFence(): FenceDetectionResult {
    const { index: startIdx, prefix: matchedPrefix } = this.findFenceStart(
      this.buffer,
    );

    if (startIdx === -1) {
      // Compute how much of the buffer end might be a partial fence start
      const overlap = this.computeOverlapLength(this.buffer, this.FENCE_STARTS);
      const safeTextLength = this.buffer.length - overlap;

      const prefixText =
        safeTextLength > 0 ? this.buffer.slice(0, safeTextLength) : "";
      const remaining = overlap > 0 ? this.buffer.slice(-overlap) : "";

      this.buffer = remaining;

      return {
        fence: null,
        prefixText,
        remainingText: "",
        overlapLength: overlap,
      };
    }

    // Found fence start - extract prefix text before it
    const prefixText = this.buffer.slice(0, startIdx);
    this.buffer = this.buffer.slice(startIdx);

    const prefixLength = matchedPrefix?.length ?? 0;
    const closingIdx = this.buffer.indexOf(this.FENCE_END, prefixLength);

    // Fence not complete yet
    if (closingIdx === -1) {
      return {
        fence: null,
        prefixText,
        remainingText: "",
        overlapLength: 0,
      };
    }

    // Complete fence found!
    const endPos = closingIdx + this.FENCE_END.length;
    const fence = this.buffer.slice(0, endPos);
    const remainingText = this.buffer.slice(endPos);

    this.buffer = "";

    return {
      fence,
      prefixText,
      remainingText,
      overlapLength: 0,
    };
  }

  /**
   * Finds the first occurrence of any fence start marker
   *
   * @param text - Text to search in
   * @returns Index of first fence start and which prefix matched
   * @private
   */
  private findFenceStart(text: string): {
    index: number;
    prefix: string | null;
  } {
    let bestIndex = -1;
    let matchedPrefix: string | null = null;

    for (const prefix of this.FENCE_STARTS) {
      const idx = text.indexOf(prefix);
      if (idx !== -1 && (bestIndex === -1 || idx < bestIndex)) {
        bestIndex = idx;
        matchedPrefix = prefix;
      }
    }

    return { index: bestIndex, prefix: matchedPrefix };
  }

  private computeOverlapLength(text: string, prefixes: string[]): number {
    let overlap = 0;

    for (const prefix of prefixes) {
      const maxLength = Math.min(text.length, prefix.length - 1);

      for (let size = maxLength; size > 0; size -= 1) {
        // Check if the last 'size' characters of text match the first 'size' characters of prefix
        if (prefix.startsWith(text.slice(-size))) {
          overlap = Math.max(overlap, size);
          break;
        }
      }
    }

    return overlap;
  }

  hasContent(): boolean {
    return this.buffer.length > 0;
  }

  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Detect and stream fence content in real-time for true incremental streaming
   *
   * This method is designed for streaming tool calls as they arrive:
   * 1. Detects when a fence starts and transitions to "inFence" state
   * 2. While inFence, emits safe content that won't conflict with fence end marker
   * 3. When fence ends, returns the complete fence for parsing
   *
   * @returns Streaming result with current state and safe content to emit
   */
  detectStreamingFence(): StreamingFenceResult {
    if (!this.inFence) {
      const { index: startIdx, prefix: matchedPrefix } = this.findFenceStart(
        this.buffer,
      );

      if (startIdx === -1) {
        const overlap = this.computeOverlapLength(
          this.buffer,
          this.FENCE_STARTS,
        );
        const safeTextLength = this.buffer.length - overlap;
        const safeContent =
          safeTextLength > 0 ? this.buffer.slice(0, safeTextLength) : "";
        this.buffer = this.buffer.slice(safeTextLength);

        return {
          inFence: false,
          safeContent,
          completeFence: null,
          textAfterFence: "",
        };
      }

      // Found fence start!
      const prefixText = this.buffer.slice(0, startIdx);
      const fenceStartLength = matchedPrefix?.length ?? 0;

      this.buffer = this.buffer.slice(startIdx + fenceStartLength);

      // Skip newline after fence start if present
      if (this.buffer.startsWith("\n")) {
        this.buffer = this.buffer.slice(1);
      }

      this.inFence = true;
      this.fenceStartBuffer = "";

      return {
        inFence: true,
        safeContent: prefixText,
        completeFence: null,
        textAfterFence: "",
      };
    }

    // We're inside a fence - look for fence end
    const closingIdx = this.buffer.indexOf(this.FENCE_END);

    if (closingIdx === -1) {
      const overlap = this.computeOverlapLength(this.buffer, [this.FENCE_END]);
      const safeContentLength = this.buffer.length - overlap;

      if (safeContentLength > 0) {
        const safeContent = this.buffer.slice(0, safeContentLength);
        this.fenceStartBuffer += safeContent;
        this.buffer = this.buffer.slice(safeContentLength);

        return {
          inFence: true,
          safeContent,
          completeFence: null,
          textAfterFence: "",
        };
      }

      return {
        inFence: true,
        safeContent: "",
        completeFence: null,
        textAfterFence: "",
      };
    }

    // Found fence end!
    const fenceContent = this.buffer.slice(0, closingIdx);
    this.fenceStartBuffer += fenceContent;

    const completeFence = `${this.FENCE_STARTS[0]}\n${this.fenceStartBuffer}\n${this.FENCE_END}`;

    const textAfterFence = this.buffer.slice(
      closingIdx + this.FENCE_END.length,
    );

    this.inFence = false;
    this.fenceStartBuffer = "";
    this.buffer = textAfterFence;

    return {
      inFence: false,
      safeContent: fenceContent,
      completeFence,
      textAfterFence,
    };
  }

  isInFence(): boolean {
    return this.inFence;
  }

  resetStreamingState(): void {
    this.inFence = false;
    this.fenceStartBuffer = "";
  }
}
