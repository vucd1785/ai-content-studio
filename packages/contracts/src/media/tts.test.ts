import { describe, expect, it } from "vitest";
import {
  alignRequestSchema,
  alignResponseSchema,
  alignmentValidationSchema,
  revalidateGateRequestSchema,
  synthesizeRequestSchema,
} from "./tts.js";

describe("media tts contracts", () => {
  it("accepts valid synthesize request", () => {
    const parsed = synthesizeRequestSchema.safeParse({ text: "Xin chào." });
    expect(parsed.success).toBe(true);
  });

  it("rejects traversal in audioArtifactId", () => {
    const parsed = alignRequestSchema.safeParse({
      audioArtifactId: "../etc/passwd000000000000000000",
      transcript: "hi",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid artifact id shape", () => {
    const parsed = alignRequestSchema.safeParse({
      audioArtifactId: "not-hex",
      transcript: "hi",
    });
    expect(parsed.success).toBe(false);
  });

  it("defaults engine optional on align request", () => {
    const parsed = alignRequestSchema.parse({
      audioArtifactId: "42daebb50e1a43759a1cdc7a439deb04",
      transcript: "Redis nhanh.",
    });
    expect(parsed.engine).toBeUndefined();
  });

  it("parses alignment validation with timeline metrics", () => {
    const parsed = alignmentValidationSchema.safeParse({
      ok: true,
      errors: [],
      warnings: [],
      wordCount: 2,
      alignedWordCount: 2,
      missingWords: [],
      coverageStartMs: 0,
      coverageEndMs: 100,
      durationDeltaMs: 0,
      nonMonotonicWordRatio: 0,
      timelineOrderRatio: 1,
    });
    expect(parsed.success).toBe(true);
  });

  it("parses minimal align response gate", () => {
    const parsed = alignResponseSchema.safeParse({
      alignmentArtifactId: "42daebb50e1a43759a1cdc7a439deb04",
      audioArtifactId: "42daebb50e1a43759a1cdc7a439deb04",
      durationMs: 1000,
      transcript: "a",
      engine: "whisper",
      modelId: "base",
      words: [{ text: "a", startMs: 0, endMs: 100 }],
      validation: {
        ok: true,
        errors: [],
        warnings: [],
        wordCount: 1,
        alignedWordCount: 1,
        missingWords: [],
        coverageStartMs: 0,
        coverageEndMs: 100,
        durationDeltaMs: 0,
        nonMonotonicWordRatio: 0,
        timelineOrderRatio: 1,
      },
      gate: {
        alignedWordRatio: 1,
        durationDeltaMs: 0,
        coverageWithin250Ms: true,
        ratioAtLeast90Pct: true,
        validationOk: true,
        passesGate: true,
        gatePolicyVersion: "2.0.0-silence-aware",
        trailingSilenceVerified: false,
        trailingSilenceMs: null,
        coverageAcceptanceReason: "within_250ms",
      },
      processingMs: 10,
    });
    expect(parsed.success).toBe(true);
  });
});
