import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  agentRuns,
  artifacts,
  createDbConnection,
  createProject,
  deleteProjectCascadeForTests,
  getWorkflowRunDetail,
  insertBrief,
  jobs,
  listUsageRecordsForRun,
  recordApproval,
  resumeWorkflowRun,
  startWorkflowRun,
} from "@studio/db";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PipelineError } from "../cli/paths.js";
import { writeJsonArtifact } from "../jobs/job-support.js";
import { createGeminiAdapter } from "../llm/gemini-adapter.js";
import { createGeminiResearchAdapter } from "../llm/gemini-research-adapter.js";
import type { StructuredGenerateClient } from "../llm/structured-output.js";
import {
  collectVoiceScenes,
  fakeBackend,
  seedApprovedScript,
  storyFlatJson,
} from "../render/flow-fixtures.js";
import type { StoryboardRenderer } from "../render/storyboard-backend.js";
import type { VoiceScene } from "../cli/media-stage.js";
import type { RenderBackend } from "../render/render-backend.js";
import { type Consumer, createConsumer } from "./consumer.js";
import { redisConnectionFromUrl } from "./queues.js";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

let db: ReturnType<typeof createDbConnection>["db"];
let closeDb: () => Promise<void>;
let dataDir = "";
const createdProjectIds: string[] = [];
const runIds: string[] = [];
const consumers: Consumer[] = [];

const geminiConfig = {
  apiKey: "test-key-not-real",
  modelScript: "fake-model",
  thinkingLevelScript: "low" as const,
};

/** Provider giả ở mức client: adapter Gemini thật parse và validate JSON trả về. Không gọi mạng. */
function fakeClient(outcomes: (string | Error)[]) {
  let calls = 0;
  const client: StructuredGenerateClient = {
    async generateStructured(request) {
      calls += 1;
      const next = outcomes.shift();
      if (next === undefined) {
        throw new Error("fake LLM hết kịch bản");
      }
      if (next instanceof Error) {
        throw next;
      }
      return {
        jsonText: next,
        usage: {
          provider: "gemini",
          model: request.model,
          inputTokens: 10,
          outputTokens: 4,
          thinkingTokens: 0,
        },
      };
    },
  };
  return { client, calls: () => calls };
}

const researchJson = JSON.stringify({ summary: "Redis giữ dữ liệu trong RAM.", facts: [] });
/** Kênh mặc định của DB test chưa cho Đậu nói, nên phương án mẫu để Tí đọc câu của Đậu. */
const scriptJson = storyFlatJson(["Một", "Hai"], { dauSpeaks: false });

/** Ảnh storyboard giả: không mở Chrome (P6-10). */
const fakeStillRenderer: StoryboardRenderer = {
  async renderStill(_props, _frame, outputPath) {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, "png");
  },
};

/** Chỉ đối chiếu job của run do test tạo: không đẩy job thật của DB dev vào Redis. */
async function testScope() {
  const rows = await db.select({ id: jobs.id, agentRunId: jobs.agentRunId }).from(jobs);
  const agents = await db
    .select({ id: agentRuns.id, runId: agentRuns.workflowRunId })
    .from(agentRuns);
  const ours = new Set(
    agents.filter((agent) => runIds.includes(agent.runId)).map((agent) => agent.id),
  );
  return { jobIds: rows.filter((row) => ours.has(row.agentRunId)).map((row) => row.id) };
}

function consumerFor(client: StructuredGenerateClient) {
  const consumer = createConsumer(
    {
      db,
      dataDir,
      client,
      research: {
        createLlm: (metered) =>
          createGeminiResearchAdapter({ config: geminiConfig, client: metered }),
      },
      script: {
        createLlm: (metered) => createGeminiAdapter({ config: geminiConfig, client: metered }),
      },
    },
    {
      queues: ["llm"],
      connection: redisConnectionFromUrl(REDIS_URL),
      prefix: `studio-test-llm-${randomUUID()}`,
      reconcileScope: testScope,
    },
  );
  consumers.push(consumer);
  return consumer;
}

