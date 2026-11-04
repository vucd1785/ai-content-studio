import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchLogSchema, researchSchema } from "@studio/contracts";
import {
  agentRuns,
  createDbConnection,
  createProject,
  deleteProjectCascadeForTests,
  getJobById,
  getWorkflowRunDetail,
  insertBrief,
  insertReferenceFile,
  insertReferenceUrl,
  jobs,
  listEventsForRun,
  listUsageRecordsForRun,
  workflowRuns,
} from "@studio/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LlmError } from "../llm/errors.js";
import {
  createGeminiResearchAdapter,
  type ResearchExtractionInput,
  type ResearchLlm,
} from "../llm/gemini-research-adapter.js";
import type { ResearchExtraction } from "../llm/research-prompt.js";
import type { StructuredGenerateClient } from "../llm/structured-output.js";
import { runResearchJob } from "./research-job.js";
import { isPublicAddress, safeFetch } from "./safe-fetch.js";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";

type Db = ReturnType<typeof createDbConnection>["db"];

let db: Db;
let closeDb: () => Promise<void>;
let dataDir = "";
let server: Server;
let port = 0;
const createdProjectIds: string[] = [];

const testGeminiConfig = {
  apiKey: "test-key-not-real",
  modelScript: "fake-model",
  thinkingLevelScript: "low" as const,
};

/**
 * Provider giả ở mức client: adapter Gemini research thật (parse, Zod, repair) chạy trên JSON kịch bản.
 * `calls` ghi input mỗi lần job gọi adapter; `providerCalls` đếm lần client bị gọi.
 */
function fakeLlm(outcomes: (ResearchExtraction | Error | string)[]) {
  const calls: ResearchExtractionInput[] = [];
  let providerCalls = 0;
  const client: StructuredGenerateClient = {
    async generateStructured(request) {
      providerCalls += 1;
      const next = outcomes.shift();
      if (next === undefined) {
        throw new Error("fake LLM hết kịch bản");
      }
      if (next instanceof Error) {
        throw next;
      }
      return {
        jsonText: typeof next === "string" ? next : JSON.stringify(next),
        usage: {
          provider: "gemini",
          model: request.model,
          inputTokens: 12,
          outputTokens: 3,
          thinkingTokens: 1,
        },
      };
    },
  };
  const createLlm = (metered: StructuredGenerateClient): ResearchLlm => {
    const adapter = createGeminiResearchAdapter({ config: testGeminiConfig, client: metered });
    return {
      extractResearch(input) {
        calls.push(input);
        return adapter.extractResearch(input);
      },
    };
  };
  return { deps: { client, createLlm }, calls, providerCalls: () => providerCalls };
}

/** safeFetch thật với resolver giả: `docs.test` → server giả 127.0.0.1; mọi dải chặn khác giữ nguyên. */
function testFetch(url: string, allowedHosts: ReadonlySet<string>) {
  return safeFetch(url, {
    allowedHosts,
    resolver: async (hostname) => {
      if (hostname === "docs.test") {
        return [{ address: "127.0.0.1", family: 4 }];
      }
      throw new Error("ENOTFOUND");
    },
    isAddressAllowed: (address) => address === "127.0.0.1" || isPublicAddress(address),
  });
}

type RunStatus = (typeof workflowRuns.$inferSelect)["status"];

async function seedResearchJob(options: { withReferences?: boolean; status?: RunStatus } = {}) {
  const project = await createProject(db, "P3-03 test run");
  createdProjectIds.push(project.id);
  const brief = await insertBrief(db, project.id, {
    topic: "Redis cache",
    audience: "Dev",
    goal: "Hiểu TTL",
    durationSec: 60,
    language: "vi",
    tone: "friendly",
    visualStyle: "edu",
    notes: "Nhấn mạnh TTL",
  });
  let uploadKey: string | null = null;
  if (options.withReferences !== false) {
    const key = `uploads/${randomUUID()}.md`;
    uploadKey = key;
    await writeFile(join(dataDir, key), "# Ghi chú\nTTL mặc định là vô hạn.", "utf8");
    await insertReferenceFile(db, {
      projectId: project.id,
      storageKey: key,
      title: "ghi-chu.md",
      mediaType: "text/markdown",
      byteSize: 10,
      contentHash: "b".repeat(64),
    });
    await insertReferenceUrl(db, {
      projectId: project.id,
      url: `http://docs.test:${port}/redis`,
      title: "Redis docs",
    });
    await insertReferenceUrl(db, {
      projectId: project.id,
      url: "http://169.254.169.254/latest/meta-data/",
      title: null,
    });
  }
  const seeded = await seedRunJob(project.id, brief.id, options.status ?? "idea_submitted");
  return { projectId: project.id, briefId: brief.id, uploadKey, ...seeded };
}

