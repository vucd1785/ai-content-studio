#!/usr/bin/env node
/**
 * Read-only: map cached alignment → global captions for fixtures/script.edu.json.
 * Usage: node --import tsx scripts/dev/p1-08-inspect-captions.ts [sceneId] [wordIndex]
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  alignResponseSchema,
  buildCaptionsFromSceneAlignments,
  computeSceneTimingPlan,
  parseScript,
  SCENE_EDGE_PAD_MS,
  type SceneAlignmentForCaptions,
} from "../../packages/contracts/src/index.ts";
import { execFileSync } from "node:child_process";

const repoRoot = join(import.meta.dirname, "..", "..");
const dataDir = process.env.DATA_DIR?.trim()
  ? process.env.DATA_DIR
  : join(repoRoot, "data");
const scriptPath = join(repoRoot, "fixtures", "script.edu.json");

const SCENE_WAV_IDS = [
  "c1739d5fed364ed69221d7392ebf5f05",
  "961d85f4a88a4ca2965301bc1469849b",
  "e3110b2a9d3241b9a0f8ddaac3357579",
  "e640ef7f9ec847abb9c11bac47bac921",
  "76c1922ab99443cb89f476dd60ec073b",
] as const;

function probeWavDurationMs(wavPath: string): number {
  const out = execFileSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      wavPath,
    ],
    { encoding: "utf8" },
  ).trim();
  const sec = Number.parseFloat(out);
  if (!Number.isFinite(sec) || sec <= 0) {
    throw new Error(`ffprobe invalid duration for ${wavPath}: ${out}`);
  }
  return Math.round(sec * 1000);
}

function loadAlignment(artifactId: string) {
  const raw = JSON.parse(
    readFileSync(join(dataDir, "alignment", `${artifactId.toLowerCase()}.json`), "utf8"),
  ) as unknown;
  const cached = raw as Record<string, unknown>;
  return alignResponseSchema.parse({
    alignmentArtifactId: artifactId,
    audioArtifactId: artifactId,
    durationMs: cached.durationMs,
    transcript: cached.transcript,
    engine: cached.engine,
    modelId: cached.modelId,
    words: cached.words,
    validation: cached.validation,
    gate: cached.gate,
    processingMs: cached.processingMs ?? 0,
  });
}

const script = parseScript(JSON.parse(readFileSync(scriptPath, "utf8")) as unknown);
if (script.scenes.length !== SCENE_WAV_IDS.length) {
  throw new Error("scene/wav id count mismatch");
}

const measured = script.scenes.map((scene, index) => {
  const artifactId = SCENE_WAV_IDS[index];
  if (!artifactId) {
    throw new Error(`missing wav id index ${index}`);
  }
  const wavPath = join(dataDir, "tts", `${artifactId.toLowerCase()}.wav`);
  return {
    sceneId: scene.id,
    artifactId,
    measuredDurationMs: probeWavDurationMs(wavPath),
    alignment: loadAlignment(artifactId),
  };
});

const plan = computeSceneTimingPlan(
  measured.map((m) => ({ sceneId: m.sceneId, measuredDurationMs: m.measuredDurationMs })),
  30,
);

const alignmentInputs: SceneAlignmentForCaptions[] = measured.map((m, index) => {
  const timing = plan.scenes[index];
  if (!timing) {
    throw new Error(`missing timing ${index}`);
  }
  return {
    timing,
    measuredDurationMs: m.measuredDurationMs,
    words: m.alignment.words,
    validation: m.alignment.validation,
    alignmentDurationMs: m.alignment.durationMs,
  };
});

const captions = buildCaptionsFromSceneAlignments(alignmentInputs);

const targetSceneId = process.argv[2] ?? "what-is-redis";
const targetWordIndex = Number.parseInt(process.argv[3] ?? "2", 10);

const sceneIndex = script.scenes.findIndex((s) => s.id === targetSceneId);
if (sceneIndex < 0) {
  throw new Error(`unknown sceneId ${targetSceneId}`);
}

let globalOffset = 0;
for (let i = 0; i < sceneIndex; i += 1) {
  globalOffset += measured[i]?.alignment.words.length ?? 0;
}

const sceneMeta = measured[sceneIndex];
const timing = plan.scenes[sceneIndex];
if (!sceneMeta || !timing) {
  throw new Error("missing scene meta");
}

const word = sceneMeta.alignment.words[targetWordIndex];
const globalIndex = globalOffset + targetWordIndex;
const caption = captions[globalIndex];
const prev = globalIndex > 0 ? captions[globalIndex - 1] : undefined;
const next = captions[globalIndex + 1];

const audioOffsetMs = timing.fromMs + SCENE_EDGE_PAD_MS;
const sceneEndMs = timing.fromMs + timing.durationMs;
const audioEndMs = audioOffsetMs + sceneMeta.measuredDurationMs;

console.log(
  JSON.stringify(
    {
      captionCount: captions.length,
      target: {
        sceneId: targetSceneId,
        sceneIndex,
        wordIndex: targetWordIndex,
        globalCaptionIndex: globalIndex,
        alignmentWordText: word?.text,
        captionText: caption?.text,
        startMs: caption?.startMs,
        endMs: caption?.endMs,
        timestampMs: caption?.timestampMs,
      },
      neighbors: {
        previousCaptionEndMs: prev?.endMs ?? null,
        nextCaptionStartMs: next?.startMs ?? null,
        previousCaptionText: prev?.text ?? null,
        nextCaptionText: next?.text ?? null,
      },
      boundaries: {
        sceneFromMs: timing.fromMs,
        sceneDurationMs: timing.durationMs,
        sceneEndMs,
        audioOffsetMs,
        audioEndMs,
        measuredDurationMs: sceneMeta.measuredDurationMs,
        alignmentDurationMs: sceneMeta.alignment.durationMs,
      },
      suggestedOverride: caption
        ? {
            schemaVersion: 1,
            overrides: [
              {
                sceneId: targetSceneId,
                wordIndex: targetWordIndex,
                startMs: caption.startMs + 20,
                endMs: caption.endMs + 20,
              },
            ],
          }
        : null,
    },
    null,
    2,
  ),
);
