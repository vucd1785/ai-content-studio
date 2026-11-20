import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type AlignResponse, audioManifestArtifactSchema, type ScriptV2 } from "@studio/contracts";
import {
  agentRuns,
  artifacts,
  cancelWorkflowRun,
  createDbConnection,
  createProject,
  deleteProjectCascadeForTests,
  getWorkflowRunDetail,
  insertBrief,
  jobs,
  listEventsForRun,
  recordApproval,
  workflowRuns,
} from "@studio/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SceneMediaArtifacts } from "../cli/build-render-props.js";
import type { MediaStageHooks, VoiceScene } from "../cli/media-stage.js";
import { PipelineError } from "../cli/paths.js";
import { writeJsonArtifact } from "../jobs/job-support.js";
import {
  closeQueues,
  createQueues,
  type QueueSet,
  reconcileQueues,
  redisConnectionFromUrl,
} from "../queue/queues.js";
import { seedVoicedBrand, storyScript } from "../render/flow-fixtures.js";
import { runVisualJob } from "./visual-job.js";
import { runVoiceJob } from "./voice-job.js";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
/** Prefix riêng: không đụng key `bull:*` của queue thật. */
const PREFIX = `studio-test-p3-05-${randomUUID()}`;

let db: ReturnType<typeof createDbConnection>["db"];
let closeDb: () => Promise<void>;
let dataDir = "";
const createdProjectIds: string[] = [];

/** Phương án 2 khác phương án 1 ở câu đầu, để test biết TTS đọc đúng phương án đã duyệt. */
function variants(): [ScriptV2, ScriptV2] {
  const second = storyScript("Hai");
  const firstLine = second.scenes[0]?.lines[0];
  if (firstLine !== undefined) {
    firstLine.text = "Bit ơi, phương án Hai chậm thế?";
  }
  return [storyScript("Một"), second];
}
const SCENE_COUNT = storyScript("Một").scenes.length;
const FIRST_SCENE_ID = storyScript("Một").scenes[0]?.id;

function fakeAlignment(sceneId: string, passes = true): AlignResponse {
  return {
    alignmentArtifactId: "a".repeat(32),
    audioArtifactId: "b".repeat(32),
    durationMs: 2000,
    transcript: sceneId,
    engine: "whisper",
    modelId: "fake",
    words: [{ text: sceneId, startMs: 0, endMs: 1900 }],
    validation: {
      ok: true,
      errors: [],
      warnings: [],
      wordCount: 1,
      alignedWordCount: 1,
      missingWords: [],
      coverageStartMs: 0,
      coverageEndMs: 1900,
      durationDeltaMs: 100,
      nonMonotonicWordRatio: 0,
      timelineOrderRatio: 1,
    },
    gate: {
      alignedWordRatio: 1,
      durationDeltaMs: 100,
      coverageWithin250Ms: true,
      ratioAtLeast90Pct: true,
      validationOk: true,
      passesGate: passes,
      gatePolicyVersion: "test",
      trailingSilenceVerified: false,
      trailingSilenceMs: null,
      coverageAcceptanceReason: passes ? "within_250ms" : null,
    },
    processingMs: 1,
  };
}

/** TTS giả: mỗi cảnh một WAV id giả, duration 2 s; ghi lại các câu nhận được. */
function fakeMedia(options: { passes?: boolean } = {}) {
  const calls: VoiceScene[][] = [];
  const collectVoiceScenes = async (scenes: VoiceScene[]): Promise<SceneMediaArtifacts[]> => {
    calls.push(scenes);
    return scenes.map((scene, index) => ({
      sceneId: scene.sceneId,
      wavArtifactId: `${index}`.padStart(32, "c"),
      measuredDurationMs: 2000,
      alignment: fakeAlignment(scene.sceneId, options.passes ?? true),
    }));
  };
  return { collectVoiceScenes, calls };
}

