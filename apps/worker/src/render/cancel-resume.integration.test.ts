import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Script } from "@studio/contracts";
import {
  cancelWorkflowRun,
  createDbConnection,
  deleteProjectCascadeForTests,
  findParentArtifact,
  getWorkflowRunDetail,
  JobStateError,
  listEventsForRun,
  recordApproval,
  resumeWorkflowRun,
} from "@studio/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AssetJobError } from "../assets/asset-job.js";
import { runVisualJob } from "../assets/visual-job.js";
import { runVoiceJob } from "../assets/voice-job.js";
import * as fixtures from "./flow-fixtures.js";
import { collectMedia, FLOW_TEST_OPTIONS, fakeBackend } from "./flow-fixtures.js";
import { runQaJob } from "./qa-job.js";
import type { RenderBackend } from "./render-backend.js";
import { runRenderJob } from "./render-job.js";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";

let db: ReturnType<typeof createDbConnection>["db"];
let closeDb: () => Promise<void>;
let dataDir = "";
const createdProjectIds: string[] = [];

async function seedApprovedScript() {
  const seeded = await fixtures.seedApprovedScript(db, dataDir, "P3-08 test run");
  createdProjectIds.push(seeded.projectId);
  return seeded;
}

const jobByKeyPrefix = (runId: string, prefix: string) => fixtures.jobByKeyPrefix(db, runId, prefix);
const runArtifacts = (runId: string) => fixtures.runArtifacts(db, runId);
const runStatus = async (runId: string) => (await getWorkflowRunDetail(db, runId))?.workflowRun;

/** Đếm số lần "gọi TTS": voice chỉ tạo audio qua `collectMedia`. */
function countingCollectMedia() {
  const calls: string[] = [];
  return {
    calls,
    collect: async (script: Script) => {
      calls.push(script.title);
      return collectMedia(script);
    },
  };
}

/** Visual + voice xong, job render đang chờ. */
async function assetsDone(collect: (script: Script) => ReturnType<typeof collectMedia>) {
  const seeded = await seedApprovedScript();
  await runVisualJob(db, (await jobByKeyPrefix(seeded.runId, "visual:"))?.id ?? "", { dataDir });
  await runVoiceJob(db, (await jobByKeyPrefix(seeded.runId, "voice:"))?.id ?? "", { dataDir, collectMedia: collect });
  const renderJob = await jobByKeyPrefix(seeded.runId, "render:");
  expect(renderJob?.status).toBe("queued");
  return { ...seeded, renderJobId: renderJob?.id ?? "" };
}

beforeAll(async () => {
  const conn = createDbConnection(DATABASE_URL);
  db = conn.db;
  closeDb = conn.close;
  dataDir = await mkdtemp(join(tmpdir(), "studio-p3-08-"));
});

afterAll(async () => {
  for (const id of createdProjectIds) {
    await deleteProjectCascadeForTests(db, id);
  }
  await closeDb();
  await rm(dataDir, { recursive: true, force: true });
});