/** Thêm một run + agent research + job vào project có sẵn (P5-01 cần hai run cùng project). */
async function seedRunJob(
  projectId: string,
  briefId: string,
  status: RunStatus = "idea_submitted",
) {
  const [run] = await db.insert(workflowRuns).values({ projectId, briefId, status }).returning();
  if (run === undefined) {
    throw new Error("seed run failed");
  }
  const [agent] = await db
    .insert(agentRuns)
    .values({ workflowRunId: run.id, role: "research", status: "queued" })
    .returning();
  if (agent === undefined) {
    throw new Error("seed agent failed");
  }
  const [job] = await db
    .insert(jobs)
    .values({
      agentRunId: agent.id,
      queue: "llm",
      idempotencyKey: `test-p3-03-${randomUUID()}`,
      status: "queued",
    })
    .returning();
  if (job === undefined) {
    throw new Error("seed job failed");
  }
  return { runId: run.id, agentRunId: agent.id, jobId: job.id };
}

const goodExtraction: ResearchExtraction = {
  summary: "Redis giữ dữ liệu trong RAM; TTL quyết định khi nào key hết hạn.",
  facts: [
    { statement: "Redis lưu dữ liệu trong RAM.", claimStatus: "verified", sourceIds: ["url-1"] },
    { statement: "TTL mặc định là vô hạn.", claimStatus: "verified", sourceIds: ["ref-1"] },
    { statement: "Redis nhanh hơn mọi database.", claimStatus: "verified", sourceIds: ["url-9"] },
    { statement: "Metadata nói khác.", claimStatus: "verified", sourceIds: ["url-2"] },
    { statement: "Cache giúp giảm tải DB.", claimStatus: "assumption", sourceIds: ["url-1"] },
  ],
};

