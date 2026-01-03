import { clientTools } from "@tanstack/ai-client";
import { calculateDef, getCurrentTimeDef, getRandomNumberDef } from "./tools";

// Client tool implementations
export const clientToolImpls = clientTools(
  getCurrentTimeDef.client(() => {
    const now = new Date();
    return {
      timestamp: now.toISOString(),
      date: now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      time: now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }),
  getRandomNumberDef.client((args) => {
    const { min: rawMin, max: rawMax } = args as { min: number; max: number };
    const min = Math.ceil(rawMin);
    const max = Math.floor(rawMax);
    const number = Math.floor(Math.random() * (max - min + 1)) + min;
    return { number, min, max };
  }),
  calculateDef.client((args) => {
    const { expression } = args as { expression: string };
    try {
      // Safe math expression evaluation
      // Only allow numbers, operators, parentheses, and spaces
      const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, "");
      // eslint-disable-next-line no-eval
      const result = eval(sanitized);
      if (typeof result !== "number" || !isFinite(result)) {
        throw new Error("Invalid result");
      }
      return { result, expression };
    } catch {
      return { result: NaN, expression };
    }
  }),
);