describe("hủy và resume (P3-08)", FLOW_TEST_OPTIONS, () => {
  it("kill giả lập sau audio rồi resume: render chạy lại, không tạo audio mới", async () => {
    const tts = countingCollectMedia();
    const run = await assetsDone(tts.collect);
    const audioBefore = (await runArtifacts(run.runId)).filter((row) => row.type === "audio" || row.type === "alignment");
    expect(audioBefore.map((row) => row.type).sort()).toEqual(["alignment", "audio"]);
    expect(tts.calls).toHaveLength(1);

    // Kill giả lập: process render chết giữa chừng, sau khi audio đã có.
    const { backend: healthy, renders } = fakeBackend();
    const killed: RenderBackend = {
      ...healthy,
      async render() {
        throw new AssetJobError("render_interrupted", "render process killed");
      },
    };
    expect(await runRenderJob(db, run.renderJobId, { dataDir, backend: killed })).toEqual({
      status: "failed",
      errorCode: "render_interrupted",
    });
    expect(await runStatus(run.runId)).toMatchObject({ status: "failed", resumeFrom: "preview_rendering" });

    const resumed = await resumeWorkflowRun(db, {
      workflowRunId: run.runId,
      transition: { from: "failed", to: "preview_rendering" },
    });
    expect(resumed.requeuedJobIds).toEqual([run.renderJobId]);
    expect(await runStatus(run.runId)).toMatchObject({ status: "preview_rendering", resumeFrom: null, failureCode: null });

    // Voice đã xong: nhận lại job (ví dụ Redis giao lại) cũng bỏ qua, không gọi TTS.
    const voiceJob = await jobByKeyPrefix(run.runId, "voice:");
    expect(await runVoiceJob(db, voiceJob?.id ?? "", { dataDir, collectMedia: tts.collect })).toEqual({
      status: "skipped",
      reason: "job_completed",
    });

    expect((await runRenderJob(db, run.renderJobId, { dataDir, backend: healthy })).status).toBe("completed");
    expect((await runQaJob(db, (await jobByKeyPrefix(run.runId, "qa:"))?.id ?? "", { dataDir, backend: healthy })).status).toBe(
      "completed",
    );
    expect((await runStatus(run.runId))?.status).toBe("waiting_final_approval");

    // Không có audio mới: vẫn đúng hai hàng cũ, TTS chỉ gọi một lần, chỉ một job voice.
    const audioAfter = (await runArtifacts(run.runId)).filter((row) => row.type === "audio" || row.type === "alignment");
    expect(audioAfter.map((row) => row.id).sort()).toEqual(audioBefore.map((row) => row.id).sort());
    expect(tts.calls).toHaveLength(1);
    const jobs = await fixtures.runJobs(db, run.runId);
    expect(jobs.filter((job) => job.role === "voice")).toHaveLength(1);
    expect(jobs.map((job) => job.idempotencyKey.split(":")[0]).sort()).toEqual(["qa", "render", "visual", "voice"]);
    // Render chạy lại cùng job (attempt 2) và preview dựng từ audio cũ.
    expect(jobs.find((job) => job.id === run.renderJobId)).toMatchObject({ status: "completed", attempt: 2 });
    const propsRow = (await runArtifacts(run.runId)).find((row) => row.type === "render_props");
    const audioRow = audioBefore.find((row) => row.type === "audio");
    expect((await findParentArtifact(db, propsRow?.id ?? "", "audio"))?.id).toBe(audioRow?.id);
    expect(renders.map((r) => r.purpose)).toEqual(["preview"]);
  });

  it("cancel không ghi approval: job đang chờ bị hủy, worker không chạy được nữa", async () => {
    const run = await assetsDone(collectMedia);
    const cancelled = await cancelWorkflowRun(db, {
      workflowRunId: run.runId,
      transition: { from: "producing_assets", to: "cancelled" },
    });
    expect(cancelled.workflowRun.status).toBe("cancelled");
    const { backend, renders } = fakeBackend();
    expect(await runRenderJob(db, run.renderJobId, { dataDir, backend })).toEqual({
      status: "skipped",
      reason: "job_cancelled",
    });
    expect(renders).toEqual([]);
    const detail = await getWorkflowRunDetail(db, run.runId);
    // Approval duy nhất là lượt duyệt script trước khi hủy; hủy không thêm hàng nào.
    expect(detail?.approvals.map((approval) => approval.gate)).toEqual(["script"]);
    const events = await listEventsForRun(db, run.runId);
    expect(events.filter((event) => event.type === "approval.recorded")).toHaveLength(1);
    expect(events.at(-2)?.payload).toEqual({ from: "producing_assets", to: "cancelled", cause: "cancel" });
    expect(events.at(-1)?.payload).toEqual({ role: "video", status: "cancelled" });
    // Không resume được run đã hủy.
    await expect(
      resumeWorkflowRun(db, { workflowRunId: run.runId, transition: { from: "failed", to: "preview_rendering" } }),
    ).rejects.toMatchObject({ code: "invalid_transition" });
  });

  it("cancel giữa lúc render: kết quả đến muộn bị từ chối, không có preview", async () => {
    const run = await assetsDone(collectMedia);
    const { backend: healthy } = fakeBackend();
    const racing: RenderBackend = {
      ...healthy,
      async render(purpose, props, audioSha) {
        await cancelWorkflowRun(db, {
          workflowRunId: run.runId,
          transition: { from: "preview_rendering", to: "cancelled" },
        });
        return healthy.render(purpose, props, audioSha);
      },
    };
    await expect(runRenderJob(db, run.renderJobId, { dataDir, backend: racing })).rejects.toBeInstanceOf(JobStateError);
    expect((await runStatus(run.runId))?.status).toBe("cancelled");
    const types = (await runArtifacts(run.runId)).map((row) => row.type);
    expect(types).not.toContain("preview");
    expect(types).not.toContain("render_props");
    expect((await jobByKeyPrefix(run.runId, "render:"))?.status).toBe("cancelled");
  });

  it("cancel ở cổng final không ghi approval final, và sau đó không duyệt được", async () => {
    const run = await assetsDone(collectMedia);
    const { backend } = fakeBackend();
    await runRenderJob(db, run.renderJobId, { dataDir, backend });
    await runQaJob(db, (await jobByKeyPrefix(run.runId, "qa:"))?.id ?? "", { dataDir, backend });
    expect((await runStatus(run.runId))?.status).toBe("waiting_final_approval");
    await cancelWorkflowRun(db, {
      workflowRunId: run.runId,
      transition: { from: "waiting_final_approval", to: "cancelled" },
    });
    const preview = (await runArtifacts(run.runId)).find((row) => row.type === "preview");
    await expect(
      recordApproval(db, { workflowRunId: run.runId, gate: "final", decision: "approved", artifactId: preview?.id ?? "", note: null }),
    ).rejects.toMatchObject({ code: "invalid_transition" });
    expect((await getWorkflowRunDetail(db, run.runId))?.approvals.filter((a) => a.gate === "final")).toEqual([]);
    expect(await jobByKeyPrefix(run.runId, "export:")).toBeUndefined();
  });
});
