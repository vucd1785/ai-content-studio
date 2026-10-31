import { describe, expect, it } from "vitest";
import { verifyPassword } from "./password.js";

describe("verifyPassword (U1, U2)", () => {
  it("U1 returns true for matching password", () => {
    expect(verifyPassword("same", "same")).toBe(true);
  });

  it("U2 returns false for wrong password with different length", () => {
    expect(verifyPassword("short", "much-longer-secret")).toBe(false);
  });
});
