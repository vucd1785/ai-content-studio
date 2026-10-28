/**
 * Biến environment Gemini (P1-07). Giá trị model mặc định có thể đổi qua env.
 */
export const GEMINI_ENV_KEYS = {
  API_KEY: "GEMINI_API_KEY",
  MODEL_SCRIPT: "GEMINI_MODEL_SCRIPT",
  THINKING_BUDGET_SCRIPT: "GEMINI_THINKING_BUDGET_SCRIPT",
} as const;

export type GeminiEnvConfig = {
  apiKey: string | undefined;
  modelScript: string;
  /** 0 tắt extended thinking; giá trị dương là budget token (ADR-007: mức thấp). */
  thinkingBudgetScript: number;
};

const DEFAULT_MODEL_SCRIPT = "gemini-2.0-flash";

function parseThinkingBudget(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") {
    return 0;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

/** Đọc cấu hình Gemini tại biên process (không validate bắt buộc API key). */
export function readGeminiEnv(env: Record<string, string | undefined>): GeminiEnvConfig {
  const apiKey = env[GEMINI_ENV_KEYS.API_KEY]?.trim();
  const modelScript = env[GEMINI_ENV_KEYS.MODEL_SCRIPT]?.trim() || DEFAULT_MODEL_SCRIPT;
  return {
    apiKey: apiKey && apiKey.length > 0 ? apiKey : undefined,
    modelScript,
    thinkingBudgetScript: parseThinkingBudget(env[GEMINI_ENV_KEYS.THINKING_BUDGET_SCRIPT]),
  };
}
