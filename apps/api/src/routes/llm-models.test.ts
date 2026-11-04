import { describe, expect, it } from "vitest";
import { llmModelsFromEnv } from "./workflow-runs.js";

describe("llmModelsFromEnv (P6-15)", () => {
  it("không đặt CLAUDE_CODE_MODELS thì như cũ: chỉ model Gemini", () => {
    expect(llmModelsFromEnv({ GEMINI_API_KEY: "k", GEMINI_MODEL_SCRIPT: "gemini-x" })).toEqual({
      defaultModel: "gemini-x",
      models: ["gemini-x"],
    });
  });

  it("có cả Gemini và Claude Code: mặc định vẫn là Gemini, Claude Code nối sau", () => {
    expect(
      llmModelsFromEnv({
        GEMINI_API_KEY: "k",
        GEMINI_MODEL_SCRIPT: "gemini-x",
        CLAUDE_CODE_MODELS: "claude-code,claude-code:sonnet",
      }),
    ).toEqual({
      defaultModel: "gemini-x",
      models: ["gemini-x", "claude-code", "claude-code:sonnet"],
    });
  });

  it("không có GEMINI_API_KEY nhưng có Claude Code: chỉ Claude Code, mặc định là model đầu", () => {
    expect(llmModelsFromEnv({ CLAUDE_CODE_MODELS: "claude-code:sonnet,claude-code" })).toEqual({
      defaultModel: "claude-code:sonnet",
      models: ["claude-code:sonnet", "claude-code"],
    });
  });
});
