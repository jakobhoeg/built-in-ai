"use client";

import { toolDefinition, type JSONSchema } from "@tanstack/ai";

/**
 * Get the current date and time
 */
export const getCurrentTimeDef = toolDefinition({
  name: "get_current_time",
  description:
    "Get the current date and time. Use this when the user asks about the current time, date, or day of the week.",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  } as JSONSchema,
  outputSchema: {
    type: "object",
    properties: {
      timestamp: {
        type: "string",
        description: "ISO 8601 formatted timestamp",
      },
      date: { type: "string", description: "Human readable formatted date" },
      time: { type: "string", description: "Human readable formatted time" },
      timezone: { type: "string", description: "The timezone used" },
    },
    required: ["timestamp", "date", "time", "timezone"],
  } as JSONSchema,
});

/**
 * Generate a random number within a range
 */
export const getRandomNumberDef = toolDefinition({
  name: "get_random_number",
  description:
    "Generate a random number within a specified range. Use this when the user asks for a random number, dice roll, or any random selection.",
  inputSchema: {
    type: "object",
    properties: {
      min: { type: "number", description: "Minimum value (inclusive)" },
      max: { type: "number", description: "Maximum value (inclusive)" },
    },
    required: ["min", "max"],
  } as JSONSchema,
  outputSchema: {
    type: "object",
    properties: {
      number: { type: "number", description: "The generated random number" },
      min: { type: "number", description: "The minimum value used" },
      max: { type: "number", description: "The maximum value used" },
    },
    required: ["number", "min", "max"],
  } as JSONSchema,
});

/**
 * Perform a mathematical calculation
 */
export const calculateDef = toolDefinition({
  name: "calculate",
  description:
    "Perform a mathematical calculation. Use this for arithmetic operations, percentages, or any math computation the user requests.",
  inputSchema: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description:
          "The mathematical expression to evaluate (e.g., '2 + 2', '100 * 0.15', '(5 + 3) * 2')",
      },
    },
    required: ["expression"],
  } as JSONSchema,
  outputSchema: {
    type: "object",
    properties: {
      result: { type: "number", description: "The result of the calculation" },
      expression: { type: "string", description: "The original expression" },
    },
    required: ["result", "expression"],
  } as JSONSchema,
});

// Tool definitions array (for the connection/model)
export const toolDefs = [getCurrentTimeDef, getRandomNumberDef, calculateDef];
