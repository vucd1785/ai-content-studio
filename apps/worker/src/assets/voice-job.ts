import { randomUUID } from "node:crypto";
import { alignmentArtifactSchema, audioManifestArtifactSchema } from "@studio/contracts";
import { isJobCancelled, recordJobProgress, type StudioDb } from "@studio/db";
import { assertAlignmentAccepted, type SceneMediaArtifacts } from "../cli/build-render-props.js";
import {
  collectSceneMediaArtifacts,
  type MediaStageHooks,
  type VoiceScene,
  voiceStepTotal,
} from "../cli/media-stage.js";
import { PipelineError } from "../cli/paths.js";
import { readRedoRequest, writeJsonArtifact } from "../jobs/job-support.js";
import { TtsMediaClient } from "../media-client.js";
import { AssetJobError, type AssetJobResult, runAssetJob } from "./asset-job.js";

export const DEFAULT_VOICE_ID = "Mai Anh";

export type VoiceJobDeps = {
  dataDir: string;
  /** Giọng dự phòng cho `narrator` khi kênh chưa có giọng người dẫn; nhân vật luôn dùng giọng của kênh. */
  voiceId?: string;
  /**
   * TTS + ffprobe + alignment theo câu đã gắn giọng (P6-08, P6-17). Mặc định gọi `services/tts` qua
   * `TTS_BASE_URL`. Test thay bằng bản giả để không gọi TTS thật.
   */
  collectVoiceScenes?: (
    voiceScenes: VoiceScene[],
    hooks: MediaStageHooks,
    options?: { forceSceneIds?: ReadonlySet<string> },
  ) => Promise<SceneMediaArtifacts[]>;
};

/** Câu theo người nói của script `2` trước khi gắn giọng. */
export type SpeakerLine = { id: string; speaker: string; text: string };

/** Giọng của kênh: `brand_characters.voice_id` theo `character_key`, và giọng người dẫn chuyện. */
export type CastVoices = {
  characters: ReadonlyMap<string, string | null>;
  narratorVoiceId: string | null;
};

/**
 * Gắn giọng cho từng câu (05 mục TTS, script `2`): nhân vật dùng giọng của mình; `narrator` dùng giọng
 * người dẫn của kênh, không có thì `fallbackVoiceId` (`TTS_DEFAULT_VOICE`). Nhân vật nói mà chưa có giọng
 * thì trượt ngay với `configuration_missing`, không đọc bằng giọng khác.
 */
export function resolveLineVoices(
  scenes: readonly { sceneId: string; lines: readonly SpeakerLine[] }[],
  voices: CastVoices,
  fallbackVoiceId: string,
): VoiceScene[] {
  const missing = new Set<string>();
  const resolved = scenes.map((scene) => ({
    sceneId: scene.sceneId,
    lines: scene.lines.map((line) => {
      let voiceId: string | null | undefined;
      if (line.speaker === "narrator") {
        voiceId = voices.narratorVoiceId ?? fallbackVoiceId;
      } else {
        voiceId = voices.characters.get(line.speaker);
      }
      if (voiceId === null || voiceId === undefined || voiceId.trim() === "") {
        missing.add(line.speaker);
        voiceId = "";
      }
      return { lineId: line.id, speaker: line.speaker, text: line.text, voiceId };
    }),
  }));
  if (missing.size > 0) {
    throw new AssetJobError(
      "configuration_missing",
      `Nhân vật chưa có giọng: ${[...missing].join(", ")}. Chọn giọng trong phần kênh trước khi chạy.`,
    );
  }
  return resolved;
}

function defaultCollectVoiceScenes(dataDir: string) {
  return async (
    voiceScenes: VoiceScene[],
    hooks: MediaStageHooks,
    options?: { forceSceneIds?: ReadonlySet<string> },
  ) => {
    const ttsClient = new TtsMediaClient({
      baseUrl: process.env.TTS_BASE_URL ?? "http://127.0.0.1:8000",
    });
    return (
      await collectSceneMediaArtifacts({
        voiceScenes,
        dataDir,
        ttsClient,
        hooks,
        ...(options?.forceSceneIds === undefined ? {} : { forceSceneIds: options.forceSceneIds }),
      })
    ).scenes;
  };
}

