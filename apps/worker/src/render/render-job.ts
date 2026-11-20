import { randomUUID } from "node:crypto";
import {
  alignmentArtifactSchema,
  audioManifestArtifactSchema,
  redoResultFileSchema,
  redoResultStorageKey,
} from "@studio/contracts";
import {
  findLatestRunArtifact,
  findRunApproval,
  getArtifactById,
  type JobContext,
  qaJobKeyAfterRender,
  type StudioDb,
} from "@studio/db";
import { parseStickStoryRenderProps } from "@studio/video/stick-story/props";
import { approvalIdFromRenderJobKey, loadScriptV2Variant } from "../assets/approved-script.js";
import type { SceneLineAudio, SceneMediaArtifacts } from "../cli/build-render-props.js";
import { buildStickStoryRenderProps, runAspectRatio } from "../cli/build-stick-story-props.js";
import { PipelineError } from "../cli/paths.js";
import { readJsonArtifact, readRedoRequest, writeJsonArtifact } from "../jobs/job-support.js";
import { publishBrandAvatar } from "./brand-avatar.js";
import { applyRedoOverrides, loadRedoOverrides } from "./redo.js";
import type { RenderBackend } from "./render-backend.js";
import { renderProgressRecorder } from "./render-progress.js";
import type { StageOutput } from "./stage-job.js";
import { runStageJob, type StageJobResult } from "./stage-job.js";
import { speakerColors } from "./storyboard-job.js";

/** Kết quả Claude Code tạo lại một hình (ADR-021). */
export type RegeneratedAsset = { assetId: string | null; error: string | null };

export type RenderJobDeps = {
  dataDir: string;
  backend: RenderBackend;
  /**
   * Tạo lại một hình theo ghi chú của Director (ADR-021). Thiếu (test, Claude Code chưa cấu hình) thì lần làm
   * lại ghi lỗi và video giữ hình cũ.
   */
  regenerateAsset?: (input: {
    runId: string;
    agentRunId: string;
    topic: string;
    oldAssetId: string;
    note: string;
  }) => Promise<RegeneratedAsset>;
};

/**
 * Job render (P3-06, P6-17, role `video`, queue `render`): `producing_assets` → `preview_rendering` → `qa`.
 * Dựng `render_props` `StickStory` từ phương án script `2` đã duyệt, audio theo câu và alignment, render preview
 * CRF cao, rồi tạo job QA. Không gọi TTS hay LLM.
 */
export function runRenderJob(
  db: StudioDb,
  jobId: string,
  deps: RenderJobDeps,
): Promise<StageJobResult> {
  return runStageJob(
    db,
    jobId,
    {
      role: "video",
      enter: { from: "producing_assets", working: "preview_rendering" },
      done: "qa",
      resumeFrom: "preview_rendering",
      precheck: (context) =>
        context.job.idempotencyKey.startsWith("render:") ? null : "not_render_job",
    },
    (context) => renderStickStory(db, jobId, deps, context),
  );
}

type AudioLinesMetadata = {
  lines?: { sceneId: string; lines: SceneLineAudio[] }[];
};

/**
 * Dựng `render_props` `StickStory` từ shot list của phương án đã duyệt, audio theo câu và alignment của cảnh
 * (P6-08, P6-09), render preview, rồi tạo job QA.
 */
