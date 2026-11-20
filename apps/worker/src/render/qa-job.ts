import { randomUUID } from "node:crypto";
import { type QaReportArtifact, qaReportArtifactSchema } from "@studio/contracts";
import { findLatestRunArtifact, findParentArtifact, type StudioDb } from "@studio/db";
import {
  type StickStoryRenderProps,
  stickStoryRenderPropsSchema,
} from "@studio/video/stick-story/props";
import { readJsonArtifact, writeJsonArtifact } from "../jobs/job-support.js";
import type { Mp4Info, RenderBackend } from "./render-backend.js";
import { runStageJob, type StageJobResult } from "./stage-job.js";
import { checkStill } from "./storyboard-checks.js";

/** Khoảng duration hợp lệ của video, giống giới hạn `durationSec` của brief (30–90 giây). */
export const QA_DURATION_RANGE_MS = { min: 30_000, max: 90_000 } as const;
/** Khoảng trống phụ đề trong cùng một cảnh dài hơn mức này là lỗi (05-VIDEO-PIPELINE mục Alignment). */
export const QA_MAX_CAPTION_GAP_MS = 1_500;
/**
 * Lặng ở đầu hoặc cuối một cảnh dài hơn mức này là warning `long_silence` (P3-16): không chặn duyệt.
 * Mỗi cảnh đã có khoảng đệm khoảng 400 ms (P1-01), nên ngưỡng tính cả phần đệm đó.
 */
export const QA_LONG_SILENCE_MS = 1_200;

type Check = QaReportArtifact["checks"][number];

/** Các check của QA, hàm thuần để test riêng. `props` null nghĩa là render props không đọc được. */
export function runQaChecks(props: StickStoryRenderProps | null, mp4: Mp4Info | null): Check[] {
  const checks: Check[] = [];
  if (props === null) {
    return [
      { code: "schema_invalid", severity: "error", message: "render props thiếu hoặc sai schema" },
    ];
  }
  if (mp4 === null || !mp4.hasAudio || props.audio.durationMs <= 0) {
    checks.push({
      code: "audio_missing",
      severity: "error",
      message: "preview không có luồng audio",
    });
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
    checks.push({
      code: "duration_out_of_range",
      severity: "error",
      message: `tổng ${totalMs} ms`,
    });
  }
  for (const scene of props.scenes) {
    const end = scene.fromMs + scene.durationMs;
    const inScene = props.captions
      .filter((caption) => caption.startMs >= scene.fromMs && caption.startMs < end)
      .sort((a, b) => a.startMs - b.startMs);
    for (let index = 1; index < inScene.length; index += 1) {
      const gap = (inScene[index]?.startMs ?? 0) - (inScene[index - 1]?.endMs ?? 0);
      if (gap > QA_MAX_CAPTION_GAP_MS) {
        checks.push({
          code: "caption_gap",
          severity: "error",
          message: `cảnh ${scene.sceneId}: trống ${gap} ms`,
        });
        break;
      }
    }
    const first = inScene[0];
    const last = inScene.at(-1);
    if (first !== undefined && last !== undefined) {
      const lead = first.startMs - scene.fromMs;
      const tail = end - last.endMs;
      const longest = Math.max(lead, tail);
      if (longest > QA_LONG_SILENCE_MS) {
        checks.push({
          code: "long_silence",
          severity: "warning",
          message: `cảnh ${scene.sceneId}: lặng ${longest} ms ở ${lead >= tail ? "đầu" : "cuối"} cảnh`,
        });
      }
    }
  }
  checks.push(...visualChecks(props));
  return checks;
}

/** Số shot tối đa liệt kê trong một cảnh báo hình, để report gọn. */
const VISUAL_LIST_MAX = 6;

/**
 * QA hình (ADR-020): chạy luật hình học của storyboard (đầu bị mép cắt, mặt dưới phụ đề, hai người chồng nhau)
 * trên mọi shot của bản render, không chỉ một ảnh mỗi cảnh. Chỉ cảnh báo, không chặn duyệt; gộp theo loại.
 */
export function visualChecks(props: StickStoryRenderProps): Check[] {
  const found = new Map<"visual_unsafe_area" | "visual_overlap", string[]>();
  // Props đọc từ file đã qua schema; test truyền props rút gọn, nên thiếu `shots` thì bỏ qua QA hình.
  for (const shot of Array.isArray(props.shots) ? props.shots : []) {
    let issues: ReturnType<typeof checkStill> = [];
    try {
      issues = checkStill({
        background: shot.background,
        shotSize: shot.shotSize,
        camera: shot.camera,
        focus: shot.focus,
        actors: shot.actors.map((a) => ({
          character: a.character,
          skin: a.skin,
          action: a.action,
          expression: a.expression,
          ...(a.outfit === undefined ? {} : { outfit: a.outfit }),
          slot: a.slot,
        })),
        props: shot.props,
        // Phụ đề do composition vẽ và đã có check riêng; ở đây chỉ kiểm hình.
        caption: { speaker: shot.focus, text: "", color: "#ffffff" },
        placeholderAssetIds: [],
      });
    } catch {
      continue;
    }
    for (const issue of issues) {
      const code =
        issue.code === "storyboard_unsafe_area"
          ? "visual_unsafe_area"
          : issue.code === "storyboard_overlap"
            ? "visual_overlap"
            : null;
      if (code !== null) {
        found.set(code, [...(found.get(code) ?? []), `${shot.shotId} (${issue.message})`]);
      }
    }
  }
  return [...found.entries()].map(([code, shots]) => ({
    code,
    severity: "warning" as const,
    message:
      `${shots.length} shot: ${shots.slice(0, VISUAL_LIST_MAX).join("; ")}${shots.length > VISUAL_LIST_MAX ? "; …" : ""}`.slice(
        0,
        500,
      ),
  }));
}

/**
 * Job QA (P3-06, role `qa`, queue `media`): `qa` → `waiting_final_approval`. Kiểm preview mới nhất của run
 * và render props của nó, ghi `qa_report`. Không ghi approval; error trong report chặn duyệt final ở route approval.
 */
export function runQaJob(
  db: StudioDb,
  jobId: string,
  deps: { dataDir: string; backend: RenderBackend },
): Promise<StageJobResult> {
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
        propsRow === null
          ? null
          : await readJsonArtifact(deps.dataDir, propsRow.storageKey, stickStoryRenderPropsSchema);
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
            metadata: {
              idempotencyKey: context.job.idempotencyKey,
              jobId,
              previewArtifactId: preview.id,
              passed: report.passed,
            },
          },
        ],
        parentArtifacts: [[0, preview.id]],
      };
    },
  );
}