/** Run đang chờ duyệt script, có artifact hai phương án "Một" và "Hai"; Director duyệt `variantIndex`. */
async function approvedRun(variantIndex: 1 | 2) {
  const project = await createProject(db, "P3-05 test run", {
    brandProfileId: await seedVoicedBrand(db),
  });
  createdProjectIds.push(project.id);
  const brief = await insertBrief(db, project.id, {
    topic: "Redis",
    audience: "Dev",
    goal: "TTL",
    durationSec: 60,
    language: "vi",
    tone: "friendly",
    visualStyle: "edu",
  });
  const [run] = await db
    .insert(workflowRuns)
    .values({ projectId: project.id, briefId: brief.id, status: "waiting_script_approval" })
    .returning();
  if (run === undefined) {
    throw new Error("seed run failed");
  }
  await db
    .insert(agentRuns)
    .values({ workflowRunId: run.id, role: "script", status: "waiting_approval" });
  const key = `artifacts/${run.id}/script-test.json`;
  const contentHash = await writeJsonArtifact(dataDir, key, { variants: variants() });
  const [script] = await db
    .insert(artifacts)
    .values({
      projectId: project.id,
      workflowRunId: run.id,
      type: "script",
      version: 1,
      schemaVersion: "2",
      contentHash,
      storageKey: key,
      metadata: { formatId: "story", formatVersion: 1, creativeMode: "standard" },
    })
    .returning();
  const { approval } = await recordApproval(db, {
    workflowRunId: run.id,
    gate: "script",
    decision: "approved",
    artifactId: script?.id ?? "",
    variantIndex,
    note: null,
  });
  return { runId: run.id, approvalId: approval.id, scriptArtifactId: script?.id ?? "" };
}

async function runJobs(runId: string) {
  const agents = (await db.select().from(agentRuns)).filter((row) => row.workflowRunId === runId);
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  return (await db.select().from(jobs))
    .filter((job) => byId.has(job.agentRunId))
    .map((job) => ({ ...job, role: byId.get(job.agentRunId)?.role }));
}

const jobOf = async (runId: string, role: string) =>
  (await runJobs(runId)).find((job) => job.role === role);

beforeAll(async () => {
  const conn = createDbConnection(DATABASE_URL);
  db = conn.db;
  closeDb = conn.close;
  dataDir = await mkdtemp(join(tmpdir(), "studio-p3-05-"));
});

afterAll(async () => {
  for (const id of createdProjectIds) {
    await deleteProjectCascadeForTests(db, id);
  }
  await closeDb();
  await rm(dataDir, { recursive: true, force: true });
});