async function renderStickStory(
  db: StudioDb,
  jobId: string,
  deps: RenderJobDeps,
  context: JobContext,
): Promise<StageOutput> {
  const runId = context.workflowRun.id;
  const approvalId = approvalIdFromRenderJobKey(context.job.idempotencyKey);
  const approval = approvalId === null ? null : await findRunApproval(db, runId, approvalId);
  const scriptRow = approval === null ? null : await getArtifactById(db, approval.artifactId);
  if (scriptRow === null || scriptRow.schemaVersion !== "2" || approval === null) {
    return {
      ok: false,
      errorCode: "script_missing",
      message: "no approved script v2 for this render",
    };
  }
  const variantIndex = approval.variantIndex === 2 ? 2 : 1;
  const approved = await loadScriptV2Variant(db, deps.dataDir, runId, scriptRow, variantIndex);
  if (approved === null) {
    return {
      ok: false,
      errorCode: "script_missing",
      message: "approved script v2 is not readable",
    };
  }
  const [audioRow, alignmentRow] = await Promise.all([
    findLatestRunArtifact(db, runId, "audio"),
    findLatestRunArtifact(db, runId, "alignment"),
  ]);
  const manifest =
    audioRow === null
      ? null
      : await readJsonArtifact(deps.dataDir, audioRow.storageKey, audioManifestArtifactSchema);
  const alignment =
    alignmentRow === null
      ? null
      : await readJsonArtifact(deps.dataDir, alignmentRow.storageKey, alignmentArtifactSchema);
  const audioLines = (audioRow?.metadata as AudioLinesMetadata | undefined)?.lines ?? [];
  if (manifest === null || alignment === null || audioRow === null || alignmentRow === null) {
    return { ok: false, errorCode: "audio_missing", message: "no readable audio or alignment" };
  }
  const sceneArtifacts: SceneMediaArtifacts[] = [];
  for (const scene of manifest.scenes) {
    const aligned = alignment.scenes.find((item) => item.sceneId === scene.sceneId);
    const lines = audioLines.find((item) => item.sceneId === scene.sceneId)?.lines;
    if (aligned === undefined || lines === undefined || lines.length === 0) {
      return {
        ok: false,
        errorCode: "audio_missing",
        message: `no alignment or line spans for ${scene.sceneId}`,
      };
    }
    sceneArtifacts.push({ ...scene, alignment: aligned.alignment, lines });
  }

  const { brand, format, script } = approved;
  const colors = speakerColors(brand.palette, brand.characters);
  const audio = await deps.backend.buildAudio(manifest);
  let built: ReturnType<typeof buildStickStoryRenderProps>;
  try {
    built = buildStickStoryRenderProps({
      script,
      sceneArtifacts,
      cast: brand.characters.map((c) => ({
        characterKey: c.characterKey,
        skinAssetId: c.skinAssetId,
        color: colors[c.characterKey] ?? "#ffffff",
      })),
      format,
      brand: {
        fontFamily: brand.fonts.body ?? "system-ui, 'Segoe UI', sans-serif",
        textColor: "#ffffff",
        introAssetId: brand.introAssetId,
        outroAssetId: brand.outroAssetId,
        channelName: brand.displayName,
        accentColor: brand.palette.accent ?? null,
        // ADR-028: avatar kênh trên thẻ kết, nếu Director đã đặt file avatar của kênh.
        avatarSrc: publishBrandAvatar(deps.dataDir, brand.slug),
      },
      audioStorageKey: audio.audioStorageKey,
      totalDurationMs: audio.totalDurationMs,
      audioSrc: audio.audioSrc,
      aspectRatio: runAspectRatio(context.workflowRun.aspectRatio),
    });
  } catch (error) {
    if (error instanceof PipelineError) {
      return { ok: false, errorCode: error.code, message: error.message };
    }
    return {
      ok: false,
      errorCode: "render_props_invalid",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  // Làm lại một phần ở Cổng 2 (ADR-021): làm việc của lần này (tạo lại hình), rồi áp mọi lần sau duyệt kịch bản.
  const redo = await readRedoRequest(deps.dataDir, runId, context.job.idempotencyKey);
  if (redo === "unreadable") {
    return { ok: false, errorCode: "schema_invalid", message: "redo request file is unreadable" };
  }
  let redoOutcome: { redoId: string; kind: string; ok: boolean; message: string | null } | null =
    redo === null
      ? null
      : { redoId: redo.redoId, kind: redo.request.kind, ok: true, message: null };
  if (redo !== null && redo.request.kind === "regenerate_asset") {
    const resultKey = redoResultStorageKey(runId, redo.redoId);
    let result = await readJsonArtifact(deps.dataDir, resultKey, redoResultFileSchema);
    if (result === null) {
      const regenerated =
        deps.regenerateAsset === undefined
          ? { assetId: null, error: "Claude Code chưa cấu hình cho worker" }
          : await deps.regenerateAsset({
              runId,
              agentRunId: context.agentRun.id,
              topic: context.brief.topic,
              oldAssetId: redo.request.assetId,
              note: redo.request.note,
            });
      result = {
        redoId: redo.redoId,
        oldAssetId: redo.request.assetId,
        newAssetId: regenerated.assetId,
        error: regenerated.error,
      };
      await writeJsonArtifact(deps.dataDir, resultKey, result);
    }
    if (result.newAssetId === null) {
      redoOutcome = {
        ...(redoOutcome as NonNullable<typeof redoOutcome>),
        ok: false,
        message: result.error,
      };
    }
  }
  const overrides = await loadRedoOverrides(deps.dataDir, runId, approval.createdAt);
  if (overrides.length > 0) {
    try {
      built = {
        ...built,
        props: parseStickStoryRenderProps(applyRedoOverrides(built.props, overrides)),
      };
    } catch (error) {
      return {
        ok: false,
        errorCode: "render_props_invalid",
        message: `redo overrides: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  const rendered = await deps.backend.render(
    "preview",
    built.props,
    audio.audioContentSha256,
    renderProgressRecorder(db, jobId),
  );
  const propsKey = `artifacts/${runId}/render-props-${randomUUID()}.json`;
  const metadata = { idempotencyKey: context.job.idempotencyKey, jobId };
  return {
    ok: true,
    artifacts: [
      {
        type: "render_props",
        schemaVersion: "2",
        contentHash: await writeJsonArtifact(deps.dataDir, propsKey, built.props),
        storageKey: propsKey,
        metadata: {
          ...metadata,
          templateId: built.props.templateId,
          propsContentHash: rendered.contentHash,
          audioContentSha256: audio.audioContentSha256,
          // QA đọc các cảnh báo này (kẹp từ về câu, frame cắt, luật nhịp); không chặn duyệt.
          warnings: built.warnings,
          // ADR-021: lần làm lại đã chạy ở job này (web báo khi tạo lại hình không thành).
          ...(redoOutcome === null ? {} : { redo: redoOutcome }),
        },
      },
      {
        type: "preview",
        schemaVersion: "1",
        contentHash: rendered.contentHash,
        storageKey: rendered.storageKey,
        metadata: { ...metadata, purpose: "preview", cacheHit: rendered.cacheHit },
      },
    ],
    // preview ← render_props ← script, audio, alignment (làm bẩn version).
    dependencies: [[1, 0]],
    parentArtifacts: [
      [0, scriptRow.id],
      [0, audioRow.id],
      [0, alignmentRow.id],
    ],
    nextJob: (renderJobId) => ({
      role: "qa",
      queue: "media",
      idempotencyKey: qaJobKeyAfterRender(runId, renderJobId),
    }),
  };
}
