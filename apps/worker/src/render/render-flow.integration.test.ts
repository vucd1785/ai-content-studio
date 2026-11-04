import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { qaReportArtifactSchema } from "@studio/contracts";
import {
  ApprovalError,
  artifacts,
  assertExportAllowed,
  createDbConnection,
  deleteProjectCascadeForTests,
  ExportNotAllowedError,
  getWorkflowRunDetail,
  recordApproval,
} from "@studio/db";
import type { StickStoryRenderProps } from "@studio/video/stick-story/props";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runVisualJob } from "../assets/visual-job.js";
import { runVoiceJob } from "../assets/voice-job.js";
import { runExportJob } from "./export-job.js";
import * as fixtures from "./flow-fixtures.js";
import { collectVoiceScenes, FLOW_TEST_OPTIONS, fakeBackend } from "./flow-fixtures.js";
import { runQaChecks, runQaJob } from "./qa-job.js";
import type { Mp4Info, RenderBackend } from "./render-backend.js";
import { runRenderJob } from "./render-job.js";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";

let db: ReturnType<typeof createDbConnection>["db"];
let closeDb: () => Promise<void>;
let dataDir = "";
const createdProjectIds: string[] = [];

async function seedApprovedScript() {
  const seeded = await fixtures.seedApprovedScript(db, dataDir, "P3-06 test run");
  createdProjectIds.push(seeded.projectId);
  return seeded;
}

const jobByKeyPrefix = (runId: string, prefix: string) =>
  fixtures.jobByKeyPrefix(db, runId, prefix);
const runArtifacts = (runId: string) => fixtures.runArtifacts(db, runId);

/** Tới `waiting_final_approval`: visual + voice, render preview, QA. */
async function toFinalGate(backend: RenderBackend) {
  const seeded = await seedApprovedScript();
  await runVisualJob(db, (await jobByKeyPrefix(seeded.runId, "visual:"))?.id ?? "", { dataDir });
  await runVoiceJob(db, (await jobByKeyPrefix(seeded.runId, "voice:"))?.id ?? "", {
    dataDir,
    collectVoiceScenes,
  });
  const render = await runRenderJob(db, (await jobByKeyPrefix(seeded.runId, "render:"))?.id ?? "", {
    dataDir,
    backend,
  });
  expect(render.status).toBe("completed");
  const qa = await runQaJob(db, (await jobByKeyPrefix(seeded.runId, "qa:"))?.id ?? "", {
    dataDir,
    backend,
  });
  expect(qa.status).toBe("completed");
  const preview = (await runArtifacts(seeded.runId)).find((row) => row.type === "preview");
  return { ...seeded, previewId: preview?.id ?? "" };
}

beforeAll(async () => {
  const conn = createDbConnection(DATABASE_URL);
  db = conn.db;
  closeDb = conn.close;
  dataDir = await mkdtemp(join(tmpdir(), "studio-p3-06-"));
});

afterAll(async () => {
  for (const id of createdProjectIds) {
    await deleteProjectCascadeForTests(db, id);
  }
  await closeDb();
  await rm(dataDir, { recursive: true, force: true });
});

