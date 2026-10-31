import { ENV_KEYS } from "./env.js";

export class DataDirError extends Error {
  readonly code = "data_dir_invalid" as const;

  constructor(message: string) {
    super(message);
    this.name = "DataDirError";
  }
}

export function loadDataDir(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env[ENV_KEYS.DATA_DIR];
  if (raw === undefined || raw.trim() === "") {
    throw new DataDirError(`${ENV_KEYS.DATA_DIR} is required`);
  }
  return raw;
}
