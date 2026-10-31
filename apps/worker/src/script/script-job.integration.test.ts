import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseScript, type Script, scriptArtifactSchema } from "@studio/contracts";
import {
  agentRuns,
  artifacts,
  createDbConnection,
  createProject,
  deleteProjectCascadeForTests,
  getWorkflowRunDetail,
  insertBrief,
  jobs,
  listEventsForRun,
  listUsageRecordsForRun,
  recordApproval,
  workflowRuns,
} from "@studio/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveRepoRoot } from "../cli/paths.js";
import { encodeScriptVariantsForGeminiResponse } from "../llm/gemini-diagram-transform.js";
import type { StructuredGenerateClient, StructuredGenerateRequest } from "../llm/structured-output.js";
import { runResearchJob } from "../research/research-job.js";
import { runScriptJob } from "./script-job.js";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";

type Db = ReturnType<typeof createDbConnection>["db"];
type RunStatus = (typeof workflowRuns.$inferSelect)["status"];

let db: Db;
let closeDb: () => Promise<void>;
let dataDir = "";
const createdProjectIds: string[] = [];

function loadScript(title: string): Script {
  const raw = JSON.parse(
    readFileSync(join(resolveRepoRoot(import.meta.url), "fixtures", "script.edu.json"), "utf8"),
  ) as Record<string, unknown>;
  return parseScript({
    ...raw,
    title,
    sources: [{ id: "src-redis-docs", title: "Redis documentation", url: "https://redis.io/docs/" }],
  });
}

const variantsJson = (label: string) =>
  JSON.stringify(encodeScriptVariantsForGeminiResponse([loadScript(`${label} A`), loadScript(`${label} B`)]));

/**
 * Provider giả ở mức client: adapter Gemini thật (research và script) parse, validate, repair.
 * `requests` giữ request mỗi lần gọi để kiểm prompt.
 */
function fakeClient(outcomes: string[]) {
  const requests: StructuredGenerateRequest[] = [];
  const client: StructuredGenerateClient = {
    async generateStructured(request) {
      requests.push(request);
      const next = outcomes.shift();
      if (next === undefined) {
        throw new Error("fake LLM hết kịch bản");
      }
      return {
        jsonText: next,
        usage: { provider: "gemini", model: request.model, inputTokens: 20, outputTokens: 5, thinkingTokens: 0 },
      };
    },
  };
  return { client, requests };
}

const geminiConfig = { apiKey: "test-key-not-real", modelScript: "fake-model", thinkingLevelScript: "low" as const };

async function deps(client: StructuredGenerateClient, extra: { llmCallCeiling?: number } = {}) {
  const { createGeminiAdapter } = await import("../llm/gemini-adapter.js");
  const { createGeminiResearchAdapter } = await import("../llm/gemini-research-adapter.js");
  return {
    research: {
      client,
      dataDir,
      createLlm: (metered: StructuredGenerateClient) =>
        createGeminiResearchAdapter({ config: geminiConfig, client: metered }),
    },
    script: {
      client,
      dataDir,
      createLlm: (metered: StructuredGenerateClient) => createGeminiAdapter({ config: geminiConfig, client: metered }),
      ...extra,
    },
  };
}

async function seedProject() {
  const project = await createProject(db, "P3-04 test run");
  createdProjectIds.push(project.id);
  const brief = await insertBrief(db, project.id, {
    topic: "Redis cache",
    audience: "Dev",
    goal: "Hiểu TTL",
    durationSec: 60,
    language: "vi",
    tone: "friendly",
    visualStyle: "edu",
  });
  return { projectId: project.id, briefId: brief.id };
}

/** Run mới với agent research + job `queued`, như route tạo run sẽ làm. */
async function seedResearchRun() {
  const { projectId, briefId } = await seedProject();
  const [run] = await db.insert(workflowRuns).values({ projectId, briefId, status: "idea_submitted" }).returning();
  const [agent] = await db
    .insert(agentRuns)
    .values({ workflowRunId: run?.id ?? "", role: "research", status: "queued" })
    .returning();
  const [job] = await db
    .insert(jobs)
    .values({ agentRunId: agent?.id ?? "", queue: "llm", idempotencyKey: `test-p3-04-${run?.id}`, status: "queued" })
    .returning();
  if (run === undefined || job === undefined) {
    throw new Error("seed failed");
  }
  return { projectId, runId: run.id, researchJobId: job.id };
}

/** Run đứng ở `status` với một job script `queued` và không có research (kiểm lỗi). */
async function seedScriptOnlyRun(status: RunStatus) {
  const { projectId, briefId } = await seedProject();
  const [run] = await db.insert(workflowRuns).values({ projectId, briefId, status }).returning();
  const [agent] = await db
    .insert(agentRuns)
    .values({ workflowRunId: run?.id ?? "", role: "script", status: "queued" })
    .returning();
  const [job] = await db
    .insert(jobs)
    .values({ agentRunId: agent?.id ?? "", queue: "llm", idempotencyKey: `test-p3-04-s-${run?.id}`, status: "queued" })
    .returning();
  if (run === undefined || job === undefined) {
    throw new Error("seed failed");
  }
  return { runId: run.id, jobId: job.id };
}

