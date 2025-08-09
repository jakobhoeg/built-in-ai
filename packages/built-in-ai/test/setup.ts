import { vi } from "vitest";

// Mock the global LanguageModel API
global.LanguageModel = {
  availability: vi.fn(),
  create: vi.fn(),
} as any;