describe("preview, QA, export (P3-06)", FLOW_TEST_OPTIONS, () => {
  it("render → qa → chờ duyệt final → export đúng preview đã duyệt → exported", async () => {
    const { backend, renders } = fakeBackend();
    const run = await toFinalGate(backend);
    let detail = await getWorkflowRunDetail(db, run.runId);
    expect(detail?.workflowRun.status).toBe("waiting_final_approval");
    const rows = await runArtifacts(run.runId);
    expect(rows.map((row) => row.type).sort()).toEqual([
      "alignment",
      "audio",
      "preview",
      "qa_report",
      "render_props",
      "script",
    ]);
    const qaRow = rows.find((row) => row.type === "qa_report");
    const report = qaReportArtifactSchema.parse(
      JSON.parse(await readFile(join(dataDir, qaRow?.storageKey ?? ""), "utf8")),
    );
    expect(report).toEqual({
      schemaVersion: 1,
      previewArtifactId: run.previewId,
      passed: true,
      checks: [],
    });
    // Preview `StickStory` dựng từ phương án 2 đã duyệt: 5 cảnh, shot ba người ở góc cao, phụ đề theo người nói.
    expect(renders.map((r) => r.purpose)).toEqual(["preview"]);
    const props = renders[0]?.props;
    expect(props?.templateId).toBe("StickStory");
    expect(props?.scenes.map((scene) => scene.sceneId)).toEqual([
      "mo-dau",
      "van-de",
      "dien-giai",
      "su-that",
      "chot",
    ]);
    expect(props?.shots.find((shot) => shot.shotId === "s4")?.actors).toHaveLength(3);
    expect(new Set(props?.captions.map((c) => c.speaker))).toEqual(new Set(["ti", "bit", "dau"]));
    const total = props?.scenes.reduce((sum, scene) => sum + scene.durationMs, 0) ?? 0;
    expect(total).toBeGreaterThanOrEqual(30_000);
    expect(total).toBeLessThanOrEqual(90_000);

    await recordApproval(db, {
      workflowRunId: run.runId,
      gate: "final",
      decision: "approved",
      artifactId: run.previewId,
      note: null,
    });
    expect((await getWorkflowRunDetail(db, run.runId))?.workflowRun.status).toBe("exporting");
    const exportJob = await jobByKeyPrefix(run.runId, "export:");
    expect(exportJob).toMatchObject({ role: "video", queue: "render", status: "queued" });

    const exported = await runExportJob(db, exportJob?.id ?? "", { dataDir, backend });
    expect(exported.status).toBe("completed");
    detail = await getWorkflowRunDetail(db, run.runId);
    expect(detail?.workflowRun.status).toBe("exported");
    const exportRow = (await runArtifacts(run.runId)).find((row) => row.type === "export");
    expect(exportRow?.metadata).toMatchObject({
      previewArtifactId: run.previewId,
      purpose: "export",
    });
    // Export render lại đúng props của preview (cùng object, cùng audio), CRF export.
    expect(renders.map((r) => r.purpose)).toEqual(["preview", "export"]);
    expect(renders[1]?.props).toEqual(renders[0]?.props);
    expect(renders[1]?.audioSha).toBe(renders[0]?.audioSha);
  });

  it("approval của preview A không export được preview B", async () => {
    const { backend, renders } = fakeBackend();
    const run = await toFinalGate(backend);
    const previewA = run.previewId;
    // Preview B mới hơn trong cùng run, có QA đạt riêng.
    const [previewB] = await db
      .insert(artifacts)
      .values({
        projectId: run.projectId,
        workflowRunId: run.runId,
        type: "preview",
        version: 2,
        schemaVersion: "1",
        contentHash: "hB",
        storageKey: "render/cache/StickStory/preview-b.mp4",
      })
      .returning();
    const previewBId = previewB?.id ?? "";

    await recordApproval(db, {
      workflowRunId: run.runId,
      gate: "final",
      decision: "approved",
      artifactId: previewA,
      note: null,
    });
    await expect(assertExportAllowed(db, run.runId, previewBId)).rejects.toBeInstanceOf(
      ExportNotAllowedError,
    );
    await expect(assertExportAllowed(db, run.runId, previewBId)).rejects.toMatchObject({
      code: "approval_required",
    });
    await expect(assertExportAllowed(db, run.runId, previewA)).resolves.toMatchObject({
      artifactId: previewA,
    });

    // Job export của approval A xuất A, dù B mới hơn.
    expect(
      (
        await runExportJob(db, (await jobByKeyPrefix(run.runId, "export:"))?.id ?? "", {
          dataDir,
          backend,
        })
      ).status,
    ).toBe("completed");
    const exportRow = (await runArtifacts(run.runId)).find((row) => row.type === "export");
    expect(exportRow?.metadata).toMatchObject({ previewArtifactId: previewA });
    expect(renders.filter((r) => r.purpose === "export")).toHaveLength(1);
  });

  it("QA có error: report passed false, duyệt final bị chặn, không có job export", async () => {
    const { backend } = fakeBackend({
      width: 720,
      height: 1280,
      hasVideo: true,
      hasAudio: true,
      durationMs: 37000,
    });
    const run = await toFinalGate(backend);
    expect((await getWorkflowRunDetail(db, run.runId))?.workflowRun.status).toBe(
      "waiting_final_approval",
    );
    const qaRow = (await runArtifacts(run.runId)).find((row) => row.type === "qa_report");
    expect(qaRow?.metadata).toMatchObject({ passed: false, previewArtifactId: run.previewId });
    const report = qaReportArtifactSchema.parse(
      JSON.parse(await readFile(join(dataDir, qaRow?.storageKey ?? ""), "utf8")),
    );
    expect(report.checks.map((check) => check.code)).toEqual(["frame_size_mismatch"]);

    const attempt = recordApproval(db, {
      workflowRunId: run.runId,
      gate: "final",
      decision: "approved",
      artifactId: run.previewId,
      note: null,
    });
    await expect(attempt).rejects.toBeInstanceOf(ApprovalError);
    await expect(
      recordApproval(db, {
        workflowRunId: run.runId,
        gate: "final",
        decision: "approved",
        artifactId: run.previewId,
        note: null,
      }),
    ).rejects.toMatchObject({ code: "qa_not_passed" });
    expect(await jobByKeyPrefix(run.runId, "export:")).toBeUndefined();
    expect(
      (await getWorkflowRunDetail(db, run.runId))?.approvals.filter((a) => a.gate === "final"),
    ).toEqual([]);
  });

  it("render thiếu alignment: failed audio_missing, resume_from preview_rendering, không render", async () => {
    const { backend, renders } = fakeBackend();
    const seeded = await seedApprovedScript();
    await runVisualJob(db, (await jobByKeyPrefix(seeded.runId, "visual:"))?.id ?? "", { dataDir });
    await runVoiceJob(db, (await jobByKeyPrefix(seeded.runId, "voice:"))?.id ?? "", {
      dataDir,
      collectVoiceScenes,
    });
    // Xóa hàng alignment để mô phỏng artifact thiếu (chỉ hàng của run test này).
    const alignmentRow = (await runArtifacts(seeded.runId)).find((row) => row.type === "alignment");
    await rm(join(dataDir, alignmentRow?.storageKey ?? "missing"), { force: true });
    const result = await runRenderJob(
      db,
      (await jobByKeyPrefix(seeded.runId, "render:"))?.id ?? "",
      { dataDir, backend },
    );
    expect(result).toEqual({ status: "failed", errorCode: "audio_missing" });
    expect((await getWorkflowRunDetail(db, seeded.runId))?.workflowRun).toMatchObject({
      status: "failed",
      resumeFrom: "preview_rendering",
    });
    expect(renders).toEqual([]);
  });
});

