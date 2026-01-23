import { UIMessage } from "ai";

/**
 * UI message type for transformers.js with custom data parts.
 *
 * Extends base UIMessage to include specific data part schemas
 * such as model download progress tracking
 *
 * @example
 * // Import and use with useChat hook from @ai-sdk/react
 * ```typescript
 * import { useChat } from "@ai-sdk/react";
 * import { TransformersUIMessage } from "@built-in-ai/transformers-js";
 *
 * const { messages, sendMessage } = useChat<TransformersUIMessage>({
 *   onData: (dataPart) => {
 *     if (dataPart.type === 'data-modelDownloadProgress') {
 *       console.log(`Download: ${dataPart.data.progress}%`);
 *     }
 *     if (dataPart.type === 'data-notification') {
 *       console.log(`${dataPart.data.level}: ${dataPart.data.message}`);
 *     }
 *   }
 * });
 * ```
 *
 * @see {@link https://v5.ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat | useChat hook documentation}
 */
export type TransformersUIMessage = UIMessage<
  never, // No custom metadata type
  {
    /**
     * Model download progress data part for tracking browser AI model download status.
     * Used to display download progress bars and status messages to users.
     */
    modelDownloadProgress: {
      /** Current download/initialization status */
      status: "downloading" | "complete" | "error";
      /** Download progress percentage (0-100), undefined for non-downloading states */
      progress?: number;
      /** Human-readable status message to display to users */
      message: string;
    };
    /**
     * User notification data part for displaying temporary messages and alerts.
     * These are typically transient and not persisted in message history.
     */
    notification: {
      /** The notification message text */
      message: string;
      /** Notification severity level for styling and priority */
      level: "info" | "warning" | "error";
    };
  }
>;
