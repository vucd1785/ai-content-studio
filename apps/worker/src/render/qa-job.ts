import { randomUUID } from "node:crypto";
import { type QaReportArtifact, qaReportArtifactSchema } from "@studio/contracts";
import { findLatestRunArtifact, findParentArtifact, type StudioDb } from "@studio/db";
import { type EduVerticalRenderProps, eduVerticalRenderPropsSchema } from "@studio/video/render-props/schema";
import { readJsonArtifact, writeJsonArtifact } from "../jobs/job-support.js";
import type { Mp4Info, RenderBackend } from "./render-backend.js";
import { runStageJob, type StageJobResult } from "./stage-job.js";

/** Khoảng duration hợp lệ của video, giống giới hạn `durationSec` của brief (30–90 giây). */
export const QA_DURATION_RANGE_MS = { min: 30_000, max: 90_000 } as const;
/** Khoảng trống phụ đề trong cùng một cảnh dài hơn mức này là lỗi (05-VIDEO-PIPELINE mục Alignment). */
export const QA_MAX_CAPTION_GAP_MS = 1_500;

type Check = QaReportArtifact["checks"][number];

/** Các check của QA, hàm thuần để test riêng. `props` null nghĩa là render props không đọc được. */
export function runQaChecks(props: EduVerticalRenderProps | null, mp4: Mp4Info | null): Check[] {
  const checks: Check[] = [];
  if (props === null) {
    return [{ code: "schema_invalid", severity: "error", message: "render props thiếu hoặc sai schema" }];
  }
  if (mp4 === null || !mp4.hasAudio || props.audio.durationMs <= 0) {
    checks.push({ code: "audio_missing", severity: "error", message: "preview không có luồng audio" });
  }
  if (mp4 !== null && (mp4.width !== props.width || mp4.height !== props.height || !mp4.hasVideo)) {
    checks.push({
      code: "frame_size_mismatch",
      severity: "error",
      message: `preview ${mp4.width}x${mp4.height}, props ${props.width}x${props.height}`,
    });
  }
  const totalMs = props.scenes.reduce((sum, scene) => sum + scene.durationMs, 0);
  if (totalMs < QA_DURATION_RANGE_MS.min || totalMs > QA_DURATION_RANGE_MS.max) {
    checks.push({ code: "duration_out_of_range", severity: "error", message: `tổng ${totalMs} ms` });
  }
  for (const scene of props.scenes) {
    const end = scene.fromMs + scene.durationMs;
    const inScene = props.captions
      .filter((caption) => caption.startMs >= scene.fromMs && caption.startMs < end)
      .sort((a, b) => a.startMs - b.startMs);
    for (let index = 1; index < inScene.length; index += 1) {
      const gap = (inScene[index]?.startMs ?? 0) - (inScene[index - 1]?.endMs ?? 0);
      if (gap > QA_MAX_CAPTION_GAP_MS) {
        checks.push({ code: "caption_gap", severity: "error", message: `cảnh ${scene.sceneId}: trống ${gap} ms` });
        break;
      }
    }
  }
  return checks;
}

/**
 * Job QA (P3-06, role `qa`, queue `media`): `qa` → `waiting_final_approval`. Kiểm preview mới nhất của run
 * và render props của nó, ghi `qa_report`. Không ghi approval; error trong report chặn duyệt final ở route approval.
 */
export function runQaJob(db: StudioDb, jobId: string, deps: { dataDir: string; backend: RenderBackend }): Promise<StageJobResult> {
  return runStageJob(
    db,
    jobId,
    { role: "qa", enter: { working: "qa" }, done: "waiting_final_approval", resumeFrom: "qa" },
    async (context) => {
      const runId = context.workflowRun.id;
      const preview = await findLatestRunArtifact(db, runId, "preview");
      if (preview === null) {
        return { ok: false, errorCode: "preview_missing", message: "no preview to check" };
      }
      const propsRow = await findParentArtifact(db, preview.id, "render_props");
      const props =
        propsRow === null ? null : await readJsonArtifact(deps.dataDir, propsRow.storageKey, eduVerticalRenderPropsSchema);
      const mp4 = await deps.backend.probe(preview.storageKey).catch(() => null);
      const checks = runQaChecks(props, mp4);
      const report = qaReportArtifactSchema.parse({
        schemaVersion: 1,
        previewArtifactId: preview.id,
        passed: !checks.some((check) => check.severity === "error"),
        checks,
      });
      const key = `artifacts/${runId}/qa-report-${randomUUID()}.json`;
      return {
        ok: true,
        artifacts: [
          {
            type: "qa_report",
            schemaVersion: "1",
            contentHash: await writeJsonArtifact(deps.dataDir, key, report),
            storageKey: key,
            // Route approval đọc hai field này để chặn duyệt final khi QA có error.
            metadata: { idempotencyKey: context.job.idempotencyKey, jobId, previewArtifactId: preview.id, passed: report.passed },
          },
        ],
        parentArtifacts: [[0, preview.id]],
      };
    },
  );
}
