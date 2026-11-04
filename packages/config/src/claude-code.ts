/**
 * Client Claude Code (ADR-007, bổ sung 2026-11-02): worker gọi `claude -p` bằng gói thuê bao của Director.
 * Model id trong danh sách chọn theo run có dạng `claude-code` (model mặc định của tài khoản)
 * hoặc `claude-code:<alias>`. Danh sách do Director điền; không có thì tính năng tắt.
 */

export const CLAUDE_CODE_ENV_KEYS = {
  MODELS: "CLAUDE_CODE_MODELS",
  BIN: "CLAUDE_BIN",
  TIMEOUT_MS: "CLAUDE_CODE_TIMEOUT_MS",
} as const;

export const CLAUDE_CODE_MODEL_PREFIX = "claude-code";

/** Một lần viết kịch bản mất 30–60 s ở spike P6-14; 10 phút đủ rộng cho lần repair và máy chậm. */
const DEFAULT_TIMEOUT_MS = 600_000;

export type ClaudeCodeEnvConfig = {
  /** Model id hợp lệ cho run; rỗng nghĩa là chưa bật. */
  models: string[];
  /** File chạy CLI; mặc định tìm `claude` trên PATH. */
  bin: string;
  timeoutMs: number;
};

const MODEL_ID = /^claude-code(?::[A-Za-z0-9][A-Za-z0-9._-]*)?$/;

export function isClaudeCodeModel(model: string | null | undefined): boolean {
  return typeof model === "string" && MODEL_ID.test(model);
}

/** Alias truyền cho `--model`; `undefined` thì CLI dùng model mặc định của tài khoản. */
export function claudeCodeCliModel(model: string): string | undefined {
  const separator = model.indexOf(":");
  return separator === -1 ? undefined : model.slice(separator + 1);
}

export function readClaudeCodeEnv(env: Record<string, string | undefined>): ClaudeCodeEnvConfig {
  const models = [
    ...new Set(
      (env[CLAUDE_CODE_ENV_KEYS.MODELS] ?? "")
        .split(",")
        .map((model) => model.trim())
        .filter((model) => model !== ""),
    ),
  ];
  const invalid = models.filter((model) => !isClaudeCodeModel(model));
  if (invalid.length > 0) {
    throw new Error(
      `${CLAUDE_CODE_ENV_KEYS.MODELS} chỉ nhận "claude-code" hoặc "claude-code:<alias>": ${invalid.join(", ")}`,
    );
  }
  const rawTimeout = Number(env[CLAUDE_CODE_ENV_KEYS.TIMEOUT_MS]);
  return {
    models,
    bin: env[CLAUDE_CODE_ENV_KEYS.BIN]?.trim() || "claude",
    timeoutMs: Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : DEFAULT_TIMEOUT_MS,
  };
}
