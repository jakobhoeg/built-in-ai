import { beforeAll } from "vitest";

beforeAll(() => {
  // Ensure navigator.gpu exists in test environment if accessed
  if (!(global as any).navigator) {
    (global as any).navigator = {} as any;
  }
  if (!("gpu" in (global as any).navigator)) {
    (global as any).navigator.gpu = {} as any;
  }
});
