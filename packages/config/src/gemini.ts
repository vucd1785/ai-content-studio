/**
 * Biến environment Gemini (P1-07). Giá trị model mặc định có thể đổi qua env.
 */
export const GEMINI_ENV_KEYS = {
  API_KEY: "GEMINI_API_KEY",
  MODEL_SCRIPT: "GEMINI_MODEL_SCRIPT",
  /** Danh sách model Director cho phép chọn theo lượt chạy (P3-12), phân cách bằng dấu phẩy. */
  MODELS: "GEMINI_MODELS",
  THINKING_LEVEL_SCRIPT: "GEMINI_THINKING_LEVEL_SCRIPT",
} as const;

/** Mức thinking Gemini 3.x (generateContent thinkingConfig.thinkingLevel). */
export const GEMINI_THINKING_LEVELS = ["minimal", "low", "medium", "high"] as const;

export type GeminiThinkingLevel = (typeof GEMINI_THINKING_LEVELS)[number];

export type GeminiEnvConfig = {
  apiKey: string | undefined;
  modelScript: string;
  /** Model được chọn theo run: `modelScript` đứng đầu, rồi các model trong `GEMINI_MODELS` (không trùng). */
  models?: string[];
  /** ADR-007: mức thấp mặc định `low` trên gemini-3.6-flash. */
  thinkingLevelScript: GeminiThinkingLevel;
};

const DEFAULT_MODEL_SCRIPT = "gemini-3.6-flash";
const DEFAULT_THINKING_LEVEL_SCRIPT: GeminiThinkingLevel = "low";

function parseThinkingLevel(raw: string | undefined): GeminiThinkingLevel {
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_THINKING_LEVEL_SCRIPT;
  }
  const normalized = raw.trim().toLowerCase();
  for (const level of GEMINI_THINKING_LEVELS) {
    if (level === normalized) {
      return level;
    }
  }
  return DEFAULT_THINKING_LEVEL_SCRIPT;
}

/** Đọc cấu hình Gemini tại biên process (không validate bắt buộc API key). */
export function readGeminiEnv(env: Record<string, string | undefined>): GeminiEnvConfig {
  const apiKey = env[GEMINI_ENV_KEYS.API_KEY]?.trim();
  const modelScript = env[GEMINI_ENV_KEYS.MODEL_SCRIPT]?.trim() || DEFAULT_MODEL_SCRIPT;
  const listed = (env[GEMINI_ENV_KEYS.MODELS] ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter((model) => model !== "");
  return {
    apiKey: apiKey && apiKey.length > 0 ? apiKey : undefined,
    modelScript,
    models: [...new Set([modelScript, ...listed])],
    thinkingLevelScript: parseThinkingLevel(env[GEMINI_ENV_KEYS.THINKING_LEVEL_SCRIPT]),
  };
}
