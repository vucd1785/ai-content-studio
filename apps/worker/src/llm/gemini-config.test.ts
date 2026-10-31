import { ThinkingLevel } from "@google/genai";
import { readGeminiEnv } from "@studio/config/gemini";
import { describe, expect, it } from "vitest";
import { buildGeminiGenerateContentConfig, toSdkThinkingLevel } from "./gemini-request-config.js";

describe("readGeminiEnv", () => {
  it("mặc định model gemini-3.6-flash", () => {
    const config = readGeminiEnv({});
    expect(config.modelScript).toBe("gemini-3.6-flash");
  });

  it("override GEMINI_MODEL_SCRIPT", () => {
    const config = readGeminiEnv({ GEMINI_MODEL_SCRIPT: "gemini-custom" });
    expect(config.modelScript).toBe("gemini-custom");
  });

  it("mặc định thinkingLevel low", () => {
    const config = readGeminiEnv({});
    expect(config.thinkingLevelScript).toBe("low");
  });

  it("parse GEMINI_THINKING_LEVEL_SCRIPT hợp lệ", () => {
    expect(readGeminiEnv({ GEMINI_THINKING_LEVEL_SCRIPT: "medium" }).thinkingLevelScript).toBe(
      "medium",
    );
  });

  it("giá trị thinking không hợp lệ → fallback low", () => {
    expect(readGeminiEnv({ GEMINI_THINKING_LEVEL_SCRIPT: "999" }).thinkingLevelScript).toBe("low");
  });
});

describe("buildGeminiGenerateContentConfig", () => {
  it("chỉ gửi thinkingLevel, không thinkingBudget", () => {
    const config = buildGeminiGenerateContentConfig({
      systemInstruction: "sys",
      thinkingLevel: "low",
    });
    expect(config.thinkingConfig).toEqual({ thinkingLevel: ThinkingLevel.LOW });
    expect(config).not.toHaveProperty("thinkingBudget");
    expect(JSON.stringify(config)).not.toContain("thinkingBudget");
  });

  it("gắn responseJsonSchema đã sanitize khi có", () => {
    const config = buildGeminiGenerateContentConfig({
      systemInstruction: "sys",
      thinkingLevel: "minimal",
      responseJsonSchema: { type: "object", $schema: "ignored" },
    });
    expect(config.responseJsonSchema).toEqual({ type: "object" });
    expect(config).not.toHaveProperty("responseSchema");
    expect(config.thinkingConfig.thinkingLevel).toBe(ThinkingLevel.MINIMAL);
  });
});

describe("toSdkThinkingLevel", () => {
  it("map env level sang SDK enum", () => {
    expect(toSdkThinkingLevel("low")).toBe(ThinkingLevel.LOW);
    expect(toSdkThinkingLevel("high")).toBe(ThinkingLevel.HIGH);
  });
});
