// Test setup for web-llm-provider
import { beforeAll } from "vitest";

beforeAll(() => {
  // Mock WebGPU for testing environment
  if (!global.navigator) {
    (global as any).navigator = {};
  }
  if (!(global.navigator as any).gpu) {
    (global.navigator as any).gpu = {};
  }
});
