import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { usageListResponseSchema } from "@studio/contracts";
import {
  agentRuns,
  createDbConnection,
  createProject,
  deleteProjectCascadeForTests,
  insertBrief,
  insertUsageRecord,
  usageRecords,
  workflowRuns,
} from "@studio/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

const TEST_PASSWORD = "director-test-password";
const TEST_SECRET = "0123456789abcdef0123456789abcdef0123456789ab";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";

type Db = ReturnType<typeof createDbConnection>["db"];

let db: Db;
let closeDb: () => Promise<void>;
let dataDir = "";
const createdProjectIds: string[] = [];

async function seedRunWithAgent() {
  const project = await createProject(db, "P3-09 test run");
  createdProjectIds.push(project.id);
  const brief = await insertBrief(db, project.id, {
    topic: "Usage",
    audience: "Dev",
    goal: "Đếm token",
    durationSec: 60,
    language: "vi",
    tone: "friendly",
    visualStyle: "edu",
  });
  const [run] = await db
    .insert(workflowRuns)
    .values({ projectId: project.id, briefId: brief.id, status: "researching" })
    .returning();
  if (run === undefined) {
    throw new Error("seed run failed");
  }
  const [agent] = await db
    .insert(agentRuns)
    .values({ workflowRunId: run.id, role: "research", status: "running" })
    .returning();
  if (agent === undefined) {
    throw new Error("seed agent failed");
  }
  return { runId: run.id, agentRunId: agent.id };
}

async function authedApp() {
  const app = await buildApp({
    password: TEST_PASSWORD,
    sessionSecret: TEST_SECRET,
    nowSeconds: 1_700_000_000,
    enableLogger: false,
    projects: { db, dataDir },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/session/login",
    payload: { password: TEST_PASSWORD },
  });
  const setCookie = login.headers["set-cookie"];
  const line = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return { app, cookie: line?.split(";")[0] ?? "" };
}

describe("usage API (P3-09)", () => {
  beforeAll(async () => {
    const conn = createDbConnection(DATABASE_URL);
    db = conn.db;
    closeDb = conn.close;
    dataDir = await mkdtemp(join(tmpdir(), "studio-p3-09-"));
  });

  afterAll(async () => {
    for (const projectId of createdProjectIds) {
      await deleteProjectCascadeForTests(db, projectId);
    }
    await closeDb();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("trả các row đã lưu của đúng run, theo thứ tự ghi", async () => {
    const seeded = await seedRunWithAgent();
    const other = await seedRunWithAgent();
    for (const inputTokens of [100, 140]) {
      await insertUsageRecord(db, {
        workflowRunId: seeded.runId,
        agentRunId: seeded.agentRunId,
        provider: "gemini",
        model: "fake-model",
        inputTokens,
        outputTokens: 20,
        thinkingTokens: 4,
      });
    }
    await insertUsageRecord(db, {
      workflowRunId: other.runId,
      agentRunId: other.agentRunId,
      provider: "gemini",
      model: "fake-model",
      inputTokens: 999,
      outputTokens: 0,
      thinkingTokens: 0,
    });
    const { app, cookie } = await authedApp();
    const response = await app.inject({
      method: "GET",
      url: `/api/workflow-runs/${seeded.runId}/usage`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    const body = usageListResponseSchema.parse(response.json());
    expect(body.usageRecords.map((r) => [r.inputTokens, r.outputTokens, r.thinkingTokens])).toEqual(
      [
        [100, 20, 4],
        [140, 20, 4],
      ],
    );
    for (const record of body.usageRecords) {
      expect(record).toMatchObject({ workflowRunId: seeded.runId, agentRunId: seeded.agentRunId });
      expect(Number(record.estimatedCostUsd)).toBe(0);
    }
    await app.close();
  });

  it("run không có usage trả mảng rỗng; run lạ 404; thiếu session 401; runId sai 400", async () => {
    const seeded = await seedRunWithAgent();
    const { app, cookie } = await authedApp();
    const empty = await app.inject({
      method: "GET",
      url: `/api/workflow-runs/${seeded.runId}/usage`,
      headers: { cookie },
    });
    expect(empty.json()).toEqual({ usageRecords: [] });
    const unknown = await app.inject({
      method: "GET",
      url: `/api/workflow-runs/${randomUUID()}/usage`,
      headers: { cookie },
    });
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json().error.code).toBe("not_found");
    const noSession = await app.inject({
      method: "GET",
      url: `/api/workflow-runs/${seeded.runId}/usage`,
    });
    expect(noSession.statusCode).toBe(401);
    const bad = await app.inject({
      method: "GET",
      url: "/api/workflow-runs/not-a-uuid/usage",
      headers: { cookie },
    });
    expect(bad.statusCode).toBe(400);
    await app.close();
  });

  it("P5-04: GET /api/usage/summary cộng token trong khoảng [from, to), bỏ hàng ngoài khoảng", async () => {
    const seeded = await seedRunWithAgent();
    // Năm 2099 để không lẫn hàng usage của test khác chạy cùng lúc.
    const row = (createdAt: string, inputTokens: number) => ({
      workflowRunId: seeded.runId,
      agentRunId: seeded.agentRunId,
      provider: "gemini",
      model: "fake-model",
      inputTokens,
      outputTokens: 10,
      thinkingTokens: 1,
      createdAt: new Date(createdAt),
    });
    await db
      .insert(usageRecords)
      .values([
        row("2099-03-01T00:30:00+07:00", 100),
        row("2099-03-31T23:59:00+07:00", 200),
        row("2099-04-01T00:00:00+07:00", 999),
        row("2099-02-28T23:59:00+07:00", 999),
      ]);
    const { app, cookie } = await authedApp();
    const from = encodeURIComponent("2099-03-01T00:00:00+07:00");
    const to = encodeURIComponent("2099-04-01T00:00:00+07:00");
    const response = await app.inject({
      method: "GET",
      url: `/api/usage/summary?from=${from}&to=${to}`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      calls: 2,
      inputTokens: 300,
      outputTokens: 20,
      thinkingTokens: 2,
    });

    const reversed = await app.inject({
      method: "GET",
      url: `/api/usage/summary?from=${to}&to=${from}`,
      headers: { cookie },
    });
    expect(reversed.statusCode).toBe(400);
    const missing = await app.inject({
      method: "GET",
      url: "/api/usage/summary",
      headers: { cookie },
    });
    expect(missing.statusCode).toBe(400);
    const anonymous = await app.inject({
      method: "GET",
      url: `/api/usage/summary?from=${from}&to=${to}`,
    });
    expect(anonymous.statusCode).toBe(401);
    await app.close();
  });
});