describe("visual và voice sau duyệt script (P3-05)", () => {
  it("duyệt script tạo visual (llm) và voice (media) cùng lúc, run sang producing_assets, chưa có render", async () => {
    const seeded = await approvedRun(2);
    const created = await runJobs(seeded.runId);
    expect(
      created.map((job) => [job.role, job.queue, job.status, job.idempotencyKey]).sort(),
    ).toEqual([
      ["visual", "llm", "queued", `visual:${seeded.runId}:approval:${seeded.approvalId}`],
      ["voice", "media", "queued", `voice:${seeded.runId}:approval:${seeded.approvalId}`],
    ]);
    expect((await getWorkflowRunDetail(db, seeded.runId))?.workflowRun.status).toBe(
      "producing_assets",
    );
  });

  it("thiếu audio thì không enqueue render; đủ cả hai thì đúng một job render", async () => {
    const seeded = await approvedRun(2);
    const visual = await runVisualJob(db, (await jobOf(seeded.runId, "visual"))?.id ?? "", {
      dataDir,
    });
    expect(visual.status).toBe("completed");

    // Tiêu chí nghiệm thu: visual xong, voice chưa xong → không có job render.
    expect(await jobOf(seeded.runId, "video")).toBeUndefined();
    expect((await getWorkflowRunDetail(db, seeded.runId))?.workflowRun.status).toBe(
      "producing_assets",
    );

    const media = fakeMedia();
    const voice = await runVoiceJob(db, (await jobOf(seeded.runId, "voice"))?.id ?? "", {
      dataDir,
      ...media,
    });
    expect(voice.status).toBe("completed");
    const render = (await runJobs(seeded.runId)).filter((job) => job.role === "video");
    expect(render.map((job) => [job.queue, job.status, job.idempotencyKey])).toEqual([
      ["render", "queued", `render:${seeded.runId}:approval:${seeded.approvalId}`],
    ]);
    // Visual/voice không tự đổi status run; preview do job render (P3-06) mở.
    const detail = await getWorkflowRunDetail(db, seeded.runId);
    expect(detail?.workflowRun.status).toBe("producing_assets");
    const transitions = (await listEventsForRun(db, seeded.runId)).filter(
      (e) => e.type === "workflow.transition",
    );
    expect(transitions.map((e) => e.payload)).toEqual([
      expect.objectContaining({
        from: "waiting_script_approval",
        to: "producing_assets",
        cause: "approval",
      }),
    ]);
  });

  it("voice xong trước, visual sau: render vẫn đúng một; chạy lại job đã xong không tạo thêm", async () => {
    const seeded = await approvedRun(1);
    const media = fakeMedia();
    const voiceId = (await jobOf(seeded.runId, "voice"))?.id ?? "";
    const visualId = (await jobOf(seeded.runId, "visual"))?.id ?? "";
    expect((await runVoiceJob(db, voiceId, { dataDir, ...media })).status).toBe("completed");
    expect(await jobOf(seeded.runId, "video")).toBeUndefined();
    expect((await runVisualJob(db, visualId, { dataDir })).status).toBe("completed");
    expect((await runVoiceJob(db, voiceId, { dataDir, ...media })).status).toBe("skipped");
    expect((await runVisualJob(db, visualId, { dataDir })).status).toBe("skipped");
    expect((await runJobs(seeded.runId)).filter((job) => job.role === "video")).toHaveLength(1);
    expect(media.calls).toHaveLength(1);
  });

  it("dùng đúng phương án đã duyệt: TTS đọc phương án 2 bằng giọng nhân vật, artifact nối về script", async () => {
    const seeded = await approvedRun(2);
    const media = fakeMedia();
    await runVisualJob(db, (await jobOf(seeded.runId, "visual"))?.id ?? "", { dataDir });
    await runVoiceJob(db, (await jobOf(seeded.runId, "voice"))?.id ?? "", { dataDir, ...media });
    expect(media.calls).toHaveLength(1);
    expect(media.calls[0]?.[0]?.lines[0]).toMatchObject({
      speaker: "ti",
      voiceId: "Hải Đăng",
      text: "Bit ơi, phương án Hai chậm thế?",
    });

    const rows = (await db.select().from(artifacts)).filter(
      (row) => row.workflowRunId === seeded.runId,
    );
    const audioRow = rows.find((row) => row.type === "audio");
    // Visual không tạo artifact: ảnh storyboard đã có từ bước `storyboarding` (P6-17).
    expect(rows.map((row) => row.type).sort()).toEqual(["alignment", "audio", "script"]);
    const manifest = audioManifestArtifactSchema.parse(
      JSON.parse(await readFile(join(dataDir, audioRow?.storageKey ?? ""), "utf8")),
    );
    expect(
      manifest.scenes.map((scene) => scene.measuredDurationMs).every((ms) => ms === 2000),
    ).toBe(true);
    expect(audioRow?.metadata).toMatchObject({ variantIndex: 2, approvalId: seeded.approvalId });
  });

  it("alignment không qua cổng: voice fail, run failed resume producing_assets, không render, visual bỏ qua", async () => {
    const seeded = await approvedRun(1);
    const media = fakeMedia({ passes: false });
    const voice = await runVoiceJob(db, (await jobOf(seeded.runId, "voice"))?.id ?? "", {
      dataDir,
      ...media,
    });
    expect(voice).toEqual({ status: "failed", errorCode: "alignment_gate_failed" });
    const detail = await getWorkflowRunDetail(db, seeded.runId);
    expect(detail?.workflowRun).toMatchObject({
      status: "failed",
      resumeFrom: "producing_assets",
      failureCode: "alignment_gate_failed",
      failureMessage: expect.stringMatching(/\S/),
    });
    // P3-17: run detail trả mã và chi tiết lỗi của agent.
    expect(detail?.agentRuns.find((a) => a.role === "voice")).toMatchObject({
      status: "failed",
      errorCode: "alignment_gate_failed",
      errorMessage: expect.stringMatching(/\S/),
    });
    expect(
      (await runVisualJob(db, (await jobOf(seeded.runId, "visual"))?.id ?? "", { dataDir })).status,
    ).toBe("skipped");
    expect(await jobOf(seeded.runId, "video")).toBeUndefined();
  });
});

describe("hàng đợi Redis (P3-05)", () => {
  let queues: QueueSet;

  beforeAll(() => {
    queues = createQueues(redisConnectionFromUrl(REDIS_URL), PREFIX);
  });

  afterAll(async () => {
    for (const queue of Object.values(queues)) {
      await queue.obliterate({ force: true });
    }
    await closeQueues(queues);
  });

  async function waiting(name: keyof QueueSet) {
    return (await queues[name].getJobs(["waiting", "active", "delayed", "prioritized"])).map(
      (job) => job.data.jobId,
    );
  }

  it("thiếu audio: queue render rỗng sau khi đối chiếu; đủ cả hai: đúng job render vào queue render", async () => {
    const seeded = await approvedRun(1);
    const scope = async () => ({ jobIds: (await runJobs(seeded.runId)).map((job) => job.id) });

    // Đối chiếu ngay sau duyệt: visual vào `llm`, voice vào `media`, `render` chưa có gì.
    await reconcileQueues(db, queues, await scope());
    const visualId = (await jobOf(seeded.runId, "visual"))?.id ?? "";
    const voiceId = (await jobOf(seeded.runId, "voice"))?.id ?? "";
    expect(await waiting("llm")).toContain(visualId);
    expect(await waiting("media")).toContain(voiceId);
    expect(await waiting("render")).toEqual([]);

    await runVisualJob(db, visualId, { dataDir });
    await reconcileQueues(db, queues, await scope());
    expect(await waiting("render")).toEqual([]);

    await runVoiceJob(db, voiceId, { dataDir, ...fakeMedia() });
    await reconcileQueues(db, queues, await scope());
    const renderId = (await jobOf(seeded.runId, "video"))?.id ?? "";
    expect(renderId).not.toBe("");
    expect(await waiting("render")).toEqual([renderId]);
  });
});

