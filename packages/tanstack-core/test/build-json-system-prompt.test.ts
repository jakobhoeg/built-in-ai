import { describe, it, expect } from "vitest";
import { buildJsonToolSystemPrompt } from "../src/tool-calling/build-json-system-prompt";

describe("buildJsonToolSystemPrompt", () => {
  const weatherTool = {
    name: "getWeather",
    description: "Get weather for a location",
    inputSchema: {
      type: "object",
      properties: { location: { type: "string" } },
      required: ["location"],
    },
  };

  it("builds prompt with tool schema", () => {
    const prompt = buildJsonToolSystemPrompt(undefined, [weatherTool]);

    expect(prompt).toContain("getWeather");
    expect(prompt).toContain("Get weather for a location");
    expect(prompt).toContain("```tool_call");
    expect(prompt).toContain("tool_result");
  });

  it("includes original system prompt", () => {
    const prompt = buildJsonToolSystemPrompt("Be helpful.", [weatherTool]);

    expect(prompt).toContain("Be helpful.");
    expect(prompt).toContain("getWeather");
  });

  it("returns original prompt when no tools", () => {
    const prompt = buildJsonToolSystemPrompt("Original", []);
    expect(prompt).toBe("Original");
  });

  it("returns empty string when no tools and no prompt", () => {
    const prompt = buildJsonToolSystemPrompt(undefined, []);
    expect(prompt).toBe("");
  });

  it("handles tool without description", () => {
    const tool = { name: "noDesc", inputSchema: { type: "object" } };
    const prompt = buildJsonToolSystemPrompt(undefined, [tool]);

    expect(prompt).toContain("noDesc");
    expect(prompt).toContain("No description provided");
  });

  it("handles tool without inputSchema", () => {
    const tool = { name: "noSchema", description: "A tool" };
    const prompt = buildJsonToolSystemPrompt(undefined, [tool as any]);

    expect(prompt).toContain("noSchema");
  });

  it("includes parallel execution warning", () => {
    const prompt = buildJsonToolSystemPrompt(undefined, [weatherTool]);
    expect(prompt).toContain("one tool call at a time");
  });
});
