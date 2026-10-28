import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseScript } from "@studio/contracts";
import { hashEduVerticalRenderProps } from "@studio/video/render-props/content-hash";
import { describe, expect, it } from "vitest";
import { buildEduVerticalRenderProps } from "./build-render-props.js";
import { resolveRepoRoot } from "./paths.js";

describe("render cache audio identity", () => {
  it("hash khác khi audio bytes khác", () => {
    const repoRoot = resolveRepoRoot(import.meta.url);
    const script = parseScript(
      JSON.parse(readFileSync(join(repoRoot, "fixtures", "script.edu.json"), "utf8")) as unknown,
    );
    const sceneArtifacts = script.scenes.map((scene) => ({
      sceneId: scene.id,
      wavArtifactId: "c".repeat(32),
      measuredDurationMs: 3000,
      alignment: {
        alignmentArtifactId: "c".repeat(32),
        audioArtifactId: "c".repeat(32),
        durationMs: 3000,
        transcript: scene.narration,
        engine: "whisper" as const,
        modelId: "base",
        words: [{ text: "test", startMs: 0, endMs: 500 }],
        validation: {
          ok: true,
          errors: [],
          warnings: [],
          wordCount: 1,
          alignedWordCount: 1,
          missingWords: [],
          coverageStartMs: 0,
          coverageEndMs: 500,
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
      },
    }));
    const props = buildEduVerticalRenderProps({
      script,
      sceneArtifacts,
      audioStorageKey: "pipeline/x.wav",
      totalDurationMs: 20_000,
    });
    const a = hashEduVerticalRenderProps(props, { audioContentSha256: "a".repeat(64) });
    const b = hashEduVerticalRenderProps(props, { audioContentSha256: "b".repeat(64) });
    expect(a).not.toBe(b);
  });
});
