import { describe, expect, it } from "vitest";
import { loadSessionEnv, SessionEnvError } from "./session-env.js";

describe("loadSessionEnv (U9)", () => {
  it("returns config when env is valid", () => {
    const config = loadSessionEnv({
      STUDIO_PASSWORD: "x",
      STUDIO_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
    });
    expect(config.password).toBe("x");
    expect(config.sessionSecret.length).toBeGreaterThanOrEqual(32);
  });

  it("throws when password is missing", () => {
    expect(() =>
      loadSessionEnv({
        STUDIO_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
      }),
    ).toThrow(SessionEnvError);
  });

  it("throws when password is empty", () => {
    expect(() =>
      loadSessionEnv({
        STUDIO_PASSWORD: "",
        STUDIO_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
      }),
    ).toThrow(SessionEnvError);
  });

  it("throws when session secret is shorter than 32 characters", () => {
    expect(() =>
      loadSessionEnv({
        STUDIO_PASSWORD: "x",
        STUDIO_SESSION_SECRET: "short",
      }),
    ).toThrow(SessionEnvError);
  });
});