async function startRun(title: string) {
  const project = await createProject(db, title);
  createdProjectIds.push(project.id);
  await insertBrief(db, project.id, {
    topic: "Redis",
    audience: "Dev",
    goal: "Hiểu cache",
    durationSec: 60,
    language: "vi",
    tone: "friendly",
    visualStyle: "edu",
  });
  const started = await startWorkflowRun(db, project.id);
  runIds.push(started.workflowRun.id);
  return started;
}

/** Đối chiếu lặp lại (như vòng 5 s của process worker) cho tới khi run tới trạng thái mong đợi. */
async function driveUntil(consumer: Consumer, runId: string, status: string, timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await consumer.reconcile();
    const current = (await getWorkflowRunDetail(db, runId))?.workflowRun.status;
    if (current === status) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(
    `run ${runId} không tới ${status}: ${(await getWorkflowRunDetail(db, runId))?.workflowRun.status}`,
  );
}

beforeAll(async () => {
  const conn = createDbConnection(DATABASE_URL);
  db = conn.db;
  closeDb = conn.close;
  dataDir = await mkdtemp(join(tmpdir(), "studio-llm-consumer-"));
});

/**
 * Mỗi test đóng consumer của nó: consumer còn sống sẽ đối chiếu cả run của test sau vào prefix Redis riêng
 * và nhận job đó bằng bản giả của test trước.
 */
afterEach(async () => {
  for (const consumer of consumers.splice(0)) {
    await Promise.all(consumer.workers.map((worker) => worker.close()));
    for (const queue of Object.values(consumer.queues)) {
      await queue.obliterate({ force: true }).catch(() => undefined);
    }
    await consumer.close();
  }
});

afterAll(async () => {
  for (const id of createdProjectIds) {
    await deleteProjectCascadeForTests(db, id);
  }
  await closeDb();
  await rm(dataDir, { recursive: true, force: true });
});

