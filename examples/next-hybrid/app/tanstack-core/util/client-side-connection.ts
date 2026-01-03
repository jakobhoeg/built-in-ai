"use client";

import { type ConnectionAdapter } from "@tanstack/ai-client";
import { chat, type Tool } from "@tanstack/ai";
import {
  builtInAI,
  type BuiltInAIModelMessage,
  type ProgressCallback,
} from "@built-in-ai/tanstack-core";

/**
 * Options for creating a built-in AI connection
 */
export interface BuiltInAIConnectionOptions {
  tools?: Tool[];
  onDownloadProgress?: ProgressCallback;
}

/**
 * Creates a client-side connection adapter for TanStack AI SDK
 * that uses the browser's built-in Prompt API directly.
 *
 * @param options - Optional configuration including tools and download progress callback
 *
 */
export function createBuiltInAIConnection(
  options?: BuiltInAIConnectionOptions,
): ConnectionAdapter {
  const adapter = builtInAI("text", {
    sessionOptions: {
      onDownloadProgress: options?.onDownloadProgress,
    },
  });

  return {
    async *connect(messages, _data, abortSignal) {
      // Create an AbortController to pass to chat()
      // Wire it up to the incoming signal from useChat's stop()
      const abortController = new AbortController();

      if (abortSignal) {
        if (abortSignal.aborted) {
          abortController.abort();
          return;
        }
        abortSignal.addEventListener("abort", () => abortController.abort());
      }

      yield* chat({
        adapter,
        messages: messages as BuiltInAIModelMessage[],
        abortController,
        tools: options?.tools,
      });
    },
  };
}