/** Job của run theo role, cũ trước. Lọc trong JS vì worker không phụ thuộc drizzle trực tiếp. */
async function runJobs(runId: string) {
  const agents = (await db.select().from(agentRuns)).filter((row) => row.workflowRunId === runId);
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  return (await db.select().from(jobs))
    .filter((job) => agentById.has(job.agentRunId))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((job) => ({ ...job, role: agentById.get(job.agentRunId)?.role, agentStatus: agentById.get(job.agentRunId)?.status }));
}

beforeAll(async () => {
  const conn = createDbConnection(DATABASE_URL);
  db = conn.db;
  closeDb = conn.close;
  dataDir = await mkdtemp(join(tmpdir(), "studio-p3-04-"));
  await mkdir(join(dataDir, "uploads"));
});

afterAll(async () => {
  for (const projectId of createdProjectIds) {
    await deleteProjectCascadeForTests(db, projectId);
  }
  await closeDb();
  await rm(dataDir, { recursive: true, force: true });
});

const researchJson = JSON.stringify({ summary: "Redis giữ key trong RAM; TTL đặt hạn.", facts: [] });

describe("job script và cổng (P3-04)", () => {
  it("research → hai phương án → chờ duyệt; changes_requested chạy lại script, job research vẫn là một", async () => {
    const seeded = await seedResearchRun();
    const { client, requests } = fakeClient([researchJson, variantsJson("Lượt 1"), variantsJson("Lượt 2")]);
    const d = await deps(client);

    expect((await runResearchJob(db, seeded.researchJobId, d.research)).status).toBe("completed");
    // Research xong tạo đúng một job script `queued` cùng transaction.
    const afterResearch = await runJobs(seeded.runId);
    expect(afterResearch.map((job) => [job.role, job.status])).toEqual([
      ["research", "completed"],
      ["script", "queued"],
    ]);
    const firstScriptJob = afterResearch[1];

    const first = await runScriptJob(db, firstScriptJob?.id ?? "", d.script);
    expect(first.status).toBe("completed");
    if (first.status !== "completed") {
      return;
    }
    expect(first.directorNote).toBeNull();
    let detail = await getWorkflowRunDetail(db, seeded.runId);
    expect(detail?.workflowRun.status).toBe("waiting_script_approval");
    expect(detail?.agentRuns.find((agent) => agent.role === "script")?.status).toBe("waiting_approval");
    // Không job nào tự ghi approval.
    expect(detail?.approvals).toEqual([]);

    const firstRow = (await db.select().from(artifacts)).find((row) => row.id === first.scriptArtifactId);
    expect(firstRow).toMatchObject({ type: "script", version: 1, schemaVersion: "1" });
    const saved = scriptArtifactSchema.parse(JSON.parse(await readFile(join(dataDir, firstRow?.storageKey ?? ""), "utf8")));
    expect(saved.variants.map((variant) => variant.title)).toEqual(["Lượt 1 A", "Lượt 1 B"]);
    // Prompt script nhận tóm tắt research.
    expect(requests[1]?.userPrompt).toContain("Redis giữ key trong RAM; TTL đặt hạn.");
    expect(requests[1]?.userPrompt).not.toContain("Director change request");

    // Director yêu cầu sửa qua đúng hàm của route approval.
    await recordApproval(db, {
      workflowRunId: seeded.runId,
      gate: "script",
      decision: "changes_requested",
      artifactId: first.scriptArtifactId,
      note: "Rút ngắn cảnh 2, thêm ví dụ EXPIRE",
    });
    const afterApproval = await runJobs(seeded.runId);
    expect(afterApproval.map((job) => [job.role, job.status, job.agentStatus])).toEqual([
      ["research", "completed", "completed"],
      ["script", "completed", "completed"],
      ["script", "queued", "queued"],
    ]);
    expect((await getWorkflowRunDetail(db, seeded.runId))?.workflowRun.status).toBe("scripting");

    const second = await runScriptJob(db, afterApproval[2]?.id ?? "", d.script);
    expect(second.status).toBe("completed");
    if (second.status !== "completed") {
      return;
    }
    expect(second.directorNote).toBe("Rút ngắn cảnh 2, thêm ví dụ EXPIRE");
    expect(requests[2]?.userPrompt).toContain("Director change request");
    expect(requests[2]?.userPrompt).toContain("Rút ngắn cảnh 2, thêm ví dụ EXPIRE");

    // Tiêu chí nghiệm thu: job research vẫn là một.
    const finalJobs = await runJobs(seeded.runId);
    expect(finalJobs.filter((job) => job.role === "research")).toHaveLength(1);
    expect(finalJobs.filter((job) => job.role === "script")).toHaveLength(2);
    expect(requests).toHaveLength(3);

    detail = await getWorkflowRunDetail(db, seeded.runId);
    expect(detail?.workflowRun.status).toBe("waiting_script_approval");
    expect(detail?.artifacts.filter((a) => a.type === "research")).toHaveLength(1);
    expect(detail?.artifacts.filter((a) => a.type === "script").map((a) => a.version).sort()).toEqual([1, 2]);
    expect((await db.select().from(artifacts)).find((row) => row.id === second.scriptArtifactId)?.metadata).toMatchObject({
      changesRequestedApprovalId: detail?.approvals[0]?.id,
    });

    // Usage: một research + hai script, mỗi row gắn đúng agent.
    const usage = await listUsageRecordsForRun(db, seeded.runId);
    expect(usage).toHaveLength(3);

    const types = (await listEventsForRun(db, seeded.runId)).map((event) => [event.type, event.payload]);
    expect(types).toContainEqual(["workflow.transition", { from: "research_ready", to: "scripting", cause: "job" }]);
    expect(types).toContainEqual(["agent.status", { role: "script", status: "waiting_approval" }]);
    expect(types.filter(([type, payload]) => type === "agent.status" && (payload as { status: string }).status === "queued")).toHaveLength(2);
  });

  it("chạy lại job script đã xong không gọi provider; rejected không tạo job mới", async () => {
    const seeded = await seedResearchRun();
    const { client, requests } = fakeClient([researchJson, variantsJson("Một")]);
    const d = await deps(client);
    await runResearchJob(db, seeded.researchJobId, d.research);
    const scriptJob = (await runJobs(seeded.runId))[1];
    const first = await runScriptJob(db, scriptJob?.id ?? "", d.script);
    expect(await runScriptJob(db, scriptJob?.id ?? "", d.script)).toEqual({ status: "skipped", reason: "job_completed" });
    expect(requests).toHaveLength(2);
    if (first.status !== "completed") {
      throw new Error("phải completed");
    }
    await recordApproval(db, {
      workflowRunId: seeded.runId,
      gate: "script",
      decision: "rejected",
      artifactId: first.scriptArtifactId,
      note: "Sai chủ đề",
    });
    const after = await runJobs(seeded.runId);
    expect(after).toHaveLength(2);
    // Rejected giữ cổng; agent script vẫn chờ duyệt.
    expect(after[1]?.agentStatus).toBe("waiting_approval");
    expect((await getWorkflowRunDetail(db, seeded.runId))?.workflowRun.status).toBe("waiting_script_approval");
  });

  it("approved: agent script completed, không tạo job script mới; tạo visual và voice (P3-05)", async () => {
    const seeded = await seedResearchRun();
    const { client } = fakeClient([researchJson, variantsJson("Một")]);
    const d = await deps(client);
    await runResearchJob(db, seeded.researchJobId, d.research);
    const first = await runScriptJob(db, (await runJobs(seeded.runId))[1]?.id ?? "", d.script);
    if (first.status !== "completed") {
      throw new Error("phải completed");
    }
    await recordApproval(db, {
      workflowRunId: seeded.runId,
      gate: "script",
      decision: "approved",
      artifactId: first.scriptArtifactId,
      variantIndex: 1,
      note: null,
    });
    const after = await runJobs(seeded.runId);
    expect(after.map((job) => [job.role, job.agentStatus])).toEqual([
      ["research", "completed"],
      ["script", "completed"],
      ["visual", "queued"],
      ["voice", "queued"],
    ]);
    expect((await getWorkflowRunDetail(db, seeded.runId))?.workflowRun.status).toBe("producing_assets");
  });

  it("không có research: failed research_missing, resume_from scripting, không gọi provider", async () => {
    const seeded = await seedScriptOnlyRun("research_ready");
    const { client, requests } = fakeClient([]);
    const result = await runScriptJob(db, seeded.jobId, (await deps(client)).script);
    expect(result).toEqual({ status: "failed", errorCode: "research_missing" });
    expect(requests).toHaveLength(0);
    expect((await getWorkflowRunDetail(db, seeded.runId))?.workflowRun).toMatchObject({
      status: "failed",
      resumeFrom: "scripting",
      failureCode: "research_missing",
    });
  });

  it("run đã hủy: bỏ qua, không gọi provider", async () => {
    const seeded = await seedScriptOnlyRun("cancelled");
    const { client, requests } = fakeClient([]);
    const result = await runScriptJob(db, seeded.jobId, (await deps(client)).script);
    expect(result.status).toBe("skipped");
    expect(requests).toHaveLength(0);
  });

  it("hết trần gọi LLM: failed cost_ceiling, không gọi provider", async () => {
    const seeded = await seedResearchRun();
    const { client, requests } = fakeClient([researchJson]);
    const d = await deps(client, { llmCallCeiling: 1 });
    await runResearchJob(db, seeded.researchJobId, d.research);
    const result = await runScriptJob(db, (await runJobs(seeded.runId))[1]?.id ?? "", d.script);
    expect(result).toEqual({ status: "failed", errorCode: "cost_ceiling" });
    expect(requests).toHaveLength(1);
    expect((await getWorkflowRunDetail(db, seeded.runId))?.workflowRun).toMatchObject({
      status: "failed",
      resumeFrom: "scripting",
      failureCode: "cost_ceiling",
    });
  });
});