beforeAll(async () => {
  const conn = createDbConnection(DATABASE_URL);
  db = conn.db;
  closeDb = conn.close;
  dataDir = await mkdtemp(join(tmpdir(), "studio-p3-03-"));
  await mkdir(join(dataDir, "uploads"));
  server = createServer((req, res) => {
    if (req.url === "/redis") {
      res
        .writeHead(200, { "content-type": "text/html; charset=utf-8" })
        .end("<html><title>Redis</title><body><p>Redis lưu dữ liệu trong RAM.</p></body></html>");
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  for (const projectId of createdProjectIds) {
    await deleteProjectCascadeForTests(db, projectId);
  }
  await closeDb();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(dataDir, { recursive: true, force: true });
});

describe("research job (P3-03)", () => {
  it("chạy với LLM giả: research_ready, hai artifact, citation lạ và URL metadata không thành verified", async () => {
    const seeded = await seedResearchJob();
    const { deps: llm, calls } = fakeLlm([goodExtraction]);

    const result = await runResearchJob(db, seeded.jobId, { ...llm, dataDir, fetchUrl: testFetch });
    expect(result.status).toBe("completed");
    if (result.status !== "completed") {
      return;
    }

    // Model chỉ thấy file của Director và trang fetch được; URL metadata không có tài liệu.
    expect(calls).toHaveLength(1);
    expect(calls[0]?.documents.map((doc) => [doc.sourceId, doc.origin])).toEqual([
      ["ref-1", "user_reference"],
      ["url-1", "fetched_url"],
    ]);
    expect(calls[0]?.documents[1]?.text).toContain("Redis lưu dữ liệu trong RAM.");

    const detail = await getWorkflowRunDetail(db, seeded.runId);
    expect(detail?.workflowRun.status).toBe("research_ready");
    // Research xong thì có thêm agent script `queued` (P3-04).
    expect(detail?.agentRuns.filter((agent) => agent.role === "research")).toEqual([
      expect.objectContaining({ id: seeded.agentRunId, role: "research", status: "completed" }),
    ]);
    expect(
      detail?.agentRuns.filter((agent) => agent.role === "script").map((agent) => agent.status),
    ).toEqual(["queued"]);
    expect((await getJobById(db, seeded.jobId))?.status).toBe("completed");
    expect(detail?.artifacts.map((a) => [a.type, a.version]).sort()).toEqual([
      ["fetch_log", 1],
      ["research", 1],
    ]);

    const { artifacts: artifactTable } = await import("@studio/db");
    const rows = await db.select().from(artifactTable);
    const research = rows.find((row) => row.id === result.researchArtifactId);
    const fetchLogRow = rows.find((row) => row.id === result.fetchLogArtifactId);
    expect(research?.storageKey).toMatch(
      new RegExp(`^artifacts/${seeded.runId}/research-[0-9a-f-]{36}\\.json$`),
    );

    const fetchLog = fetchLogSchema.parse(
      JSON.parse(await readFile(join(dataDir, fetchLogRow?.storageKey ?? ""), "utf8")),
    );
    expect(fetchLog.requests).toHaveLength(2);
    expect(fetchLog.requests[0]).toMatchObject({
      status: 200,
      finalUrl: `http://docs.test:${port}/redis`,
    });
    expect(fetchLog.requests[1]).toMatchObject({
      url: "http://169.254.169.254/latest/meta-data/",
      error: "address_blocked",
      contentHash: null,
    });

    const saved = researchSchema.parse(
      JSON.parse(await readFile(join(dataDir, research?.storageKey ?? ""), "utf8")),
    );
    expect(saved.sources.map((s) => s.id)).toEqual(["ref-1", "url-1"]);
    expect(saved.facts.map((f) => f.statement)).toEqual([
      "Redis lưu dữ liệu trong RAM.",
      "TTL mặc định là vô hạn.",
      "Cache giúp giảm tải DB.",
    ]);
    expect(saved.facts.filter((f) => f.claimStatus === "verified")).toHaveLength(2);
    expect(result.rejectedFacts).toEqual([
      { statement: "Redis nhanh hơn mọi database.", reason: "unknown_source" },
      { statement: "Metadata nói khác.", reason: "unknown_source" },
    ]);
    expect(research?.metadata).toMatchObject({
      skippedReferences: [{ reason: "address_blocked" }],
      rejectedFacts: result.rejectedFacts,
    });

    // Một lần gọi provider → đúng một row usage, gắn agent research.
    const usage = await listUsageRecordsForRun(db, seeded.runId);
    expect(
      usage.map((u) => [u.agentRunId, u.model, u.inputTokens, u.outputTokens, u.thinkingTokens]),
    ).toEqual([[seeded.agentRunId, "fake-model", 12, 3, 1]]);

    const events = await listEventsForRun(db, seeded.runId);
    expect(events.map((e) => [e.type, e.payload])).toEqual([
      ["workflow.transition", { from: "idea_submitted", to: "researching", cause: "job" }],
      ["agent.status", { role: "research", status: "running" }],
      ["job.completed", { artifactIds: [result.fetchLogArtifactId, result.researchArtifactId] }],
      ["agent.status", { role: "research", status: "completed" }],
      ["workflow.transition", { from: "researching", to: "research_ready", cause: "job" }],
      ["agent.status", { role: "script", status: "queued" }],
    ]);
  });

  it("chạy lại job đã xong không gọi provider lần hai", async () => {
    const seeded = await seedResearchJob({ withReferences: false });
    const { deps: llm, calls } = fakeLlm([{ summary: "Chưa có nguồn.", facts: [] }]);
    expect(
      (await runResearchJob(db, seeded.jobId, { ...llm, dataDir, fetchUrl: testFetch })).status,
    ).toBe("completed");
    const again = await runResearchJob(db, seeded.jobId, { ...llm, dataDir, fetchUrl: testFetch });
    expect(again).toEqual({ status: "skipped", reason: "job_completed" });
    expect(calls).toHaveLength(1);
    const detail = await getWorkflowRunDetail(db, seeded.runId);
    expect(detail?.artifacts.filter((a) => a.type === "research")).toHaveLength(1);
  });

  it("schema sai sau repair: job, agent, run failed với resume_from researching", async () => {
    const seeded = await seedResearchJob({ withReferences: false });
    // Hai response sai schema: lần đầu và lần repair.
    const bad = JSON.stringify({
      summary: "x",
      facts: [{ statement: "a", claimStatus: "verified", sourceIds: [] }],
    });
    const { deps: llm } = fakeLlm([bad, bad]);
    const result = await runResearchJob(db, seeded.jobId, { ...llm, dataDir, fetchUrl: testFetch });
    expect(result).toEqual({ status: "failed", errorCode: "schema_invalid" });
    const detail = await getWorkflowRunDetail(db, seeded.runId);
    expect(detail?.workflowRun).toMatchObject({
      status: "failed",
      resumeFrom: "researching",
      failureCode: "schema_invalid",
    });
    expect((await getJobById(db, seeded.jobId))?.status).toBe("failed");
    // Lần đầu và lần repair: hai row usage.
    expect(await listUsageRecordsForRun(db, seeded.runId)).toHaveLength(2);
    expect(detail?.artifacts).toEqual([]);
    expect(detail?.agentRuns[0]?.status).toBe("failed");
  });

  it("lỗi provider: lần 1 ném để BullMQ retry, lần cuối (max_attempts 2) thì failed", async () => {
    const seeded = await seedResearchJob({ withReferences: false });
    const { deps: llm, calls } = fakeLlm([
      new LlmError("provider_error", "503"),
      new LlmError("provider_error", "503"),
    ]);
    await expect(
      runResearchJob(db, seeded.jobId, { ...llm, dataDir, fetchUrl: testFetch }),
    ).rejects.toMatchObject({
      code: "provider_error",
    });
    expect(await getJobById(db, seeded.jobId)).toMatchObject({ status: "running", attempt: 1 });
    expect((await getWorkflowRunDetail(db, seeded.runId))?.workflowRun.status).toBe("researching");

    const second = await runResearchJob(db, seeded.jobId, { ...llm, dataDir, fetchUrl: testFetch });
    expect(second).toEqual({ status: "failed", errorCode: "provider_error" });
    expect(await getJobById(db, seeded.jobId)).toMatchObject({ status: "failed", attempt: 2 });
    expect(calls).toHaveLength(2);
  });

  it("run đã hủy thì không nhận job và không gọi provider", async () => {
    const seeded = await seedResearchJob({ withReferences: false, status: "cancelled" });
    const { deps: llm, calls } = fakeLlm([{ summary: "x", facts: [] }]);
    const result = await runResearchJob(db, seeded.jobId, { ...llm, dataDir, fetchUrl: testFetch });
    expect(result).toEqual({ status: "skipped", reason: "workflow run is cancelled" });
    expect(calls).toHaveLength(0);
    expect((await getJobById(db, seeded.jobId))?.status).toBe("queued");
  });

  it("hết trần gọi LLM: repair bị chặn, run failed với cost_ceiling, provider không bị gọi thêm", async () => {
    const seeded = await seedResearchJob({ withReferences: false });
    const bad = JSON.stringify({ summary: "", facts: [] });
    const { deps: llm, providerCalls } = fakeLlm([bad, { summary: "x", facts: [] }]);
    const result = await runResearchJob(db, seeded.jobId, {
      ...llm,
      dataDir,
      fetchUrl: testFetch,
      llmCallCeiling: 1,
    });
    expect(result).toEqual({ status: "failed", errorCode: "cost_ceiling" });
    expect(providerCalls()).toBe(1);
    expect(await listUsageRecordsForRun(db, seeded.runId)).toHaveLength(1);
    expect((await getWorkflowRunDetail(db, seeded.runId))?.workflowRun).toMatchObject({
      status: "failed",
      failureCode: "cost_ceiling",
      resumeFrom: "researching",
    });
  });
});

describe("cache research (P5-01)", () => {
  it("cùng brief và cùng nội dung nguồn: run thứ hai tái sử dụng research, provider giả không bị gọi lần hai", async () => {
    const first = await seedResearchJob();
    const { deps: llm, providerCalls } = fakeLlm([goodExtraction]);
    const r1 = await runResearchJob(db, first.jobId, { ...llm, dataDir, fetchUrl: testFetch });
    expect(r1.status).toBe("completed");
    expect(providerCalls()).toBe(1);

    // Run mới, cùng project, cùng brief, cùng reference.
    const second = await seedRunJob(first.projectId, first.briefId);
    const r2 = await runResearchJob(db, second.jobId, { ...llm, dataDir, fetchUrl: testFetch });
    expect(providerCalls()).toBe(1);
    expect(r2.status).toBe("completed");
    if (r1.status !== "completed" || r2.status !== "completed") {
      return;
    }
    expect(r2.reusedFromArtifactId).toBe(r1.researchArtifactId);
    expect(r2.usage).toEqual([]);
    expect(await listUsageRecordsForRun(db, second.runId)).toEqual([]);

    const { artifacts: artifactTable, agentRuns: agentTable } = await import("@studio/db");
    const rows = await db.select().from(artifactTable);
    const a1 = rows.find((row) => row.id === r1.researchArtifactId);
    const a2 = rows.find((row) => row.id === r2.researchArtifactId);
    expect(a2?.workflowRunId).toBe(second.runId);
    expect(a2?.contentHash).toBe(a1?.contentHash);
    expect(a2?.storageKey).not.toBe(a1?.storageKey);
    expect((a2?.metadata as { inputHash?: string }).inputHash).toBe(
      (a1?.metadata as { inputHash?: string }).inputHash,
    );
    expect(a2?.metadata).toMatchObject({ reusedFromArtifactId: r1.researchArtifactId });
    const agents = await db.select().from(agentTable);
    const hashes = agents
      .filter((row) => row.id === first.agentRunId || row.id === second.agentRunId)
      .map((row) => row.inputHash);
    expect(hashes).toHaveLength(2);
    expect(hashes[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(hashes[0]).toBe(hashes[1]);
    expect((await getWorkflowRunDetail(db, second.runId))?.workflowRun.status).toBe(
      "research_ready",
    );
  });

  it("brief đổi nội dung hoặc file reference đổi nội dung thì gọi provider lại", async () => {
    const first = await seedResearchJob();
    const { deps: llm, providerCalls } = fakeLlm([goodExtraction, goodExtraction, goodExtraction]);
    expect(
      (await runResearchJob(db, first.jobId, { ...llm, dataDir, fetchUrl: testFetch })).status,
    ).toBe("completed");
    expect(providerCalls()).toBe(1);

    const newBrief = await insertBrief(db, first.projectId, {
      topic: "Redis cache",
      audience: "Dev",
      goal: "Hiểu TTL",
      durationSec: 60,
      language: "vi",
      tone: "friendly",
      visualStyle: "edu",
      notes: "Nhấn mạnh eviction",
    });
    const byBrief = await seedRunJob(first.projectId, newBrief.id);
    const r2 = await runResearchJob(db, byBrief.jobId, { ...llm, dataDir, fetchUrl: testFetch });
    expect(providerCalls()).toBe(2);
    expect(r2.status === "completed" && r2.reusedFromArtifactId).toBeFalsy();

    await writeFile(
      join(dataDir, first.uploadKey ?? ""),
      "# Ghi chú\nTTL đặt bằng EXPIRE.",
      "utf8",
    );
    const byFile = await seedRunJob(first.projectId, first.briefId);
    const r3 = await runResearchJob(db, byFile.jobId, { ...llm, dataDir, fetchUrl: testFetch });
    expect(providerCalls()).toBe(3);
    expect(r3.status === "completed" && r3.reusedFromArtifactId).toBeFalsy();
  });

  it("file research đã lưu bị hỏng thì không dùng cache", async () => {
    const first = await seedResearchJob({ withReferences: false });
    const { deps: llm, providerCalls } = fakeLlm([
      { summary: "Chưa có nguồn.", facts: [] },
      { summary: "Lần hai.", facts: [] },
    ]);
    const r1 = await runResearchJob(db, first.jobId, { ...llm, dataDir, fetchUrl: testFetch });
    if (r1.status !== "completed") {
      throw new Error("run 1 phải completed");
    }
    const { artifacts: artifactTable } = await import("@studio/db");
    const row = (await db.select().from(artifactTable)).find((a) => a.id === r1.researchArtifactId);
    await writeFile(join(dataDir, row?.storageKey ?? ""), "{ hỏng", "utf8");
    const second = await seedRunJob(first.projectId, first.briefId);
    const r2 = await runResearchJob(db, second.jobId, { ...llm, dataDir, fetchUrl: testFetch });
    expect(r2.status).toBe("completed");
    expect(providerCalls()).toBe(2);
  });
});
