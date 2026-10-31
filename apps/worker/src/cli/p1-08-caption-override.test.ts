import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { AlignResponse } from "@studio/contracts";
import { parseScript } from "@studio/contracts";
import { hashEduVerticalRenderProps } from "@studio/video/render-props/content-hash";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildEduVerticalRenderProps,
  type SceneMediaArtifacts,
} from "./build-render-props.js";
import { collectSceneMediaArtifacts } from "./media-stage.js";
import {
  alignmentJsonPath,
  resolveRepoRoot,
  synthesizeContentKey,
  synthesizeIndexPath,
} from "./paths.js";
import * as ffprobe from "./ffprobe.js";

const GATE = {
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
};

function minimalWavHeader(): Buffer {
  const buffer = Buffer.alloc(44);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(24_000, 24);
  buffer.writeUInt32LE(48_000, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(0, 40);
  return buffer;
}

function sampleAlignment(transcript: string, durationMs: number, artifactId: string): AlignResponse {
  const words = transcript.split(/\s+/u).filter(Boolean);
  const step = Math.max(60, Math.floor((durationMs - 100) / Math.max(words.length, 1)));
  let cursor = 40;
  return {
    alignmentArtifactId: artifactId,
    audioArtifactId: artifactId,
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
    gate: GATE,
    processingMs: 1,
  };
}

describe("P1-08 caption override integration", () => {
  const repoRoot = resolveRepoRoot(import.meta.url);
  const script = parseScript(
    JSON.parse(readFileSync(join(repoRoot, "fixtures", "script.edu.json"), "utf8")) as unknown,
  );

  it("render props hash đổi khi caption timing đổi, audio hash giữ", () => {
    const sceneArtifacts: SceneMediaArtifacts[] = script.scenes.map((scene, index) => {
      const artifactId = `${index}`.padStart(32, "a");
      return {
        sceneId: scene.id,
        wavArtifactId: artifactId,
        measuredDurationMs: 9000,
        alignment: sampleAlignment(scene.narration, 9000, artifactId),
      };
    });

    const base = buildEduVerticalRenderProps({
      script,
      sceneArtifacts,
      audioStorageKey: "pipeline/test.wav",
      totalDurationMs: 60_000,
    });
    const targetScene = script.scenes[1];
    if (!targetScene) {
      throw new Error("missing scene");
    }
    let captionOffset = 0;
    for (let index = 0; index < 1; index += 1) {
      captionOffset += sceneArtifacts[index]?.alignment.words.length ?? 0;
    }
    const targetCaption = base.captions[captionOffset + 1];
    if (!targetCaption) {
      throw new Error("missing target caption");
    }
    const overridden = buildEduVerticalRenderProps({
      script,
      sceneArtifacts,
      audioStorageKey: "pipeline/test.wav",
      totalDurationMs: 60_000,
      captionOverride: {
        schemaVersion: 1,
        overrides: [
          {
            sceneId: targetScene.id,
            wordIndex: 1,
            startMs: targetCaption.startMs + 15,
            endMs: targetCaption.endMs + 15,
          },
        ],
      },
    });

    const audioSha = "c".repeat(64);
    const baseHash = hashEduVerticalRenderProps(base, { audioContentSha256: audioSha });
    const overrideHash = hashEduVerticalRenderProps(overridden, { audioContentSha256: audioSha });
    expect(overrideHash).not.toBe(baseHash);
    expect(overridden.captions[captionOffset + 1]?.text).toBe(targetCaption.text);
    expect(overridden.captions[captionOffset + 1]?.startMs).toBe(targetCaption.startMs + 15);
  });

  it("override không gọi synthesize/align khi cache có sẵn", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "p1-08-media-"));
    mkdirSync(join(dataDir, "tts"), { recursive: true });
    mkdirSync(join(dataDir, "alignment"), { recursive: true });
    const voiceId = "Mai Anh";

    for (const scene of script.scenes) {
      const contentKey = synthesizeContentKey(scene.narration, voiceId);
      const artifactId = contentKey.slice(0, 32);
      const indexPath = synthesizeIndexPath(dataDir, contentKey);
      mkdirSync(dirname(indexPath), { recursive: true });
      writeFileSync(
        indexPath,
        JSON.stringify({ artifactId, voiceId, textSha256: contentKey }),
      );
      writeFileSync(join(dataDir, "tts", `${artifactId}.wav`), minimalWavHeader());
      writeFileSync(
        alignmentJsonPath(dataDir, artifactId),
        JSON.stringify(sampleAlignment(scene.narration, 9000, artifactId)),
      );
    }

    const synthesize = vi.fn();
    const align = vi.fn();
    const revalidateGate = vi.fn();
    const client = { synthesize, align, revalidateGate };

    vi.spyOn(ffprobe, "probeWavDurationMs").mockReturnValue(9000);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), { status: 200 }) as Response,
    );

    const first = await collectSceneMediaArtifacts({
      script,
      dataDir,
      ttsClient: client as never,
    });
    expect(synthesize).not.toHaveBeenCalled();
    expect(align).not.toHaveBeenCalled();
    expect(first.timings.synthesizeReused).toBe(script.scenes.length);
    expect(first.timings.alignReused).toBe(script.scenes.length);

    synthesize.mockClear();
    align.mockClear();

    const second = await collectSceneMediaArtifacts({
      script,
      dataDir,
      ttsClient: client as never,
    });
    expect(synthesize).not.toHaveBeenCalled();
    expect(align).not.toHaveBeenCalled();
    expect(second.timings.synthesizeReused).toBe(script.scenes.length);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});

describe("buildEduVerticalRenderProps caption override", () => {
  const repoRoot = resolveRepoRoot(import.meta.url);
  const script = parseScript(
    JSON.parse(readFileSync(join(repoRoot, "fixtures", "script.edu.json"), "utf8")) as unknown,
  );

  it("từ chối override không hợp lệ trước render props", () => {
    const sceneArtifacts: SceneMediaArtifacts[] = script.scenes.map((scene, index) => ({
      sceneId: scene.id,
      wavArtifactId: `${index}`.padStart(32, "b"),
      measuredDurationMs: 9000,
      alignment: sampleAlignment(scene.narration, 9000, `${index}`.padStart(32, "b")),
    }));

    expect(() =>
      buildEduVerticalRenderProps({
        script,
        sceneArtifacts,
        audioStorageKey: "pipeline/test.wav",
        totalDurationMs: 60_000,
        captionOverride: {
          schemaVersion: 1,
          overrides: [{ sceneId: "missing-scene", wordIndex: 0, startMs: 1, endMs: 2 }],
        },
      }),
    ).toThrow();
  });
});
