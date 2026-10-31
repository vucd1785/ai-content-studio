import { describe, expect, it } from "vitest";
import { isAllowedRequestOrigin } from "./origin.js";

describe("isAllowedRequestOrigin", () => {
  it("allows missing Origin (non-browser clients)", () => {
    expect(isAllowedRequestOrigin(undefined)).toBe(true);
  });

  it("allows http://127.0.0.1:5173", () => {
    expect(isAllowedRequestOrigin("http://127.0.0.1:5173")).toBe(true);
  });

  it("allows http://localhost:3001", () => {
    expect(isAllowedRequestOrigin("http://localhost:3001")).toBe(true);
  });

  it("rejects https://evil.example", () => {
    expect(isAllowedRequestOrigin("https://evil.example")).toBe(false);
  });
});
