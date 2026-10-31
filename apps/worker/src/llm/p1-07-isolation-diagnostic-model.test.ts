import { describe, expect, it } from "vitest";
import {
  ISOLATION_MODEL_DEFAULT,
  resolveIsolationDiagnosticModel,
} from "./p1-07-diagnostic-model-env.js";

describe("resolveIsolationDiagnosticModel (P1-07 runner only)", () => {
  it("defaults to gemini-3.6-flash when GEMINI_DIAGNOSTIC_MODEL is unset", () => {
    expect(resolveIsolationDiagnosticModel({})).toEqual({
      model: "gemini-3.6-flash",
      source: "default",
    });
    expect(resolveIsolationDiagnosticModel({ GEMINI_DIAGNOSTIC_MODEL: "   " })).toEqual({
      model: ISOLATION_MODEL_DEFAULT,
      source: "default",
    });
  });

  it("uses GEMINI_DIAGNOSTIC_MODEL when set (e.g. gemini-3.8-flash)", () => {
    expect(
      resolveIsolationDiagnosticModel({ GEMINI_DIAGNOSTIC_MODEL: "gemini-3.8-flash" }),
    ).toEqual({
      model: "gemini-3.8-flash",
      source: "env",
    });
  });
});