describe("consumer queue llm (quyết định 5)", { timeout: 60_000 }, () => {
  it("bắt đầu run → worker chạy research rồi script qua BullMQ → chờ storyboard, không tự duyệt", async () => {
    const fake = fakeClient([researchJson, scriptJson]);
    const consumer = consumerFor(fake.client);
    const started = await startRun("Quyết định 5: luồng llm");
    expect(started.workflowRun.status).toBe("idea_submitted");

    // Script `2` sang `storyboarding`; job storyboard nằm ở queue `render` mà consumer này không chạy.
    await driveUntil(consumer, started.workflowRun.id, "storyboarding");
    const detail = await getWorkflowRunDetail(db, started.workflowRun.id);
    expect(detail?.artifacts.map((artifact) => artifact.type).sort()).toEqual([
      "fetch_log",
      "research",
      "script",
    ]);
    expect(detail?.approvals).toEqual([]);
    expect(detail?.agentRuns.map((agent) => [agent.role, agent.status]).sort()).toEqual([
      ["research", "completed"],
      ["script", "waiting_approval"],
      ["visual", "queued"],
    ]);
    // Hai lần gọi provider (research, script), mỗi lần một hàng usage.
    expect(fake.calls()).toBe(2);
    expect(await listUsageRecordsForRun(db, started.workflowRun.id)).toHaveLength(2);
    // Đối chiếu lại không đẩy job đã xong lần nữa: provider không bị gọi thêm.
    await consumer.reconcile();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(fake.calls()).toBe(2);
  });

  it("lỗi bất ngờ ở cả hai lượt BullMQ: run failed với resume_from researching, không kẹt ở researching", async () => {
    const fake = fakeClient([]);
    const consumer = createConsumer(
      {
        db,
        dataDir,
        client: fake.client,
        research: {
          createLlm: () => ({
            extractResearch: async () => {
              throw new Error("process lỗi giữa chừng");
            },
          }),
        },
      },
      {
        queues: ["llm"],
        connection: redisConnectionFromUrl(REDIS_URL),
        prefix: `studio-test-llm-${randomUUID()}`,
        reconcileScope: testScope,
      },
    );
    consumers.push(consumer);
    const started = await startRun("Quyết định 5: lỗi bất ngờ");
    await driveUntil(consumer, started.workflowRun.id, "failed");
    const detail = await getWorkflowRunDetail(db, started.workflowRun.id);
    expect(detail?.workflowRun).toMatchObject({
      status: "failed",
      resumeFrom: "researching",
      failureCode: "worker_error",
    });
    const research = (await db.select().from(jobs)).find((job) => job.id === started.researchJobId);
    expect(research).toMatchObject({ status: "failed", attempt: 2 });
    expect(fake.calls()).toBe(0);
  });

  it("run có llmModel: research và script gọi đúng model đó, usage ghi model đó (P3-12)", async () => {
    const models: string[] = [];
    const outcomes = [researchJson, scriptJson];
    const client: StructuredGenerateClient = {
      async generateStructured(request) {
        models.push(request.model);
        return {
          jsonText: outcomes.shift() ?? "",
          usage: {
            provider: "gemini",
            model: request.model,
            inputTokens: 1,
            outputTokens: 1,
            thinkingTokens: 0,
          },
        };
      },
    };
    // Không truyền createLlm: đi đúng đường mặc định của worker thật, chỉ client là giả.
    const consumer = createConsumer(
      { db, dataDir, client, gemini: geminiConfig },
      {
        queues: ["llm"],
        connection: redisConnectionFromUrl(REDIS_URL),
        prefix: `studio-test-llm-${randomUUID()}`,
        reconcileScope: testScope,
      },
    );
    consumers.push(consumer);
    const project = await createProject(db, "P3-12: model theo run");
    createdProjectIds.push(project.id);
    await insertBrief(db, project.id, {
      topic: "Redis",
      audience: "Dev",
      goal: "Hiểu cache",
      durationSec: 60,
      language: "vi",
      tone: "friendly",
      visualStyle: "edu",
    });
    const started = await startWorkflowRun(db, project.id, { llmModel: "model-chon-theo-run" });
    runIds.push(started.workflowRun.id);
    expect(started.workflowRun.llmModel).toBe("model-chon-theo-run");
    await driveUntil(consumer, started.workflowRun.id, "storyboarding");
    expect(models).toEqual(["model-chon-theo-run", "model-chon-theo-run"]);
    const usage = await listUsageRecordsForRun(db, started.workflowRun.id);
    expect(usage.map((row) => row.model)).toEqual(["model-chon-theo-run", "model-chon-theo-run"]);
  });

  it("run chọn claude-code:sonnet: research và script đi qua client Claude Code, không gọi Gemini; usage claude-code (P6-15)", async () => {
    const gemini = fakeClient([]);
    const requested: string[] = [];
    const outcomes = [researchJson, scriptJson];
    const claudeCodeClient = (model: string): StructuredGenerateClient => {
      requested.push(model);
      return {
        async generateStructured() {
          return {
            jsonText: outcomes.shift() ?? "",
            usage: {
              provider: "claude-code",
              model: "claude-sonnet-5-5",
              inputTokens: 5,
              outputTokens: 7,
              thinkingTokens: 0,
            },
          };
        },
      };
    };
    const consumer = createConsumer(
      { db, dataDir, client: gemini.client, claudeCodeClient, gemini: geminiConfig },
      {
        queues: ["llm"],
        connection: redisConnectionFromUrl(REDIS_URL),
        prefix: `studio-test-llm-${randomUUID()}`,
        reconcileScope: testScope,
      },
    );
    consumers.push(consumer);
    const project = await createProject(db, "P6-15: Claude Code theo run");
    createdProjectIds.push(project.id);
    await insertBrief(db, project.id, {
      topic: "Redis",
      audience: "Dev",
      goal: "Hiểu cache",
      durationSec: 60,
      language: "vi",
      tone: "friendly",
      visualStyle: "edu",
    });
    const started = await startWorkflowRun(db, project.id, { llmModel: "claude-code:sonnet" });
    runIds.push(started.workflowRun.id);
    await driveUntil(consumer, started.workflowRun.id, "storyboarding");
    expect(requested).toEqual(["claude-code:sonnet", "claude-code:sonnet"]);
    expect(gemini.calls()).toBe(0);
    const usage = await listUsageRecordsForRun(db, started.workflowRun.id);
    expect(usage.map((row) => [row.provider, row.model, Number(row.estimatedCostUsd)])).toEqual([
      ["claude-code", "claude-sonnet-5-5", 0],
      ["claude-code", "claude-sonnet-5-5", 0],
    ]);
  });

  it("run chọn claude-code nhưng worker chưa bật Claude Code: research failed configuration_missing, không kẹt, không gọi Gemini (P6-15)", async () => {
    const gemini = fakeClient([researchJson]);
    const consumer = createConsumer(
      { db, dataDir, client: gemini.client, gemini: geminiConfig },
      {
        queues: ["llm"],
        connection: redisConnectionFromUrl(REDIS_URL),
        prefix: `studio-test-llm-${randomUUID()}`,
        reconcileScope: testScope,
      },
    );
    consumers.push(consumer);
    const project = await createProject(db, "P6-15: chưa bật Claude Code");
    createdProjectIds.push(project.id);
    await insertBrief(db, project.id, {
      topic: "Redis",
      audience: "Dev",
      goal: "Hiểu cache",
      durationSec: 60,
      language: "vi",
      tone: "friendly",
      visualStyle: "edu",
    });
    const started = await startWorkflowRun(db, project.id, { llmModel: "claude-code" });
    runIds.push(started.workflowRun.id);
    await driveUntil(consumer, started.workflowRun.id, "failed");
    expect(gemini.calls()).toBe(0);
    const detail = await getWorkflowRunDetail(db, started.workflowRun.id);
    expect(detail?.workflowRun).toMatchObject({
      status: "failed",
      resumeFrom: "researching",
      failureCode: "configuration_missing",
    });
    expect(detail?.workflowRun.failureMessage).toMatch(/Claude Code/);
    const research = (await db.select().from(jobs)).find((job) => job.id === started.researchJobId);
    expect(research).toMatchObject({ status: "failed", attempt: 1 });
  });

  it("không bắt đầu được khi chưa có brief hoặc run trước còn chạy", async () => {
    const empty = await createProject(db, "Quyết định 5: chưa có brief");
    createdProjectIds.push(empty.id);
    await expect(startWorkflowRun(db, empty.id)).rejects.toMatchObject({ code: "no_brief" });
    const started = await startRun("Quyết định 5: run đang chạy");
    await expect(startWorkflowRun(db, started.workflowRun.projectId)).rejects.toMatchObject({
      code: "run_active",
    });
  });
});

