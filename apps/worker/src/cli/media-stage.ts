import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AlignResponse, Script, SynthesizeResponse } from "@studio/contracts";
import { alignResponseSchema } from "@studio/contracts";
import type { TtsMediaClient } from "../media-client.js";
import type { SceneMediaArtifacts } from "./build-render-props.js";
import { probeWavDurationMs } from "./ffprobe.js";
import {
  alignmentJsonPath,
  PipelineError,
  type SynthesizeIndexEntry,
  sha256FileHex,
  synthesizeContentKey,
  synthesizeIndexPath,
  ttsWavPath,
} from "./paths.js";

const DEFAULT_VOICE = "Mai Anh";

export type MediaStageTimings = {
  synthesizeMs: number;
  alignMs: number;
  synthesizeReused: number;
  alignReused: number;
};

export async function collectSceneMediaArtifacts(input: {
  script: Script;
  dataDir: string;
  ttsClient: TtsMediaClient;
  voiceId?: string;
}): Promise<{ scenes: SceneMediaArtifacts[]; timings: MediaStageTimings }> {
  const voice = input.voiceId ?? DEFAULT_VOICE;
  let synthesizeMs = 0;
  let alignMs = 0;
  let synthesizeReused = 0;
  let alignReused = 0;
  const scenes: SceneMediaArtifacts[] = [];

  for (const scene of input.script.scenes) {
    const synthStart = performance.now();
    const artifactId = await resolveOrSynthesizeSceneWav({
      dataDir: input.dataDir,
      ttsClient: input.ttsClient,
      text: scene.narration,
      voiceId: voice,
      sceneId: scene.id,
    });
    synthesizeMs += performance.now() - synthStart;
    if (artifactId.reused) {
      synthesizeReused += 1;
    }

    const wavPath = ttsWavPath(input.dataDir, artifactId.artifactId);
    if (!existsSync(wavPath)) {
      throw new PipelineError("audio_missing", `WAV missing for scene ${scene.id}: ${wavPath}`);
    }

    const measuredDurationMs = probeWavDurationMs(wavPath);

    const alignStart = performance.now();
    const alignment = await resolveOrAlignScene({
      dataDir: input.dataDir,
      ttsClient: input.ttsClient,
      audioArtifactId: artifactId.artifactId,
      transcript: scene.narration,
      sceneId: scene.id,
    });
    alignMs += performance.now() - alignStart;
    if (alignment.reused) {
      alignReused += 1;
    }

    scenes.push({
      sceneId: scene.id,
      wavArtifactId: artifactId.artifactId,
      measuredDurationMs,
      alignment: alignment.response,
    });
  }

  return {
    scenes,
    timings: { synthesizeMs, alignMs, synthesizeReused, alignReused },
  };
}

async function resolveOrSynthesizeSceneWav(input: {
  dataDir: string;
  ttsClient: TtsMediaClient;
  text: string;
  voiceId: string;
  sceneId: string;
}): Promise<{ artifactId: string; reused: boolean }> {
  const contentKey = synthesizeContentKey(input.text, input.voiceId);
  const indexPath = synthesizeIndexPath(input.dataDir, contentKey);
  if (existsSync(indexPath)) {
    const entry = JSON.parse(readFileSync(indexPath, "utf8")) as SynthesizeIndexEntry;
    const wavPath = ttsWavPath(input.dataDir, entry.artifactId);
    if (existsSync(wavPath)) {
      return { artifactId: entry.artifactId, reused: true };
    }
  }

  let response: SynthesizeResponse;
  try {
    response = await input.ttsClient.synthesize({ text: input.text, voiceId: input.voiceId });
  } catch (cause) {
    throw new PipelineError(
      "synthesis_failed",
      `Scene ${input.sceneId}: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  mkdirSync(dirname(indexPath), { recursive: true });
  const entry: SynthesizeIndexEntry = {
    artifactId: response.artifactId,
    voiceId: input.voiceId,
    textSha256: contentKey,
  };
  writeFileSync(indexPath, JSON.stringify(entry, null, 2), "utf8");

  return { artifactId: response.artifactId, reused: false };
}

const GATE_POLICY_VERSION = "2.0.0-silence-aware";

async function resolveOrAlignScene(input: {
  dataDir: string;
  ttsClient: TtsMediaClient;
  audioArtifactId: string;
  transcript: string;
  sceneId: string;
}): Promise<{ response: AlignResponse; reused: boolean; revalidated?: boolean }> {
  const jsonPath = alignmentJsonPath(input.dataDir, input.audioArtifactId);
  if (existsSync(jsonPath)) {
    let cached: Record<string, unknown>;
    try {
      cached = JSON.parse(readFileSync(jsonPath, "utf8")) as Record<string, unknown>;
    } catch {
      cached = {};
    }

    if (String(cached.transcript ?? "").trim() === input.transcript.trim()) {
      try {
        const parsed = alignResponseSchema.parse({
          alignmentArtifactId: input.audioArtifactId,
          audioArtifactId: input.audioArtifactId,
          durationMs: cached.durationMs,
          transcript: cached.transcript,
          engine: cached.engine,
          modelId: cached.modelId,
          words: cached.words,
          validation: cached.validation,
          gate: cached.gate,
          processingMs: cached.processingMs ?? 0,
        });
        if (
          parsed.validation.ok &&
          parsed.gate.passesGate &&
          parsed.gate.gatePolicyVersion === GATE_POLICY_VERSION
        ) {
          return { response: parsed, reused: true };
        }
      } catch {
        // schema cũ hoặc gate chưa cập nhật → revalidate
      }

      try {
        const revalidated = await input.ttsClient.revalidateGate({
          audioArtifactId: input.audioArtifactId,
        });
        if (!revalidated.validation.ok || !revalidated.gate.passesGate) {
          throw new PipelineError(
            "alignment_gate_failed",
            `Scene ${input.sceneId}: gate still fails after revalidation`,
          );
        }
        return { response: revalidated, reused: true, revalidated: true };
      } catch (cause) {
        if (cause instanceof PipelineError) {
          throw cause;
        }
        throw new PipelineError(
          "alignment_failed",
          `Scene ${input.sceneId}: revalidate-gate failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      }
    }
  }

  let response: AlignResponse;
  try {
    response = await input.ttsClient.align({
      audioArtifactId: input.audioArtifactId,
      transcript: input.transcript,
    });
  } catch (cause) {
    throw new PipelineError(
      "alignment_failed",
      `Scene ${input.sceneId}: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  if (!response.validation.ok || !response.gate.passesGate) {
    throw new PipelineError(
      "alignment_gate_failed",
      `Scene ${input.sceneId}: alignment gate failed after align`,
    );
  }

  return { response, reused: false };
}

export function preparePublicAudioAsset(input: {
  dataDir: string;
  combinedWavPath: string;
  storageKey: string;
}): string {
  const publicRoot = join(input.dataDir, "render", "public");
  const dest = join(publicRoot, input.storageKey);
  mkdirSync(dirname(dest), { recursive: true });
  if (!existsSync(dest) || sha256FileHex(dest) !== sha256FileHex(input.combinedWavPath)) {
    copyFileSync(input.combinedWavPath, dest);
  }
  return dest;
}