/**
 * Tiến độ thật và kiểm hủy của job voice (P3-17). Lỗi ghi tiến độ (DB bận, vừa khởi động lại) chỉ log,
 * không làm hỏng job đang đọc lời.
 */
function voiceHooks(db: StudioDb, jobId: string): MediaStageHooks {
  return {
    async onStep(step) {
      try {
        await recordJobProgress(db, jobId, {
          done: step.done,
          total: step.total,
          unit: "scene_step",
          sceneIndex: step.sceneIndex,
          sceneCount: step.sceneCount,
          phase: step.phase,
          ...(step.lineIndex === undefined
            ? {}
            : { lineIndex: step.lineIndex, lineCount: step.lineCount }),
        });
      } catch (error) {
        console.error(
          `voice: không ghi được tiến độ: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    isCancelled: () => isJobCancelled(db, jobId),
  };
}

/**
 * Job voice (P3-05, P6-17, queue `media`): TTS từng câu của phương án đã duyệt bằng giọng của người nói, rồi
 * alignment. Code, không LLM.
 * Ghi `audio` (danh sách WAV + duration ffprobe) và `alignment` (response gốc); alignment không qua cổng thì fail.
 */
export function runVoiceJob(
  db: StudioDb,
  jobId: string,
  deps: VoiceJobDeps,
): Promise<AssetJobResult> {
  return runAssetJob(db, jobId, "voice", deps.dataDir, async (context, approved) => {
    const voiceId = deps.voiceId ?? DEFAULT_VOICE_ID;
    let scenes: SceneMediaArtifacts[];
    const hooks = voiceHooks(db, jobId);
    // Mỗi câu đọc bằng giọng của người nói trong kênh (ADR-015).
    const plan = resolveLineVoices(
      approved.script.scenes.map((scene) => ({ sceneId: scene.id, lines: scene.lines })),
      {
        characters: new Map(approved.brand.characters.map((c) => [c.characterKey, c.voiceId])),
        narratorVoiceId: approved.brand.narratorVoiceId,
      },
      voiceId,
    );
    // Mốc 0 ngay khi bắt đầu để giao diện biết job đã nhận và có bao nhiêu bước (mỗi câu một bước đọc).
    await hooks.onStep?.({
      done: 0,
      total: voiceStepTotal(plan),
      sceneIndex: 1,
      sceneCount: plan.length,
      phase: "synthesize",
      sceneId: plan[0]?.sceneId ?? "",
    });
    // Đọc lại một cảnh ở Cổng 2 (ADR-021): chỉ cảnh đó bỏ cache, cảnh khác dùng lại bản đọc cũ.
    const redo = await readRedoRequest(
      deps.dataDir,
      context.workflowRun.id,
      context.job.idempotencyKey,
    );
    if (redo === "unreadable") {
      return { ok: false, errorCode: "schema_invalid", message: "redo request file is unreadable" };
    }
    const forceSceneIds =
      redo?.request.kind === "revoice" ? new Set([redo.request.sceneId]) : undefined;
    if (forceSceneIds !== undefined && !plan.some((scene) => forceSceneIds.has(scene.sceneId))) {
      return { ok: false, errorCode: "schema_invalid", message: "redo scene is not in the script" };
    }
    try {
      scenes = await (deps.collectVoiceScenes ?? defaultCollectVoiceScenes(deps.dataDir))(
        plan,
        hooks,
        forceSceneIds === undefined ? undefined : { forceSceneIds },
      );
      for (const scene of scenes) {
        assertAlignmentAccepted(scene.alignment, scene.sceneId);
      }
    } catch (error) {
      if (error instanceof PipelineError) {
        throw new AssetJobError(error.code, error.message);
      }
      throw error;
    }
    const expected = plan.map((scene) => scene.sceneId);
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
      return {
        ok: false,
        errorCode: "schema_invalid",
        message: "voice artifacts failed validation",
      };
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
          metadata: {
            ...metadata,
            kind: "scene_wav_manifest",
            voiceId,
            totalDurationMs,
            // Ranh giới từng câu (ms) trong WAV cảnh, theo 05 mục TTS; render `StickStory` đọc ở đây.
            lines: scenes.map((scene) => ({
              sceneId: scene.sceneId,
              alignmentMode: scene.alignmentMode ?? "scene",
              lines: scene.lines ?? [],
            })),
          },
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