describe("tiến độ thật và hủy giữa chừng của voice (P3-17)", () => {
  /** TTS giả đi qua đúng móc của job: hỏi hủy trước mỗi bước, báo tiến độ sau mỗi bước. */
  function steppingMedia(afterFirstScene?: () => Promise<void>) {
    const done: string[] = [];
    const collectVoiceScenes = async (scenes: VoiceScene[], hooks: MediaStageHooks) => {
      const total = scenes.length * 2;
      for (const [index, scene] of scenes.entries()) {
        for (const phase of ["synthesize", "align"] as const) {
          if (await hooks.isCancelled?.()) {
            throw new PipelineError("cancelled", `Director đã hủy trước cảnh ${scene.sceneId}`);
          }
          done.push(`${scene.sceneId}:${phase}`);
          await hooks.onStep?.({
            done: index * 2 + (phase === "synthesize" ? 1 : 2),
            total,
            sceneIndex: index + 1,
            sceneCount: scenes.length,
            phase,
            sceneId: scene.sceneId,
          });
        }
        if (index === 0) {
          await afterFirstScene?.();
        }
      }
      return scenes.map((scene, index) => ({
        sceneId: scene.sceneId,
        wavArtifactId: `${index}`.padStart(32, "c"),
        measuredDurationMs: 2000,
        alignment: fakeAlignment(scene.sceneId),
      }));
    };
    return { collectVoiceScenes, done };
  }

  it("ghi job.progress từ 0 tới hết; run detail chỉ trả tiến độ khi agent đang chạy", async () => {
    const seeded = await approvedRun(1);
    const voiceId = (await jobOf(seeded.runId, "voice"))?.id ?? "";
    let midway: unknown = null;
    const media = steppingMedia(async () => {
      midway = (await getWorkflowRunDetail(db, seeded.runId))?.agentRuns.find(
        (a) => a.role === "voice",
      )?.progress;
    });
    expect((await runVoiceJob(db, voiceId, { dataDir, ...media })).status).toBe("completed");
    const sceneCount = SCENE_COUNT;
    const progress = (await listEventsForRun(db, seeded.runId))
      .filter((event) => event.type === "job.progress")
      .map((event) => (event.payload as { done: number; total: number }).done);
    expect(progress).toEqual(Array.from({ length: sceneCount * 2 + 1 }, (_, i) => i));
    expect(midway).toEqual({
      done: 2,
      total: sceneCount * 2,
      unit: "scene_step",
      sceneIndex: 1,
      sceneCount,
      lineIndex: null,
      lineCount: null,
      phase: "align",
    });
    const voice = (await getWorkflowRunDetail(db, seeded.runId))?.agentRuns.find(
      (a) => a.role === "voice",
    );
    expect(voice?.status).toBe("completed");
  });

  it("Director hủy sau cảnh 1: job dừng trước cảnh 2, không tạo artifact, run giữ cancelled", async () => {
    const seeded = await approvedRun(1);
    const voiceId = (await jobOf(seeded.runId, "voice"))?.id ?? "";
    const media = steppingMedia(async () => {
      await cancelWorkflowRun(db, {
        workflowRunId: seeded.runId,
        transition: { from: "producing_assets", to: "cancelled" },
      });
    });
    const result = await runVoiceJob(db, voiceId, { dataDir, ...media });
    expect(result.status).toBe("failed");
    const firstSceneId = FIRST_SCENE_ID;
    expect(media.done).toEqual([`${firstSceneId}:synthesize`, `${firstSceneId}:align`]);
    const detail = await getWorkflowRunDetail(db, seeded.runId);
    expect(detail?.workflowRun.status).toBe("cancelled");
    expect(detail?.artifacts.filter((row) => row.type === "audio")).toEqual([]);
    expect(detail?.agentRuns.find((a) => a.role === "voice")?.status).toBe("cancelled");
  });
});
