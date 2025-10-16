import { describe, it, expect } from "vitest";
import {
  shouldExecuteToolsInParallel,
  shouldDebugToolCalls,
} from "../src/utils/provider-options";
import type { LanguageModelV2CallOptions } from "@ai-sdk/provider";

describe("provider-options", () => {
  describe("shouldExecuteToolsInParallel", () => {
    it("returns false by default", () => {
      const options: LanguageModelV2CallOptions = {
        prompt: [],
      };
      expect(shouldExecuteToolsInParallel(options, undefined)).toBe(false);
    });

    it("returns config value when no provider options", () => {
      const options: LanguageModelV2CallOptions = {
        prompt: [],
      };
      expect(shouldExecuteToolsInParallel(options, true)).toBe(true);
      expect(shouldExecuteToolsInParallel(options, false)).toBe(false);
    });

    it("prefers provider option over config value", () => {
      const options: LanguageModelV2CallOptions = {
        prompt: [],
        providerOptions: {
          "built-in-ai": {
            parallelToolExecution: true,
          },
        },
      };
      expect(shouldExecuteToolsInParallel(options, false)).toBe(true);
    });

    it("uses config value when provider option is not boolean", () => {
      const options: LanguageModelV2CallOptions = {
        prompt: [],
        providerOptions: {
          "built-in-ai": {
            parallelToolExecution: "maybe" as any, // Invalid value
          },
        },
      };
      expect(shouldExecuteToolsInParallel(options, true)).toBe(true);
    });

    it("handles missing built-in-ai provider options", () => {
      const options: LanguageModelV2CallOptions = {
        prompt: [],
        providerOptions: {
          "other-provider": {},
        },
      };
      expect(shouldExecuteToolsInParallel(options, true)).toBe(true);
    });

    it("handles provider options with parallelToolExecution false", () => {
      const options: LanguageModelV2CallOptions = {
        prompt: [],
        providerOptions: {
          "built-in-ai": {
            parallelToolExecution: false,
          },
        },
      };
      expect(shouldExecuteToolsInParallel(options, true)).toBe(false);
    });
  });

  describe("shouldDebugToolCalls", () => {
    it("returns false by default", () => {
      const options: LanguageModelV2CallOptions = {
        prompt: [],
      };
      expect(shouldDebugToolCalls(options, undefined)).toBe(false);
    });

    it("returns config value when no provider options", () => {
      const options: LanguageModelV2CallOptions = {
        prompt: [],
      };
      expect(shouldDebugToolCalls(options, true)).toBe(true);
      expect(shouldDebugToolCalls(options, false)).toBe(false);
    });

    it("prefers provider option over config value", () => {
      const options: LanguageModelV2CallOptions = {
        prompt: [],
        providerOptions: {
          "built-in-ai": {
            debugToolCalls: true,
          },
        },
      };
      expect(shouldDebugToolCalls(options, false)).toBe(true);
    });

    it("uses config value when provider option is not boolean", () => {
      const options: LanguageModelV2CallOptions = {
        prompt: [],
        providerOptions: {
          "built-in-ai": {
            debugToolCalls: null as any, // Invalid value
          },
        },
      };
      expect(shouldDebugToolCalls(options, true)).toBe(true);
    });

    it("handles missing built-in-ai provider options", () => {
      const options: LanguageModelV2CallOptions = {
        prompt: [],
        providerOptions: {
          "other-provider": {},
        },
      };
      expect(shouldDebugToolCalls(options, false)).toBe(false);
    });

    it("handles provider options with debugToolCalls false", () => {
      const options: LanguageModelV2CallOptions = {
        prompt: [],
        providerOptions: {
          "built-in-ai": {
            debugToolCalls: false,
          },
        },
      };
      expect(shouldDebugToolCalls(options, true)).toBe(false);
    });
  });
});
