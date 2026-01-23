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
  /** The complete fence if found, null otherwise */
  fence: string | null;
  /** Any text before the fence that can be safely emitted */
  prefixText: string;
  /** Text after the fence (if fence was found) */
  remainingText: string;
  /** Length of potential partial fence at buffer end */
  overlapLength: number;
}

/**
 * Result of streaming fence content detection
 */
export interface StreamingFenceResult {
  /** Whether we're currently inside a fence */
  inFence: boolean;
  /** Content that can be safely emitted (either as text or tool-input-delta) */
  safeContent: string;
  /** The complete fence if it just closed, null otherwise */
  completeFence: string | null;
  /** Text after a completed fence */
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

  // Streaming state
  private inFence = false;
  private fenceStartBuffer = ""; // Accumulated fence content

  /**
   * Adds a chunk of text to the internal buffer
   *
   * @param chunk - Text chunk from the stream
   */
  addChunk(chunk: string): void {
    this.buffer += chunk;
  }

  /**
   * Gets the current buffer content
   */
  getBuffer(): string {
    return this.buffer;
  }

  /**
   * Clears the internal buffer
   */
  clearBuffer(): void {
    this.buffer = "";
  }

  /**
   * Detects if there's a complete fence in the buffer
   *
   * This method:
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

    // No fence start found
    if (startIdx === -1) {
      // Compute how much of the buffer end might be a partial fence start
      const overlap = this.computeOverlapLength(this.buffer, this.FENCE_STARTS);
      const safeTextLength = this.buffer.length - overlap;

      const prefixText =
        safeTextLength > 0 ? this.buffer.slice(0, safeTextLength) : "";
      const remaining = overlap > 0 ? this.buffer.slice(-overlap) : "";

      // Update buffer to keep only the overlap
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

    // Look for closing fence
    const prefixLength = matchedPrefix?.length ?? 0;
    const closingIdx = this.buffer.indexOf(this.FENCE_END, prefixLength);

    // Fence not complete yet
    if (closingIdx === -1) {
      // Keep the buffer as-is, waiting for more data
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

    // Clear the buffer since we extracted everything
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

  /**
   * Computes the maximum overlap between the end of text and the start of any prefix
   *
   * This is crucial for streaming: if the buffer ends with "``", we can't emit it
   * because the next chunk might be "`tool_call", completing a fence marker.
   *
   * @param text - Text to check for overlap
   * @param prefixes - List of prefixes to check against
   * @returns Length of the maximum overlap found
   *
   * @example
   * ```typescript
   * computeOverlapLength("hello ``", ["```tool_call"])
   * // Returns: 2 (because "``" matches start of "```tool_call")
   *
   * computeOverlapLength("hello `", ["```tool_call"])
   * // Returns: 1
   *
   * computeOverlapLength("hello world", ["```tool_call"])
   * // Returns: 0 (no overlap)
   * ```
   *
   * @private
   */
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

  /**
   * Checks if the buffer currently contains any text
   */
  hasContent(): boolean {
    return this.buffer.length > 0;
  }

  /**
   * Gets the buffer size
   */
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
      // Look for fence start
      const { index: startIdx, prefix: matchedPrefix } = this.findFenceStart(
        this.buffer,
      );

      if (startIdx === -1) {
        // No fence start found - emit safe text
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

      // Move buffer past the fence start marker
      this.buffer = this.buffer.slice(startIdx + fenceStartLength);

      // Skip newline after fence start if present
      if (this.buffer.startsWith("\n")) {
        this.buffer = this.buffer.slice(1);
      }

      this.inFence = true;
      this.fenceStartBuffer = "";

      return {
        inFence: true,
        safeContent: prefixText, // Emit any text before the fence
        completeFence: null,
        textAfterFence: "",
      };
    }

    // We're inside a fence - look for fence end
    const closingIdx = this.buffer.indexOf(this.FENCE_END);

    if (closingIdx === -1) {
      // No fence end yet - emit safe content (leaving potential fence end marker)
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

      // Nothing safe to emit yet
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

    // Reconstruct complete fence
    const completeFence = `${this.FENCE_STARTS[0]}\n${this.fenceStartBuffer}\n${this.FENCE_END}`;

    // Get text after fence
    const textAfterFence = this.buffer.slice(
      closingIdx + this.FENCE_END.length,
    );

    // Reset state
    this.inFence = false;
    this.fenceStartBuffer = "";
    this.buffer = textAfterFence;

    return {
      inFence: false,
      safeContent: fenceContent, // Emit the last bit of fence content
      completeFence,
      textAfterFence,
    };
  }

  /**
   * Check if currently inside a fence
   */
  isInFence(): boolean {
    return this.inFence;
  }

  /**
   * Reset streaming state
   */
  resetStreamingState(): void {
    this.inFence = false;
    this.fenceStartBuffer = "";
  }
}