describe("consumer queue media và render (P3-11)", { timeout: 60_000 }, () => {
  /** Ba queue trong một consumer: TTS và backend render đều giả, không ghi `data/` thật. */
  function fullConsumer(backend: RenderBackend, tts = collectVoiceScenes) {
    const consumer = createConsumer(
      {
        db,
        dataDir,
        voice: { collectVoiceScenes: tts },
        storyboard: { renderer: fakeStillRenderer },
        backend,
      },
      {
        queues: ["llm", "media", "render"],
        connection: redisConnectionFromUrl(REDIS_URL),
        prefix: `studio-test-llm-${randomUUID()}`,
        reconcileScope: testScope,
      },
    );
    consumers.push(consumer);
    return consumer;
  }

  async function approvedRun(title: string) {
    const seeded = await seedApprovedScript(db, dataDir, title);
    createdProjectIds.push(seeded.projectId);
    runIds.push(seeded.runId);
    return seeded;
  }

  it("duyệt kịch bản → visual + voice → render preview → QA → duyệt final → export, mọi bước qua BullMQ", async () => {
    let ttsCalls = 0;
    const { backend, renders } = fakeBackend();
    const consumer = fullConsumer(backend, async (scenes: VoiceScene[]) => {
      ttsCalls += 1;
      return collectVoiceScenes(scenes);
    });
    const run = await approvedRun("P3-11: luồng media và render");
    await driveUntil(consumer, run.runId, "waiting_final_approval");
    let detail = await getWorkflowRunDetail(db, run.runId);
    expect(detail?.artifacts.map((artifact) => artifact.type).sort()).toEqual([
      "alignment",
      "audio",
      "preview",
      "qa_report",
      "render_props",
      "script",
    ]);
    expect(renders.map((render) => render.purpose)).toEqual(["preview"]);
    expect(ttsCalls).toBe(1);
    // Chưa có approval final: worker không tự duyệt.
    expect(detail?.approvals.filter((approval) => approval.gate === "final")).toEqual([]);

    const preview = detail?.artifacts.find((artifact) => artifact.type === "preview");
    await recordApproval(db, {
      workflowRunId: run.runId,
      gate: "final",
      decision: "approved",
      artifactId: preview?.id ?? "",
      note: null,
    });
    await driveUntil(consumer, run.runId, "exported");
    detail = await getWorkflowRunDetail(db, run.runId);
    expect(detail?.artifacts.filter((artifact) => artifact.type === "export")).toHaveLength(1);
    expect(renders.map((render) => render.purpose)).toEqual(["preview", "export"]);
    expect(ttsCalls).toBe(1);
    const roles = (await db.select().from(agentRuns))
      .filter((agent) => agent.workflowRunId === run.runId)
      .map((agent) => [agent.role, agent.status]);
    expect(roles.filter(([role]) => role !== "script")).toEqual(
      expect.arrayContaining([
        ["visual", "completed"],
        ["voice", "completed"],
        ["video", "completed"],
        ["qa", "completed"],
      ]),
    );
  });

  it("render lỗi bất ngờ ở cả hai lượt: run failed với resume_from preview_rendering; audio không làm lại", async () => {
    let ttsCalls = 0;
    const { backend } = fakeBackend();
    const crashing: RenderBackend = {
      ...backend,
      async render() {
        throw new Error("ffmpeg chết giữa chừng");
      },
    };
    const consumer = fullConsumer(crashing, async (scenes: VoiceScene[]) => {
      ttsCalls += 1;
      return collectVoiceScenes(scenes);
    });
    const run = await approvedRun("P3-11: render lỗi");
    await driveUntil(consumer, run.runId, "failed");
    const detail = await getWorkflowRunDetail(db, run.runId);
    expect(detail?.workflowRun).toMatchObject({
      status: "failed",
      resumeFrom: "preview_rendering",
      failureCode: "worker_error",
    });
    expect(detail?.artifacts.filter((artifact) => artifact.type === "audio")).toHaveLength(1);
    expect(ttsCalls).toBe(1);
  });

  it("voice lỗi rồi resume: BullMQ chạy lại đúng job cũ (cùng id) và run đi tiếp tới cổng final", async () => {
    let ttsCalls = 0;
    const { backend } = fakeBackend();
    const consumer = fullConsumer(backend, async (scenes: VoiceScene[]) => {
      ttsCalls += 1;
      if (ttsCalls === 1) {
        // Như lần chạy thật 2026-10-31: TTS không trả lời kịp nên job ghi `synthesis_failed`.
        throw new PipelineError("synthesis_failed", "Scene s1: TTS không trả lời sau 300000 ms");
      }
      return collectVoiceScenes(scenes);
    });
    const run = await approvedRun("P3-11: resume voice qua BullMQ");
    await driveUntil(consumer, run.runId, "failed");
    expect((await getWorkflowRunDetail(db, run.runId))?.workflowRun).toMatchObject({
      resumeFrom: "producing_assets",
      failureCode: "synthesis_failed",
    });
    const voiceJob = (await db.select().from(jobs)).find((job) =>
      job.idempotencyKey.startsWith(`voice:${run.runId}`),
    );
    // BullMQ vẫn giữ bản đã kết thúc cùng id: trước bản sửa, đối chiếu bỏ qua và run kẹt ở producing_assets.
    expect(await consumer.queues.media.getJob(voiceJob?.id ?? "")).toBeDefined();

    await resumeWorkflowRun(db, {
      workflowRunId: run.runId,
      transition: { from: "failed", to: "producing_assets" },
    });
    await driveUntil(consumer, run.runId, "waiting_final_approval");
    expect(ttsCalls).toBe(2);
    expect((await db.select().from(jobs)).find((job) => job.id === voiceJob?.id)).toMatchObject({
      status: "completed",
      attempt: 2,
    });
    // Job đã xong không bị đẩy lại ở các vòng đối chiếu sau.
    expect(await consumer.reconcile()).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(ttsCalls).toBe(2);
  });

  it("P3-14: yêu cầu sửa bản cuối → Gemini viết lại kịch bản theo ghi chú → duyệt lại → dựng lại → preview bản 2", async () => {
    const prompts: string[] = [];
    const client: StructuredGenerateClient = {
      async generateStructured(request) {
        prompts.push(request.userPrompt);
        return {
          jsonText: scriptJson,
          usage: {
            provider: "gemini",
            model: request.model,
            inputTokens: 1,
            outputTokens: 1,
            thinkingTokens: 0,
          },
        };
      },
    };
    const { backend, renders } = fakeBackend();
    const consumer = createConsumer(
      {
        db,
        dataDir,
        client,
        script: {
          createLlm: (metered) => createGeminiAdapter({ config: geminiConfig, client: metered }),
        },
        voice: { collectVoiceScenes },
        storyboard: { renderer: fakeStillRenderer },
        backend,
      },
      {
        queues: ["llm", "media", "render"],
        connection: redisConnectionFromUrl(REDIS_URL),
        prefix: `studio-test-llm-${randomUUID()}`,
        reconcileScope: testScope,
      },
    );
    consumers.push(consumer);
    const run = await approvedRun("P3-14: sửa bản cuối");
    // Job script đọc research mới nhất của run (research không chạy lại khi sửa).
    const researchKey = `artifacts/${run.runId}/research-test.json`;
    await db.insert(artifacts).values({
      projectId: run.projectId,
      workflowRunId: run.runId,
      type: "research",
      version: 1,
      schemaVersion: "1",
      contentHash: await writeJsonArtifact(dataDir, researchKey, {
        schemaVersion: 1,
        summary: "Redis giữ dữ liệu trong RAM.",
        facts: [],
        sources: [],
      }),
      storageKey: researchKey,
    });
    await driveUntil(consumer, run.runId, "waiting_final_approval");
    const firstPreview = (await getWorkflowRunDetail(db, run.runId))?.artifacts.find(
      (a) => a.type === "preview",
    );

    await recordApproval(db, {
      workflowRunId: run.runId,
      gate: "final",
      decision: "changes_requested",
      artifactId: firstPreview?.id ?? "",
      note: "Cảnh 2 nói chậm lại, thêm ví dụ thực tế",
    });
    await driveUntil(consumer, run.runId, "waiting_script_approval");
    expect(prompts.at(-1)).toContain("Cảnh 2 nói chậm lại, thêm ví dụ thực tế");
    const scripts =
      (await getWorkflowRunDetail(db, run.runId))?.artifacts.filter((a) => a.type === "script") ??
      [];
    expect(scripts.map((a) => a.version).sort()).toEqual([1, 2]);

    const latestScript = scripts.find((a) => a.version === 2);
    await recordApproval(db, {
      workflowRunId: run.runId,
      gate: "script",
      decision: "approved",
      artifactId: latestScript?.id ?? "",
      variantIndex: 1,
      note: null,
    });
    await driveUntil(consumer, run.runId, "waiting_final_approval");
    const previews =
      (await getWorkflowRunDetail(db, run.runId))?.artifacts.filter((a) => a.type === "preview") ??
      [];
    expect(previews.map((a) => a.version).sort()).toEqual([1, 2]);
    expect(renders.map((r) => r.purpose)).toEqual(["preview", "preview"]);
    // Không tự duyệt bản mới.
    const finals =
      (await getWorkflowRunDetail(db, run.runId))?.approvals.filter((a) => a.gate === "final") ??
      [];
    expect(finals.map((a) => a.decision)).toEqual(["changes_requested"]);
  });
});
