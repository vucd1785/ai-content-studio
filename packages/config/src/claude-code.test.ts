import { describe, expect, it } from "vitest";
import { claudeCodeCliModel, isClaudeCodeModel, readClaudeCodeEnv } from "./claude-code.js";

describe("readClaudeCodeEnv (P6-15)", () => {
  it("không đặt biến thì tắt, dùng `claude` trên PATH và thời gian chờ mặc định", () => {
    expect(readClaudeCodeEnv({})).toEqual({ models: [], bin: "claude", timeoutMs: 600_000 });
  });

  it("đọc danh sách, bỏ trùng và khoảng trắng", () => {
    const config = readClaudeCodeEnv({
      CLAUDE_CODE_MODELS: " claude-code , claude-code:sonnet,claude-code ",
      CLAUDE_BIN: "C:\\tools\\claude.exe",
      CLAUDE_CODE_TIMEOUT_MS: "120000",
    });
    expect(config).toEqual({
      models: ["claude-code", "claude-code:sonnet"],
      bin: "C:\\tools\\claude.exe",
      timeoutMs: 120_000,
    });
  });

  it("từ chối model id không có tiền tố claude-code", () => {
    expect(() => readClaudeCodeEnv({ CLAUDE_CODE_MODELS: "claude-code,gemini-3.6-flash" })).toThrow(
      /gemini-3.6-flash/,
    );
  });

  it("thời gian chờ sai thì về mặc định", () => {
    expect(readClaudeCodeEnv({ CLAUDE_CODE_TIMEOUT_MS: "abc" }).timeoutMs).toBe(600_000);
  });
});

describe("model id claude-code", () => {
  it("nhận diện và tách alias", () => {
    expect(isClaudeCodeModel("claude-code")).toBe(true);
    expect(isClaudeCodeModel("claude-code:opus")).toBe(true);
    expect(isClaudeCodeModel("claude-code:")).toBe(false);
    expect(isClaudeCodeModel("claude-codex")).toBe(false);
    expect(isClaudeCodeModel("gemini-3.6-flash")).toBe(false);
    expect(isClaudeCodeModel(null)).toBe(false);
    expect(claudeCodeCliModel("claude-code")).toBeUndefined();
    expect(claudeCodeCliModel("claude-code:sonnet")).toBe("sonnet");
  });
});
