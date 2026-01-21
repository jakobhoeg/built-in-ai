import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SessionManager,
  PromptAPINotAvailableError,
  ModelUnavailableError,
  doesBrowserSupportBuiltInAI,
  checkBuiltInAIAvailability,
} from "../src/utils/session-manager";

describe("SessionManager", () => {
  let mockSession: any;

  beforeEach(() => {
    mockSession = {
      prompt: vi.fn(),
      promptStreaming: vi.fn(),
      destroy: vi.fn(),
    };

    vi.mocked(LanguageModel.availability).mockResolvedValue("available");
    vi.mocked(LanguageModel.create).mockResolvedValue(mockSession);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getSession", () => {
    it("creates a new session", async () => {
      const manager = new SessionManager();
      const session = await manager.getSession();

      expect(session).toBe(mockSession);
      expect(LanguageModel.create).toHaveBeenCalled();
    });

    it("reuses existing session", async () => {
      const manager = new SessionManager();

      await manager.getSession();
      await manager.getSession();

      expect(LanguageModel.create).toHaveBeenCalledTimes(1);
    });

    it("throws when API unavailable", async () => {
      vi.stubGlobal("LanguageModel", undefined);
      const manager = new SessionManager();

      await expect(manager.getSession()).rejects.toThrow(
        PromptAPINotAvailableError,
      );

      vi.stubGlobal("LanguageModel", {
        availability: vi.fn(),
        create: vi.fn(),
      });
    });

    it("throws when model unavailable", async () => {
      vi.mocked(LanguageModel.availability).mockResolvedValue("unavailable");
      const manager = new SessionManager();

      await expect(manager.getSession()).rejects.toThrow(ModelUnavailableError);
    });

    it("passes system message to initialPrompts", async () => {
      const manager = new SessionManager();
      await manager.getSession({ systemMessage: "Be helpful" });

      expect(LanguageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          initialPrompts: [{ role: "system", content: "Be helpful" }],
        }),
      );
    });

    it("passes expectedInputs for multimodal", async () => {
      const manager = new SessionManager();
      await manager.getSession({ expectedInputs: [{ type: "image" }] });

      expect(LanguageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedInputs: [{ type: "image" }],
        }),
      );
    });
  });

  describe("checkAvailability", () => {
    it("returns availability status", async () => {
      const manager = new SessionManager();
      const status = await manager.checkAvailability();

      expect(status).toBe("available");
    });

    it("returns unavailable when API missing", async () => {
      vi.stubGlobal("LanguageModel", undefined);
      const manager = new SessionManager();
      const status = await manager.checkAvailability();

      expect(status).toBe("unavailable");

      vi.stubGlobal("LanguageModel", {
        availability: vi.fn(),
        create: vi.fn(),
      });
    });
  });

  describe("destroySession", () => {
    it("destroys and clears session", async () => {
      const manager = new SessionManager();
      await manager.getSession();

      manager.destroySession();

      expect(mockSession.destroy).toHaveBeenCalled();
      expect(manager.getCurrentSession()).toBeNull();
    });

    it("handles no session gracefully", () => {
      const manager = new SessionManager();
      expect(() => manager.destroySession()).not.toThrow();
    });
  });

  describe("getCurrentSession", () => {
    it("returns null when no session", () => {
      const manager = new SessionManager();
      expect(manager.getCurrentSession()).toBeNull();
    });

    it("returns current session", async () => {
      const manager = new SessionManager();
      await manager.getSession();

      expect(manager.getCurrentSession()).toBe(mockSession);
    });
  });
});

describe("standalone utilities", () => {
  it("doesBrowserSupportBuiltInAI returns true when API exists", () => {
    expect(doesBrowserSupportBuiltInAI()).toBe(true);
  });

  it("checkBuiltInAIAvailability returns status", async () => {
    vi.mocked(LanguageModel.availability).mockResolvedValue("downloadable");
    const status = await checkBuiltInAIAvailability();

    expect(status).toBe("downloadable");
  });
});
