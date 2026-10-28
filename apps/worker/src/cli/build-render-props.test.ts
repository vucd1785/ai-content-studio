import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AlignResponse } from "@studio/contracts";
import { parseScript } from "@studio/contracts";
import { describe, expect, it } from "vitest";
import {
  assertAlignmentAccepted,
  buildEduVerticalRenderProps,
  type SceneMediaArtifacts,
} from "./build-render-props.js";
import { PipelineError, resolveRepoRoot } from "./paths.js";

function sampleAlignment(transcript: string, durationMs: number): AlignResponse {
  const words = transcript.split(/\s+/u).filter(Boolean);
  const usableMs = Math.max(durationMs - 100, words.length * 80);
  const step = Math.max(60, Math.floor(usableMs / Math.max(words.length, 1)));
  let cursor = 40;
  return {
    alignmentArtifactId: "a".repeat(32),
    audioArtifactId: "a".repeat(32),
    durationMs,
    transcript,
    engine: "whisper",
    modelId: "base",
    words: words.map((text) => {
      const startMs = cursor;
      const endMs = Math.min(cursor + step, durationMs - 10);
      cursor = endMs + 15;
      return { text, startMs, endMs };
    }),
    validation: {
      ok: true,
      errors: [],
      warnings: [],
      wordCount: words.length,
      alignedWordCount: words.length,
      missingWords: [],
      coverageStartMs: 0,
      coverageEndMs: durationMs,
      durationDeltaMs: 0,
      nonMonotonicWordRatio: 1,
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
      coverageAcceptanceReason: "within_250ms" as const,
    },
    processingMs: 1,
  };
}

describe("buildEduVerticalRenderProps", () => {
  const repoRoot = resolveRepoRoot(import.meta.url);
  const script = parseScript(
    JSON.parse(readFileSync(join(repoRoot, "fixtures", "script.edu.json"), "utf8")) as unknown,
  );

  it("dựng props hợp lệ từ script edu và alignment giả", () => {
    const sceneArtifacts: SceneMediaArtifacts[] = script.scenes.map((scene) => ({
      sceneId: scene.id,
      wavArtifactId: "b".repeat(32),
      measuredDurationMs: 9000,
      alignment: sampleAlignment(scene.narration, 9000),
    }));

    const props = buildEduVerticalRenderProps({
      script,
      sceneArtifacts,
      audioStorageKey: "pipeline/test.wav",
      totalDurationMs: 20_000,
    });

    expect(props.scenes).toHaveLength(5);
    expect(props.scenes[0]?.templateSlot).toBe("title");
    expect(props.scenes[4]?.templateSlot).toBe("cta");
    expect(props.captions.length).toBeGreaterThan(0);
    expect(props.scenes[1]?.fromMs).toBe(props.scenes[0]?.durationMs);
  });

  it("từ chối alignment gate fail", () => {
    const bad = sampleAlignment(script.scenes[0]?.narration ?? "x", 1000);
    bad.gate.passesGate = false;
    expect(() => assertAlignmentAccepted(bad, "intro-title")).toThrow(PipelineError);
  });
});

describe("parseScript fixture", () => {
  it("từ chối script JSON sai", () => {
    expect(() => parseScript({ schemaVersion: 1 })).toThrow();
  });
});
