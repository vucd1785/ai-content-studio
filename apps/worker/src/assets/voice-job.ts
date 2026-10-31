import { randomUUID } from "node:crypto";
import { alignmentArtifactSchema, audioManifestArtifactSchema, type Script } from "@studio/contracts";
import type { StudioDb } from "@studio/db";
import { assertAlignmentAccepted, type SceneMediaArtifacts } from "../cli/build-render-props.js";
import { collectSceneMediaArtifacts } from "../cli/media-stage.js";
import { PipelineError } from "../cli/paths.js";
import { writeJsonArtifact } from "../jobs/job-support.js";
import { TtsMediaClient } from "../media-client.js";
import { AssetJobError, type AssetJobResult, runAssetJob } from "./asset-job.js";

export const DEFAULT_VOICE_ID = "Mai Anh";

export type VoiceJobDeps = {
  dataDir: string;
  voiceId?: string;
  /**
   * TTS + ffprobe + alignment cho từng cảnh. Mặc định gọi `services/tts` qua `TTS_BASE_URL` (P1-02, P1-06).
   * Test thay bằng bản giả để không gọi TTS thật.
   */
  collectMedia?: (script: Script, voiceId: string) => Promise<SceneMediaArtifacts[]>;
};

function defaultCollectMedia(dataDir: string) {
  return async (script: Script, voiceId: string) => {
    const ttsClient = new TtsMediaClient({ baseUrl: process.env.TTS_BASE_URL ?? "http://127.0.0.1:8000" });
    return (await collectSceneMediaArtifacts({ script, dataDir, ttsClient, voiceId })).scenes;
  };
}

/**
 * Job voice (P3-05, queue `media`): TTS từng cảnh của phương án đã duyệt rồi alignment. Code, không LLM.
 * Ghi `audio` (danh sách WAV + duration ffprobe) và `alignment` (response gốc); alignment không qua cổng thì fail.
 */
export function runVoiceJob(db: StudioDb, jobId: string, deps: VoiceJobDeps): Promise<AssetJobResult> {
  return runAssetJob(db, jobId, "voice", deps.dataDir, async (context, approved) => {
    const voiceId = deps.voiceId ?? DEFAULT_VOICE_ID;
    const collect = deps.collectMedia ?? defaultCollectMedia(deps.dataDir);
    let scenes: SceneMediaArtifacts[];
    try {
      scenes = await collect(approved.script, voiceId);
      for (const scene of scenes) {
        assertAlignmentAccepted(scene.alignment, scene.sceneId);
      }
    } catch (error) {
      if (error instanceof PipelineError) {
        throw new AssetJobError(error.code, error.message);
      }
      throw error;
    }
    const expected = approved.script.scenes.map((scene) => scene.id);
    if (scenes.map((scene) => scene.sceneId).join("\n") !== expected.join("\n")) {
      return { ok: false, errorCode: "audio_missing", message: "TTS did not return every scene" };
    }

    const manifest = audioManifestArtifactSchema.safeParse({
      schemaVersion: 1,
      scriptArtifactId: approved.scriptArtifactId,
      variantIndex: approved.variantIndex,
      voiceId,
      scenes: scenes.map((scene) => ({
        sceneId: scene.sceneId,
        wavArtifactId: scene.wavArtifactId,
        measuredDurationMs: scene.measuredDurationMs,
      })),
    });
    const alignment = alignmentArtifactSchema.safeParse({
      schemaVersion: 1,
      scenes: scenes.map((scene) => ({ sceneId: scene.sceneId, alignment: scene.alignment })),
    });
    if (!manifest.success || !alignment.success) {
      return { ok: false, errorCode: "schema_invalid", message: "voice artifacts failed validation" };
    }
    const runId = context.workflowRun.id;
    const audioKey = `artifacts/${runId}/audio-${randomUUID()}.json`;
    const alignmentKey = `artifacts/${runId}/alignment-${randomUUID()}.json`;
    const metadata = {
      idempotencyKey: context.job.idempotencyKey,
      jobId,
      approvalId: approved.approvalId,
      variantIndex: approved.variantIndex,
    };
    const totalDurationMs = scenes.reduce((sum, scene) => sum + scene.measuredDurationMs, 0);
    return {
      ok: true,
      artifacts: [
        {
          type: "audio",
          schemaVersion: "1",
          contentHash: await writeJsonArtifact(deps.dataDir, audioKey, manifest.data),
          storageKey: audioKey,
          metadata: { ...metadata, kind: "scene_wav_manifest", voiceId, totalDurationMs },
        },
        {
          type: "alignment",
          schemaVersion: "1",
          contentHash: await writeJsonArtifact(deps.dataDir, alignmentKey, alignment.data),
          storageKey: alignmentKey,
          metadata,
        },
      ],
      // alignment ← audio ← script (làm bẩn version, 04-AGENT-ORCHESTRATION).
      dependencies: [[1, 0]],
      parentArtifacts: [[0, approved.scriptArtifactId]],
    };
  });
}
