import { describe, expect, it } from "vitest";
import { sessionLoginBodySchema } from "./session.js";

const SENTINEL = "sentinal-password-9f3a";

describe("sessionLoginBodySchema (U10)", () => {
  it("accepts valid password", () => {
    const parsed = sessionLoginBodySchema.safeParse({ password: "ok" });
    expect(parsed.success).toBe(true);
  });

  it("rejects missing password", () => {
    const parsed = sessionLoginBodySchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it("rejects non-string password", () => {
    const parsed = sessionLoginBodySchema.safeParse({ password: 1 });
    expect(parsed.success).toBe(false);
  });

  it("rejects empty password", () => {
    const parsed = sessionLoginBodySchema.safeParse({ password: "" });
    expect(parsed.success).toBe(false);
  });

  it("rejects password longer than 1024 without echoing sentinel in formatted issues", () => {
    const long = `${SENTINEL}${"x".repeat(1024)}`;
    const parsed = sessionLoginBodySchema.safeParse({ password: long });
    expect(parsed.success).toBe(false);
    const text = JSON.stringify(parsed.success ? {} : parsed.error.issues);
    expect(text).not.toContain(SENTINEL);
  });
});
