import { ThinkingLevel } from "@google/genai";
import type { GeminiThinkingLevel } from "@studio/config/gemini";
import { sanitizeJsonSchemaForGemini } from "./gemini-json-schema.js";

export type GeminiGenerateContentConfig = {
  systemInstruction: string;
  responseMimeType: "application/json";
  /** Gemini JSON Schema subset (not OpenAPI responseSchema). */
  responseJsonSchema?: Record<string, unknown>;
  thinkingConfig: {
    thinkingLevel: ThinkingLevel;
  };
};

export function toSdkThinkingLevel(level: GeminiThinkingLevel): ThinkingLevel {
  switch (level) {
    case "minimal":
      return ThinkingLevel.MINIMAL;
    case "low":
      return ThinkingLevel.LOW;
    case "medium":
      return ThinkingLevel.MEDIUM;
    case "high":
      return ThinkingLevel.HIGH;
  }
}

/** Maps studio request to Gemini 3.x generateContent config (thinkingLevel, not thinkingBudget). */
export function buildGeminiGenerateContentConfig(input: {
  systemInstruction: string;
  responseJsonSchema?: Record<string, unknown>;
  thinkingLevel: GeminiThinkingLevel;
}): GeminiGenerateContentConfig {
  const sanitized = input.responseJsonSchema
    ? sanitizeJsonSchemaForGemini(input.responseJsonSchema)
    : undefined;

  return {
    systemInstruction: input.systemInstruction,
    responseMimeType: "application/json",
    ...(sanitized ? { responseJsonSchema: sanitized } : {}),
    thinkingConfig: {
      thinkingLevel: toSdkThinkingLevel(input.thinkingLevel),
    },
  };
}
