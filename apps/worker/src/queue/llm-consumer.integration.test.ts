import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  agentRuns,
  createDbConnection,
  createProject,
  deleteProjectCascadeForTests,
  getWorkflowRunDetail,
  insertBrief,
  jobs,
  listUsageRecordsForRun,
  startWorkflowRun,
} from "@studio/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGeminiAdapter } from "../llm/gemini-adapter.js";
import { encodeScriptVariantsForGeminiResponse } from "../llm/gemini-diagram-transform.js";
import { createGeminiResearchAdapter } from "../llm/gemini-research-adapter.js";
import type { StructuredGenerateClient } from "../llm/structured-output.js";
import { loadScript } from "../render/flow-fixtures.js";
import { createLlmConsumer, type LlmConsumer } from "./llm-consumer.js";
import { redisConnectionFromUrl } from "./queues.js";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

let db: ReturnType<typeof createDbConnection>["db"];
let closeDb: () => Promise<void>;
let dataDir = "";
const createdProjectIds: string[] = [];
const runIds: string[] = [];
const consumers: LlmConsumer[] = [];

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
const scriptJson = JSON.stringify(
  encodeScriptVariantsForGeminiResponse([loadScript("Một"), loadScript("Hai")]),
);

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
  const consumer = createLlmConsumer(
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
async function driveUntil(
  consumer: LlmConsumer,
  runId: string,
  status: string,
  timeoutMs = 25_000,
) {
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

afterAll(async () => {
  for (const consumer of consumers) {
    for (const queue of Object.values(consumer.queues)) {
      await queue.obliterate({ force: true }).catch(() => undefined);
    }
    await consumer.close();
  }
  for (const id of createdProjectIds) {
    await deleteProjectCascadeForTests(db, id);
  }
  await closeDb();
  await rm(dataDir, { recursive: true, force: true });
});

describe("consumer queue llm (quyết định 5)", { timeout: 60_000 }, () => {
  it("bắt đầu run → worker chạy research rồi script qua BullMQ → dừng ở cổng script, không tự duyệt", async () => {
    const fake = fakeClient([researchJson, scriptJson]);
    const consumer = consumerFor(fake.client);
    const started = await startRun("Quyết định 5: luồng llm");
    expect(started.workflowRun.status).toBe("idea_submitted");

    await driveUntil(consumer, started.workflowRun.id, "waiting_script_approval");
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
    const consumer = createLlmConsumer(
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
