import { describe, it, expect, beforeEach, vi } from "vitest";
import { SessionManager } from "../src/models/session-manager";
import type { ProgressCallback } from "../src/models/session-manager";

describe("SessionManager", () => {
  beforeEach(() => {
    // Reset the global mock before each test
    vi.stubGlobal("LanguageModel", {
      availability: vi.fn().mockResolvedValue("available"),
      create: vi.fn().mockResolvedValue({
        prompt: vi.fn(),
        destroy: vi.fn(),
      }),
    });
  });

  describe("constructor", () => {
    it("should create a session manager with base options", () => {
      const manager = new SessionManager({
        temperature: 0.7,
        topK: 40,
      });

      expect(manager).toBeInstanceOf(SessionManager);
    });

    it("should filter out custom provider options", () => {
      const manager = new SessionManager({
        temperature: 0.7,
        parallelToolExecution: true,
        debugToolCalls: true,
      } as any);

      expect(manager).toBeInstanceOf(SessionManager);
      expect(manager.getCurrentSession()).toBeNull();
    });
  });

  describe("checkAvailability", () => {
    it("should return unavailable when LanguageModel is not defined", async () => {
      vi.stubGlobal("LanguageModel", undefined);
      const manager = new SessionManager({});
      const availability = await manager.checkAvailability();

      expect(availability).toBe("unavailable");
    });

    it("should return availability from LanguageModel API", async () => {
      const mockAvailability = vi
        .fn()
        .mockResolvedValue("available");
      vi.stubGlobal("LanguageModel", {
        availability: mockAvailability,
        create: vi.fn(),
      });

      const manager = new SessionManager({});
      const availability = await manager.checkAvailability();

      expect(availability).toBe("available");
      expect(mockAvailability).toHaveBeenCalledTimes(1);
    });

    it("should return downloadable when model needs download", async () => {
      vi.stubGlobal("LanguageModel", {
        availability: vi.fn().mockResolvedValue("downloadable"),
        create: vi.fn(),
      });

      const manager = new SessionManager({});
      const availability = await manager.checkAvailability();

      expect(availability).toBe("downloadable");
    });
  });

  describe("getSession", () => {
    it("should throw error when LanguageModel is undefined", async () => {
      vi.stubGlobal("LanguageModel", undefined);
      const manager = new SessionManager({});

      await expect(manager.getSession()).rejects.toThrow(
        "Prompt API is not available",
      );
    });

    it("should throw error when model is unavailable", async () => {
      vi.stubGlobal("LanguageModel", {
        availability: vi.fn().mockResolvedValue("unavailable"),
        create: vi.fn(),
      });

      const manager = new SessionManager({});

      await expect(manager.getSession()).rejects.toThrow(
        "Built-in model not available",
      );
    });

    it("should create a session when available", async () => {
      const mockSession = {
        prompt: vi.fn(),
        destroy: vi.fn(),
      };
      const mockCreate = vi.fn().mockResolvedValue(mockSession);

      vi.stubGlobal("LanguageModel", {
        availability: vi.fn().mockResolvedValue("available"),
        create: mockCreate,
      });

      const manager = new SessionManager({ temperature: 0.7 });
      const session = await manager.getSession();

      expect(session).toBe(mockSession);
      expect(mockCreate).toHaveBeenCalledWith({ temperature: 0.7 });
    });

    it("should reuse existing session", async () => {
      const mockSession = {
        prompt: vi.fn(),
        destroy: vi.fn(),
      };
      const mockCreate = vi.fn().mockResolvedValue(mockSession);

      vi.stubGlobal("LanguageModel", {
        availability: vi.fn().mockResolvedValue("available"),
        create: mockCreate,
      });

      const manager = new SessionManager({});
      const session1 = await manager.getSession();
      const session2 = await manager.getSession();

      expect(session1).toBe(session2);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it("should handle systemMessage option", async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        prompt: vi.fn(),
        destroy: vi.fn(),
      });

      vi.stubGlobal("LanguageModel", {
        availability: vi.fn().mockResolvedValue("available"),
        create: mockCreate,
      });

      const manager = new SessionManager({});
      await manager.getSession({
        systemMessage: "You are a helpful assistant",
      });

      expect(mockCreate).toHaveBeenCalledWith({
        initialPrompts: [
          { role: "system", content: "You are a helpful assistant" },
        ],
      });
    });

    it("should handle expectedInputs option", async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        prompt: vi.fn(),
        destroy: vi.fn(),
      });

      vi.stubGlobal("LanguageModel", {
        availability: vi.fn().mockResolvedValue("available"),
        create: mockCreate,
      });

      const manager = new SessionManager({});
      await manager.getSession({
        expectedInputs: [{ type: "image" }, { type: "text" }],
      });

      expect(mockCreate).toHaveBeenCalledWith({
        expectedInputs: [{ type: "image" }, { type: "text" }],
      });
    });

    it("should handle download progress callback", async () => {
      const progressCallback: ProgressCallback = vi.fn();
      const mockCreate = vi.fn().mockResolvedValue({
        prompt: vi.fn(),
        destroy: vi.fn(),
      });

      vi.stubGlobal("LanguageModel", {
        availability: vi.fn().mockResolvedValue("available"),
        create: mockCreate,
      });

      const manager = new SessionManager({});
      await manager.getSession({
        onDownloadProgress: progressCallback,
      });

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const createArgs = mockCreate.mock.calls[0][0];
      expect(createArgs.monitor).toBeInstanceOf(Function);
    });

    it("should merge base options with request options", async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        prompt: vi.fn(),
        destroy: vi.fn(),
      });

      vi.stubGlobal("LanguageModel", {
        availability: vi.fn().mockResolvedValue("available"),
        create: mockCreate,
      });

      const manager = new SessionManager({
        temperature: 0.7,
        topK: 40,
      });
      await manager.getSession({
        temperature: 0.9,
      });

      expect(mockCreate).toHaveBeenCalledWith({
        temperature: 0.9,
        topK: 40,
      });
    });
  });

  describe("createSessionWithProgress", () => {
    it("should create session with progress callback", async () => {
      const mockSession = {
        prompt: vi.fn(),
        destroy: vi.fn(),
      };
      const mockCreate = vi.fn().mockResolvedValue(mockSession);
      const progressCallback: ProgressCallback = vi.fn();

      vi.stubGlobal("LanguageModel", {
        availability: vi.fn().mockResolvedValue("available"),
        create: mockCreate,
      });

      const manager = new SessionManager({});
      const session = await manager.createSessionWithProgress(progressCallback);

      expect(session).toBe(mockSession);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it("should work without progress callback", async () => {
      const mockSession = {
        prompt: vi.fn(),
        destroy: vi.fn(),
      };
      const mockCreate = vi.fn().mockResolvedValue(mockSession);

      vi.stubGlobal("LanguageModel", {
        availability: vi.fn().mockResolvedValue("available"),
        create: mockCreate,
      });

      const manager = new SessionManager({});
      const session = await manager.createSessionWithProgress();

      expect(session).toBe(mockSession);
    });
  });

  describe("getCurrentSession", () => {
    it("should return null when no session exists", () => {
      const manager = new SessionManager({});
      expect(manager.getCurrentSession()).toBeNull();
    });

    it("should return the current session after creation", async () => {
      const mockSession = {
        prompt: vi.fn(),
        destroy: vi.fn(),
      };

      vi.stubGlobal("LanguageModel", {
        availability: vi.fn().mockResolvedValue("available"),
        create: vi.fn().mockResolvedValue(mockSession),
      });

      const manager = new SessionManager({});
      await manager.getSession();

      expect(manager.getCurrentSession()).toBe(mockSession);
    });
  });

  describe("destroySession", () => {
    it("should destroy the current session", async () => {
      const mockDestroy = vi.fn();
      const mockSession = {
        prompt: vi.fn(),
        destroy: mockDestroy,
      };

      vi.stubGlobal("LanguageModel", {
        availability: vi.fn().mockResolvedValue("available"),
        create: vi.fn().mockResolvedValue(mockSession),
      });

      const manager = new SessionManager({});
      await manager.getSession();

      manager.destroySession();

      expect(mockDestroy).toHaveBeenCalledTimes(1);
      expect(manager.getCurrentSession()).toBeNull();
    });

    it("should handle session without destroy method", async () => {
      const mockSession = {
        prompt: vi.fn(),
      };

      vi.stubGlobal("LanguageModel", {
        availability: vi.fn().mockResolvedValue("available"),
        create: vi.fn().mockResolvedValue(mockSession),
      });

      const manager = new SessionManager({});
      await manager.getSession();

      expect(() => manager.destroySession()).not.toThrow();
      expect(manager.getCurrentSession()).toBeNull();
    });

    it("should allow creating a new session after destruction", async () => {
      const mockSession1 = {
        prompt: vi.fn(),
        destroy: vi.fn(),
      };
      const mockSession2 = {
        prompt: vi.fn(),
        destroy: vi.fn(),
      };
      const mockCreate = vi
        .fn()
        .mockResolvedValueOnce(mockSession1)
        .mockResolvedValueOnce(mockSession2);

      vi.stubGlobal("LanguageModel", {
        availability: vi.fn().mockResolvedValue("available"),
        create: mockCreate,
      });

      const manager = new SessionManager({});
      const session1 = await manager.getSession();
      manager.destroySession();
      const session2 = await manager.getSession();

      expect(session1).not.toBe(session2);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });
  });
});
