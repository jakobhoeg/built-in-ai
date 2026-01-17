/**
 * SessionManager handles the lifecycle of browser AI sessions for TanStack AI SDK.
 * Manages session creation, caching, and availability checks.
 */

/**
 * Progress callback for model download events
 * @param progress - Download progress from 0 to 1
 */
export type ProgressCallback = (progress: number) => void;

// ===========================
// Standalone Utility Functions
// ===========================

/**
 * Check if the browser supports the built-in AI Prompt API
 *
 * This is a synchronous check that only verifies the API exists,
 * not whether a model is available for use.
 */
export function doesBrowserSupportBuiltInAI(): boolean {
  return typeof LanguageModel !== "undefined";
}

/**
 * Check the availability status of the built-in AI model
 *
 * This is a standalone function that doesn't require a SessionManager instance.
 * Use this for quick availability checks before initializing the full AI system.
 *
 * @returns Promise resolving to availability status:
 *   - "unavailable": Browser doesn't support the API or model is not supported
 *   - "downloadable": Model needs to be downloaded before use
 *   - "downloading": Model is currently being downloaded
 *   - "available": Model is ready to use
 *
 * @example
 * ```typescript
 * const status = await checkBuiltInAIAvailability();
 * switch (status) {
 *   case "available":
 *     console.log("Ready to use!");
 *     break;
 *   case "downloadable":
 *     console.log("Model needs downloading first");
 *     break;
 *   case "unavailable":
 *     console.log("Not supported in this browser");
 *     break;
 * }
 * ```
 */
export async function checkBuiltInAIAvailability(): Promise<Availability> {
  if (!doesBrowserSupportBuiltInAI()) {
    return "unavailable";
  }
  return LanguageModel.availability();
}

// ===========================
// SessionManager
// ===========================

/**
 * Options for creating a new session
 */
export interface SessionCreateOptions extends LanguageModelCreateOptions {
  systemMessage?: string;
  expectedInputs?: Array<{ type: "text" | "image" | "audio" }>;
  onDownloadProgress?: ProgressCallback;
}

/**
 * Error thrown when the Prompt API is not available
 */
export class PromptAPINotAvailableError extends Error {
  constructor(message?: string) {
    super(
      message ??
      "Prompt API is not available. This library requires Chrome or Edge browser with built-in AI capabilities.",
    );
    this.name = "PromptAPINotAvailableError";
  }
}

/**
 * Error thrown when the model is unavailable
 */
export class ModelUnavailableError extends Error {
  constructor(message?: string) {
    super(message ?? "Built-in model is not available in this browser");
    this.name = "ModelUnavailableError";
  }
}

/**
 * Manages browser AI session lifecycle for TanStack AI SDK
 *
 * Responsibilities:
 * - Create and cache AI sessions
 * - Check model availability
 * - Monitor download progress
 * - Handle session options and configuration
 *
 * @example
 * ```typescript
 * const manager = new SessionManager()
 *
 * // Check availability first
 * const status = await manager.checkAvailability()
 *
 * // Create session with options
 * const session = await manager.getSession({
 *   temperature: 0.7,
 * })
 * ```
 */
export class SessionManager {
  private session: LanguageModel | null = null;
  private baseOptions: LanguageModelCreateOptions;

  /**
   * Creates a new SessionManager
   *
   * @param baseOptions - Base configuration options for all sessions
   */
  constructor(baseOptions: LanguageModelCreateOptions = {}) {
    this.baseOptions = baseOptions;
  }

  /**
   * Gets or creates a session with the specified options
   *
   * If a session already exists, it will be reused.
   *
   * @param options - Optional session creation options
   * @returns Promise resolving to a LanguageModel session
   * @throws {PromptAPINotAvailableError} When Prompt API is not available
   * @throws {ModelUnavailableError} When model is unavailable
   */
  async getSession(options?: SessionCreateOptions): Promise<LanguageModel> {
    // Check if LanguageModel API is available
    if (typeof LanguageModel === "undefined") {
      throw new PromptAPINotAvailableError();
    }

    // Return existing session if available
    if (this.session) {
      return this.session;
    }

    // Check availability before attempting to create
    const availability = await LanguageModel.availability();
    if (availability === "unavailable") {
      throw new ModelUnavailableError();
    }

    // Prepare session options
    const sessionOptions = this.prepareSessionOptions(options);

    // Create the session
    this.session = await LanguageModel.create(sessionOptions);

    return this.session;
  }

  /**
   * Checks the availability status of the built-in AI model
   *
   * @returns Promise resolving to availability status
   * - "unavailable": Model is not supported
   * - "downloadable": Model needs to be downloaded
   * - "downloading": Model is currently downloading
   * - "available": Model is ready to use
   */
  async checkAvailability(): Promise<Availability> {
    if (typeof LanguageModel === "undefined") {
      return "unavailable";
    }
    return LanguageModel.availability();
  }

  /**
   * Gets the current session if it exists
   *
   * @returns The current session or null if none exists
   */
  getCurrentSession(): LanguageModel | null {
    return this.session;
  }

  /**
   * Destroys the current session
   *
   * Use this when you want to force creation of a new session
   * with different options on the next getSession call.
   */
  destroySession(): void {
    if (this.session && typeof this.session.destroy === "function") {
      this.session.destroy();
    }
    this.session = null;
  }

  /**
   * Prepares merged session options from base config and request options
   *
   * @param options - Optional request-specific options
   * @returns Merged options ready for LanguageModel.create()
   */
  private prepareSessionOptions(
    options?: SessionCreateOptions,
  ): LanguageModelCreateOptions {
    const mergedOptions: LanguageModelCreateOptions = { ...this.baseOptions };

    if (options) {
      const { systemMessage, expectedInputs, onDownloadProgress, ...createOptions } = options;

      // Merge standard create options
      Object.assign(mergedOptions, createOptions);

      // Handle system message
      if (systemMessage) {
        mergedOptions.initialPrompts = [
          { role: "system", content: systemMessage },
        ];
      }

      // Handle expected inputs (for multimodal)
      if (expectedInputs && expectedInputs.length > 0) {
        mergedOptions.expectedInputs = expectedInputs;
      }

      // Handle download progress monitoring
      if (onDownloadProgress) {
        mergedOptions.monitor = (m: CreateMonitor) => {
          m.addEventListener("downloadprogress", (e: ProgressEvent) => {
            onDownloadProgress(e.loaded); // e.loaded is between 0 and 1
          });
        };
      }
    }

    return mergedOptions;
  }
}
