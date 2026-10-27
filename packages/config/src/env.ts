/**
 * Khai báo tên biến environment (P0-01). Đọc giá trị và validate ở task sau.
 */
export const ENV_KEYS = {
  STUDIO_PASSWORD: "STUDIO_PASSWORD",
  STUDIO_SESSION_SECRET: "STUDIO_SESSION_SECRET",
  DATABASE_URL: "DATABASE_URL",
  REDIS_URL: "REDIS_URL",
  GEMINI_API_KEY: "GEMINI_API_KEY",
  DATA_DIR: "DATA_DIR",
  TTS_BASE_URL: "TTS_BASE_URL",
} as const;

export type EnvKey = keyof typeof ENV_KEYS;

export const ENV_KEY_LIST: readonly EnvKey[] = [
  "STUDIO_PASSWORD",
  "STUDIO_SESSION_SECRET",
  "DATABASE_URL",
  "REDIS_URL",
  "GEMINI_API_KEY",
  "DATA_DIR",
  "TTS_BASE_URL",
];