describe("runQaChecks", () => {
  const base = (): StickStoryRenderProps => {
    const scenes = Array.from({ length: 5 }, (_, i) => ({
      sceneId: `s${i}`,
      fromMs: i * 8000,
      durationMs: 8000,
    }));
    return {
      templateId: "StickStory",
      templateVersion: "1.1.0+kit.0.2.0",
      fps: 30,
      width: 1080,
      height: 1920,
      audio: { storageKey: "a.wav", durationMs: 40000 },
      scenes,
      captions: [],
    } as unknown as StickStoryRenderProps;
  };
  const ok: Mp4Info = {
    width: 1080,
    height: 1920,
    hasVideo: true,
    hasAudio: true,
    durationMs: 40000,
  };

  it("props hợp lệ, preview đúng khung: không check nào", () => {
    expect(runQaChecks(base(), ok)).toEqual([]);
  });

  it("thiếu props, thiếu audio, sai duration, khoảng trống phụ đề > 1,5 s", () => {
    expect(runQaChecks(null, ok).map((c) => c.code)).toEqual(["schema_invalid"]);
    expect(runQaChecks(base(), { ...ok, hasAudio: false }).map((c) => c.code)).toEqual([
      "audio_missing",
    ]);
    const short = { ...base(), scenes: base().scenes.slice(0, 3) };
    expect(runQaChecks(short, ok).map((c) => c.code)).toEqual(["duration_out_of_range"]);
    const gap = {
      ...base(),
      captions: [
        { text: "a", startMs: 0, endMs: 500, timestampMs: 250, confidence: null },
        { text: " b", startMs: 2100, endMs: 2500, timestampMs: 2300, confidence: null },
      ],
    } as unknown as StickStoryRenderProps;
    expect(
      runQaChecks(gap, ok)
        .filter((c) => c.severity === "error")
        .map((c) => c.code),
    ).toEqual(["caption_gap"]);
  });

  it("P3-16: lặng dài ở đầu hoặc cuối cảnh là warning long_silence, không chặn duyệt", () => {
    // Mỗi cảnh 8 s có lời đều từ 100 ms tới 7 s: không có lặng dài.
    const spoken = (scene: number, fromOffset: number, toOffset: number) =>
      Array.from({ length: Math.floor((toOffset - fromOffset) / 600) }, (_, i) => ({
        text: " x",
        startMs: scene * 8000 + fromOffset + i * 600,
        endMs: scene * 8000 + fromOffset + i * 600 + 500,
        timestampMs: scene * 8000 + fromOffset + i * 600 + 250,
        confidence: null,
      }));
    const even = Array.from({ length: 5 }, (_, scene) => spoken(scene, 100, 7700)).flat();
    const evenProps = { ...base(), captions: even } as unknown as StickStoryRenderProps;
    expect(runQaChecks(evenProps, ok)).toEqual([]);

    // Cảnh s2 chỉ có lời trong 3 s đầu: lặng gần 5 s ở cuối cảnh.
    const quietTail = [
      ...spoken(0, 100, 7700),
      ...spoken(1, 100, 7700),
      ...spoken(2, 100, 3100),
      ...spoken(3, 100, 7700),
      ...spoken(4, 100, 7700),
    ];
    const checks = runQaChecks(
      { ...base(), captions: quietTail } as unknown as StickStoryRenderProps,
      ok,
    );
    expect(checks.map((c) => [c.code, c.severity])).toEqual([["long_silence", "warning"]]);
    expect(checks[0]?.message).toContain("s2");
    expect(checks[0]?.message).toContain("cuối");
    // Warning không làm report fail.
    expect(checks.some((c) => c.severity === "error")).toBe(false);
  });
});
