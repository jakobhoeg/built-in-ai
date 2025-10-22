import { vi } from "vitest";

// Mock the global LanguageModel API
(global as any).LanguageModel = {
  availability: vi.fn(),
  create: vi.fn(),
};
