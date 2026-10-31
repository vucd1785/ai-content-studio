import { ENV_KEYS } from "./env.js";

const MIN_SESSION_SECRET_LENGTH = 32;

export type SessionEnvConfig = {
  password: string;
  sessionSecret: string;
};

export class SessionEnvError extends Error {
  readonly code = "session_env_invalid" as const;

  constructor(message: string) {
    super(message);
    this.name = "SessionEnvError";
  }
}

export function loadSessionEnv(
  env: NodeJS.ProcessEnv = process.env,
): SessionEnvConfig {
  const password = env[ENV_KEYS.STUDIO_PASSWORD];
  if (password === undefined || password === "") {
    throw new SessionEnvError(`${ENV_KEYS.STUDIO_PASSWORD} is required and must not be empty`);
  }

  const sessionSecret = env[ENV_KEYS.STUDIO_SESSION_SECRET];
  if (sessionSecret === undefined || sessionSecret === "") {
    throw new SessionEnvError(`${ENV_KEYS.STUDIO_SESSION_SECRET} is required`);
  }
  if (sessionSecret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new SessionEnvError(
      `${ENV_KEYS.STUDIO_SESSION_SECRET} must be at least ${MIN_SESSION_SECRET_LENGTH} characters`,
    );
  }

  return { password, sessionSecret };
}
