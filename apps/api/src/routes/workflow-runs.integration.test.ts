import { randomUUID } from "node:crypto";
import {
  agentRuns,
  ApprovalError,
  approvals,
  artifacts,
  createDbConnection,
  createProject,
  deleteProjectCascadeForTests,
  getWorkflowRunDetail,
  insertBrief,
  jobs,
  listEventsForRun,
  nextStatusAfterApproval,
  recordApproval,
  workflowRuns,
} from "@studio/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

const TEST_PASSWORD = "director-test-password";
const TEST_SECRET = "0123456789abcdef0123456789abcdef0123456789ab";
const NOW = 1_700_000_000;
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";

type Db = ReturnType<typeof createDbConnection>["db"];
type RunStatus = (typeof workflowRuns.$inferSelect)["status"];
type ArtifactType = (typeof artifacts.$inferSelect)["type"];

const createdProjectIds: string[] = [];
let db: Db;
let closeDb: () => Promise<void>;
let dataDir = "";

async function seedRun(
  status: RunStatus,
  artifactTypes: ArtifactType[] = ["script"],
  failure: Partial<Pick<typeof workflowRuns.$inferInsert, "resumeFrom" | "failureCode" | "failureMessage">> = {},
) {
  const project = await createProject(db, "P2-04 test run");
  createdProjectIds.push(project.id);
  const brief = await insertBrief(db, project.id, {
    topic: "Redis",
    audience: "Dev",
    goal: "Hiểu cache",
    durationSec: 60,
    language: "vi",
    tone: "friendly",
    visualStyle: "edu",
  });
  const [run] = await db
    .insert(workflowRuns)
    .values({ projectId: project.id, briefId: brief.id, status, ...failure })
    .returning();
  if (run === undefined) {
    throw new Error("seed run failed");
  }
  const artifactIds: Partial<Record<ArtifactType, string>> = {};
  for (const type of artifactTypes) {
    const [row] = await db
      .insert(artifacts)
      .values({
        projectId: project.id,
        workflowRunId: run.id,
        type,
        version: 1,
        schemaVersion: "1",
        contentHash: `test-${type}`,
        storageKey: `test/p2-04/${run.id}/${type}.json`,
      })
      .returning({ id: artifacts.id });
    if (row === undefined) {
      throw new Error("seed artifact failed");
    }
    artifactIds[type] = row.id;
  }
  return { projectId: project.id, runId: run.id, artifactIds };
}

async function runStatus(runId: string) {
  const detail = await getWorkflowRunDetail(db, runId);
  return detail?.workflowRun.status;
}

async function approvalCount(runId: string) {
  const detail = await getWorkflowRunDetail(db, runId);
  return detail?.approvals.length ?? -1;
}

async function createAuthedApp() {
  const app = await buildApp({
    password: TEST_PASSWORD,
    sessionSecret: TEST_SECRET,
    nowSeconds: NOW,
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

describe("nextStatusAfterApproval", () => {
  it("maps every gate/decision to the orchestration diagram", () => {
    expect(nextStatusAfterApproval("script", "approved")).toBe("producing_assets");
    expect(nextStatusAfterApproval("script", "changes_requested")).toBe("scripting");
    expect(nextStatusAfterApproval("script", "rejected")).toBe("waiting_script_approval");
    expect(nextStatusAfterApproval("final", "approved")).toBe("exporting");
    expect(nextStatusAfterApproval("final", "changes_requested")).toBe("producing_assets");
    expect(nextStatusAfterApproval("final", "rejected")).toBe("waiting_final_approval");
  });
});

describe("approval API (P2-04)", () => {
  beforeAll(async () => {
    const conn = createDbConnection(DATABASE_URL);
    db = conn.db;
    closeDb = conn.close;
    const { mkdtemp } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    dataDir = await mkdtemp(join(tmpdir(), "studio-p2-04-"));
  });

  afterAll(async () => {
    for (const id of createdProjectIds) {
      await deleteProjectCascadeForTests(db, id);
    }
    await closeDb();
    const { rm } = await import("node:fs/promises");
    await rm(dataDir, { recursive: true, force: true });
  });

  it("missing decision returns 400 and writes nothing", async () => {
    const seed = await seedRun("waiting_script_approval");
    const { app, cookie } = await createAuthedApp();
    const response = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${seed.runId}/approvals`,
      headers: { cookie },
      payload: { gate: "script", artifactId: seed.artifactIds.script },
    });
    expect(response.statusCode).toBe(400);
    expect((response.json() as { error: { code: string } }).error.code).toBe("validation_error");
    expect(await approvalCount(seed.runId)).toBe(0);
    expect(await runStatus(seed.runId)).toBe("waiting_script_approval");
    expect(await listEventsForRun(db, seed.runId)).toEqual([]);
    await app.close();
  });

  it("missing gate/artifactId, bad decision value, and note rules return 400", async () => {
    const seed = await seedRun("waiting_script_approval");
    const { app, cookie } = await createAuthedApp();
    const artifactId = seed.artifactIds.script;
    const bodies = [
      { decision: "approved", artifactId },
      { gate: "script", decision: "approved" },
      { gate: "script", decision: "auto", artifactId },
      { gate: "preview", decision: "approved", artifactId },
      { gate: "script", decision: "changes_requested", artifactId },
      { gate: "script", decision: "rejected", artifactId, note: "   " },
      { gate: "script", decision: "rejected", artifactId, note: "x".repeat(2001) },
      // Quyết định 6: duyệt script phải có variantIndex 1|2; decision/gate khác không được có.
      { gate: "script", decision: "approved", artifactId },
      { gate: "script", decision: "approved", artifactId, variantIndex: 3 },
      { gate: "script", decision: "approved", artifactId, variantIndex: "1" },
      { gate: "script", decision: "changes_requested", artifactId, note: "Sửa", variantIndex: 1 },
      { gate: "final", decision: "approved", artifactId, variantIndex: 1 },
    ];
    for (const payload of bodies) {
      const response = await app.inject({
        method: "POST",
        url: `/api/workflow-runs/${seed.runId}/approvals`,
        headers: { cookie },
        payload,
      });
      expect(response.statusCode, JSON.stringify(payload).slice(0, 80)).toBe(400);
    }
    expect(await approvalCount(seed.runId)).toBe(0);
    expect(await runStatus(seed.runId)).toBe("waiting_script_approval");
    await app.close();
  });

  it("script approved moves to producing_assets with approval + transition events", async () => {
    const seed = await seedRun("waiting_script_approval");
    const { app, cookie } = await createAuthedApp();
    const response = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${seed.runId}/approvals`,
      headers: { cookie },
      payload: { gate: "script", decision: "approved", artifactId: seed.artifactIds.script, variantIndex: 2, note: "" },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json() as {
      approval: { decision: string; artifactId: string; variantIndex: number | null; note: string | null };
      workflowRun: { status: string };
    };
    expect(body.approval).toMatchObject({
      decision: "approved",
      artifactId: seed.artifactIds.script,
      variantIndex: 2,
      note: null,
    });
    expect(body.workflowRun.status).toBe("producing_assets");
    expect(await runStatus(seed.runId)).toBe("producing_assets");
    const evts = await listEventsForRun(db, seed.runId);
    expect(evts.map((e) => e.type)).toEqual([
      "approval.recorded",
      "workflow.transition",
      "agent.status",
      "agent.status",
    ]);
    expect(evts[0]?.payload).toMatchObject({ decision: "approved", variantIndex: 2 });
    // P3-05: visual và voice `queued` cùng transaction với approval.
    expect(evts.slice(2).map((e) => e.payload)).toEqual([
      { role: "visual", status: "queued" },
      { role: "voice", status: "queued" },
    ]);
    expect((await getWorkflowRunDetail(db, seed.runId))?.approvals[0]?.variantIndex).toBe(2);
    expect(evts[1]?.payload).toMatchObject({ from: "waiting_script_approval", to: "producing_assets" });

    const again = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${seed.runId}/approvals`,
      headers: { cookie },
      payload: { gate: "script", decision: "approved", artifactId: seed.artifactIds.script, variantIndex: 1 },
    });
    expect(again.statusCode).toBe(409);
    expect((again.json() as { error: { code: string } }).error.code).toBe("invalid_transition");
    expect(await approvalCount(seed.runId)).toBe(1);
    await app.close();
  });

  it("script changes_requested moves to scripting and stores note", async () => {
    const seed = await seedRun("waiting_script_approval");
    const { app, cookie } = await createAuthedApp();
    const response = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${seed.runId}/approvals`,
      headers: { cookie },
      payload: {
        gate: "script",
        decision: "changes_requested",
        artifactId: seed.artifactIds.script,
        note: "Rút ngắn cảnh 2",
      },
    });
    expect(response.statusCode).toBe(201);
    expect(await runStatus(seed.runId)).toBe("scripting");
    const detail = await getWorkflowRunDetail(db, seed.runId);
    expect(detail?.approvals[0]?.note).toBe("Rút ngắn cảnh 2");
    // P3-04: cùng transaction tạo đúng một agent script + job `queued`, key mang approval id.
    expect(detail?.agentRuns.map((agent) => [agent.role, agent.status])).toEqual([["script", "queued"]]);
    const events = await listEventsForRun(db, seed.runId);
    expect(events.map((e) => e.type)).toEqual(["approval.recorded", "workflow.transition", "agent.status"]);
    expect(events[2]?.payload).toEqual({ role: "script", status: "queued" });
    await app.close();
  });

  it("changes_requested: event lỗi thì rollback cả approval lẫn job script mới", async () => {
    const seed = await seedRun("waiting_script_approval");
    await expect(
      recordApproval(
        db,
        {
          workflowRunId: seed.runId,
          gate: "script",
          decision: "changes_requested",
          artifactId: seed.artifactIds.script ?? "",
          note: "Sửa cảnh 1",
        },
        {
          insertEvents: async () => {
            throw new Error("event insert failed");
          },
        },
      ),
    ).rejects.toThrow("event insert failed");
    const detail = await getWorkflowRunDetail(db, seed.runId);
    expect(detail?.approvals).toEqual([]);
    expect(detail?.agentRuns).toEqual([]);
    expect(detail?.workflowRun.status).toBe("waiting_script_approval");
  });

  it("rejected keeps the gate status; only approval.recorded event", async () => {
    const seed = await seedRun("waiting_script_approval");
    const { app, cookie } = await createAuthedApp();
    const response = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${seed.runId}/approvals`,
      headers: { cookie },
      payload: {
        gate: "script",
        decision: "rejected",
        artifactId: seed.artifactIds.script,
        note: "Không đúng chủ đề",
      },
    });
    expect(response.statusCode).toBe(201);
    expect(await runStatus(seed.runId)).toBe("waiting_script_approval");
    expect((await listEventsForRun(db, seed.runId)).map((e) => e.type)).toEqual([
      "approval.recorded",
    ]);
    await app.close();
  });

  it("decision on the wrong gate is invalid_transition and changes nothing", async () => {
    const seed = await seedRun("waiting_script_approval", ["script", "preview"]);
    const other = await seedRun("scripting");
    const { app, cookie } = await createAuthedApp();
    const wrongGate = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${seed.runId}/approvals`,
      headers: { cookie },
      payload: { gate: "final", decision: "approved", artifactId: seed.artifactIds.preview },
    });
    const notWaiting = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${other.runId}/approvals`,
      headers: { cookie },
      payload: { gate: "script", decision: "approved", artifactId: other.artifactIds.script, variantIndex: 1 },
    });
    for (const response of [wrongGate, notWaiting]) {
      expect(response.statusCode).toBe(409);
      expect((response.json() as { error: { code: string } }).error.code).toBe(
        "invalid_transition",
      );
    }
    expect(await runStatus(seed.runId)).toBe("waiting_script_approval");
    expect(await runStatus(other.runId)).toBe("scripting");
    expect(await approvalCount(seed.runId)).toBe(0);
    expect(await approvalCount(other.runId)).toBe(0);
    expect(await listEventsForRun(db, seed.runId)).toEqual([]);
    await app.close();
  });

  /** QA của preview (P3-06): duyệt final chỉ được khi report mới nhất của đúng preview đạt. */
  async function seedQaReport(seed: Awaited<ReturnType<typeof seedRun>>, passed: boolean) {
    await db.insert(artifacts).values({
      projectId: seed.projectId,
      workflowRunId: seed.runId,
      type: "qa_report",
      version: 1,
      schemaVersion: "1",
      contentHash: "test-qa",
      storageKey: `test/p3-06/${seed.runId}/qa.json`,
      metadata: { previewArtifactId: seed.artifactIds.preview, passed },
    });
  }

  it("final gate: approved → exporting (kèm job export), changes_requested → producing_assets", async () => {
    const a = await seedRun("waiting_final_approval", ["preview"]);
    const b = await seedRun("waiting_final_approval", ["preview"]);
    await seedQaReport(a, true);
    const { app, cookie } = await createAuthedApp();
    const approved = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${a.runId}/approvals`,
      headers: { cookie },
      payload: { gate: "final", decision: "approved", artifactId: a.artifactIds.preview },
    });
    const revise = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${b.runId}/approvals`,
      headers: { cookie },
      payload: {
        gate: "final",
        decision: "changes_requested",
        artifactId: b.artifactIds.preview,
        note: "Đổi giọng",
      },
    });
    expect([approved.statusCode, revise.statusCode]).toEqual([201, 201]);
    expect(await runStatus(a.runId)).toBe("exporting");
    expect(await runStatus(b.runId)).toBe("producing_assets");
    const events = await listEventsForRun(db, a.runId);
    expect(events.at(-1)?.payload).toEqual({ role: "video", status: "queued" });
    await app.close();
  });

  it("final approved khi QA chưa có hoặc có error: 409 conflict, không ghi gì", async () => {
    const none = await seedRun("waiting_final_approval", ["preview"]);
    const failing = await seedRun("waiting_final_approval", ["preview"]);
    await seedQaReport(failing, false);
    const { app, cookie } = await createAuthedApp();
    for (const seed of [none, failing]) {
      const response = await app.inject({
        method: "POST",
        url: `/api/workflow-runs/${seed.runId}/approvals`,
        headers: { cookie },
        payload: { gate: "final", decision: "approved", artifactId: seed.artifactIds.preview },
      });
      expect(response.statusCode).toBe(409);
      expect((response.json() as { error: { code: string } }).error.code).toBe("conflict");
      expect(await approvalCount(seed.runId)).toBe(0);
      expect(await runStatus(seed.runId)).toBe("waiting_final_approval");
    }
    await app.close();
  });

  it("artifact from another run is 404; wrong artifact type is 400; nothing written", async () => {
    const seed = await seedRun("waiting_final_approval", ["preview", "script"]);
    const other = await seedRun("waiting_final_approval", ["preview"]);
    const { app, cookie } = await createAuthedApp();
    const foreign = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${seed.runId}/approvals`,
      headers: { cookie },
      payload: { gate: "final", decision: "approved", artifactId: other.artifactIds.preview },
    });
    expect(foreign.statusCode).toBe(404);
    const wrongType = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${seed.runId}/approvals`,
      headers: { cookie },
      payload: { gate: "final", decision: "approved", artifactId: seed.artifactIds.script },
    });
    expect(wrongType.statusCode).toBe(400);
    expect(await approvalCount(seed.runId)).toBe(0);
    expect(await runStatus(seed.runId)).toBe("waiting_final_approval");
    await app.close();
  });

  it("GET never creates an approval (approved không tự sinh từ GET)", async () => {
    const seed = await seedRun("waiting_script_approval");
    const { app, cookie } = await createAuthedApp();
    for (let i = 0; i < 3; i += 1) {
      const run = await app.inject({
        method: "GET",
        url: `/api/workflow-runs/${seed.runId}`,
        headers: { cookie },
      });
      expect(run.statusCode).toBe(200);
      const body = run.json() as {
        workflowRun: { status: string };
        approvals: unknown[];
        artifacts: { id: string; type: string }[];
      };
      expect(body.workflowRun.status).toBe("waiting_script_approval");
      expect(body.approvals).toEqual([]);
      expect(body.artifacts.map((x) => x.id)).toEqual([seed.artifactIds.script]);
      const project = await app.inject({
        method: "GET",
        url: `/api/projects/${seed.projectId}`,
        headers: { cookie },
      });
      expect(project.statusCode).toBe(200);
    }
    expect(await approvalCount(seed.runId)).toBe(0);
    expect(await listEventsForRun(db, seed.runId)).toEqual([]);
    await app.close();
  });

  it("rolls back approval and status when event insert fails", async () => {
    const seed = await seedRun("waiting_script_approval");
    await expect(
      recordApproval(
        db,
        {
          workflowRunId: seed.runId,
          gate: "script",
          decision: "approved",
          artifactId: seed.artifactIds.script ?? "",
          variantIndex: 1,
          note: null,
        },
        {
          insertEvents: async () => {
            throw new Error("event insert failed");
          },
        },
      ),
    ).rejects.toThrow("event insert failed");
    expect(await approvalCount(seed.runId)).toBe(0);
    expect(await runStatus(seed.runId)).toBe("waiting_script_approval");
    expect(await listEventsForRun(db, seed.runId)).toEqual([]);
  });

  it("repository từ chối duyệt script thiếu phương án, và phương án ở decision khác (invalid_variant)", async () => {
    const seed = await seedRun("waiting_script_approval");
    for (const input of [
      { gate: "script" as const, decision: "approved" as const, variantIndex: null },
      { gate: "script" as const, decision: "rejected" as const, variantIndex: 1 as const },
    ]) {
      await expect(
        recordApproval(db, { workflowRunId: seed.runId, artifactId: seed.artifactIds.script ?? "", note: "x", ...input }),
      ).rejects.toMatchObject({ code: "invalid_variant" });
    }
    expect(await approvalCount(seed.runId)).toBe(0);
  });

  it("CHECK của DB chặn variant_index sai kể cả khi bỏ qua contract (migration 0001)", async () => {
    const seed = await seedRun("waiting_script_approval");
    const artifactId = seed.artifactIds.script ?? "";
    const base = { workflowRunId: seed.runId, artifactId, note: "x" };
    for (const row of [
      { ...base, gate: "script" as const, decision: "approved" as const, variantIndex: 3 },
      { ...base, gate: "script" as const, decision: "rejected" as const, variantIndex: 1 },
      { ...base, gate: "final" as const, decision: "approved" as const, variantIndex: 1 },
    ]) {
      await expect(db.insert(approvals).values(row)).rejects.toThrow();
    }
    expect(await approvalCount(seed.runId)).toBe(0);
  });

  it("repository rejects unknown run with ApprovalError not_found", async () => {
    await expect(
      recordApproval(db, {
        workflowRunId: randomUUID(),
        gate: "script",
        decision: "approved",
        artifactId: randomUUID(),
        variantIndex: 1,
        note: null,
      }),
    ).rejects.toBeInstanceOf(ApprovalError);
  });

  it("auth, Origin, UUID and unknown-run guards", async () => {
    const seed = await seedRun("waiting_script_approval");
    const { app, cookie } = await createAuthedApp();
    const payload = { gate: "script", decision: "approved", artifactId: seed.artifactIds.script, variantIndex: 1 };
    const noSession = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${seed.runId}/approvals`,
      payload,
    });
    const noSessionGet = await app.inject({ method: "GET", url: `/api/workflow-runs/${seed.runId}` });
    const evil = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${seed.runId}/approvals`,
      headers: { cookie, origin: "https://evil.example" },
      payload,
    });
    expect([noSession.statusCode, noSessionGet.statusCode, evil.statusCode]).toEqual([401, 401, 401]);
    const badUuid = await app.inject({
      method: "POST",
      url: "/api/workflow-runs/not-a-uuid/approvals",
      headers: { cookie },
      payload,
    });
    expect(badUuid.statusCode).toBe(400);
    const unknown = await app.inject({
      method: "GET",
      url: `/api/workflow-runs/${randomUUID()}`,
      headers: { cookie },
    });
    expect(unknown.statusCode).toBe(404);
    const unknownPost = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${randomUUID()}/approvals`,
      headers: { cookie },
      payload,
    });
    expect(unknownPost.statusCode).toBe(404);
    expect(await approvalCount(seed.runId)).toBe(0);
    expect(await runStatus(seed.runId)).toBe("waiting_script_approval");
    await app.close();
  });

  /** Agent + job của run; trả id để kiểm trạng thái sau hủy/resume (P3-08). */
  async function seedJob(
    runId: string,
    role: (typeof agentRuns.$inferSelect)["role"],
    agentStatus: (typeof agentRuns.$inferSelect)["status"],
    jobStatus: (typeof jobs.$inferSelect)["status"] | null,
    key = `test-p3-08-${randomUUID()}`,
  ) {
    const [agent] = await db.insert(agentRuns).values({ workflowRunId: runId, role, status: agentStatus }).returning();
    if (jobStatus === null) {
      return { agentId: agent?.id ?? "", jobId: "" };
    }
    const [job] = await db
      .insert(jobs)
      .values({ agentRunId: agent?.id ?? "", queue: "render", idempotencyKey: key, status: jobStatus })
      .returning();
    return { agentId: agent?.id ?? "", jobId: job?.id ?? "" };
  }

  const agentStatus = async (id: string) =>
    (await db.select().from(agentRuns)).find((row) => row.id === id)?.status;
  const jobStatus = async (id: string) => (await db.select().from(jobs)).find((row) => row.id === id)?.status;

  it("cancel: run, job và agent chưa xong → cancelled, không ghi approval; hủy lại hoặc hủy run exported là 409", async () => {
    const seed = await seedRun("waiting_script_approval");
    const script = await seedJob(seed.runId, "script", "waiting_approval", null);
    const research = await seedJob(seed.runId, "research", "completed", "completed");
    const queued = await seedJob(seed.runId, "visual", "queued", "queued");
    const { app, cookie } = await createAuthedApp();
    const response = await app.inject({ method: "POST", url: `/api/workflow-runs/${seed.runId}/cancel`, headers: { cookie } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ workflowRun: { id: seed.runId, status: "cancelled", resumeFrom: null } });
    expect(await approvalCount(seed.runId)).toBe(0);
    expect(await agentStatus(script.agentId)).toBe("cancelled");
    expect(await agentStatus(queued.agentId)).toBe("cancelled");
    expect(await jobStatus(queued.jobId)).toBe("cancelled");
    // Việc đã xong giữ nguyên.
    expect(await agentStatus(research.agentId)).toBe("completed");
    expect(await jobStatus(research.jobId)).toBe("completed");
    const events = await listEventsForRun(db, seed.runId);
    expect(events.map((event) => event.type)).not.toContain("approval.recorded");
    expect(events.find((event) => event.type === "workflow.transition")?.payload).toEqual({
      from: "waiting_script_approval",
      to: "cancelled",
      cause: "cancel",
    });
    expect(events.filter((event) => event.type === "agent.status").map((event) => event.payload)).toEqual(
      expect.arrayContaining([
        { role: "script", status: "cancelled" },
        { role: "visual", status: "cancelled" },
      ]),
    );

    const again = await app.inject({ method: "POST", url: `/api/workflow-runs/${seed.runId}/cancel`, headers: { cookie } });
    expect(again.statusCode).toBe(409);
    expect((again.json() as { error: { code: string } }).error.code).toBe("invalid_transition");
    const exported = await seedRun("exported", []);
    const blocked = await app.inject({ method: "POST", url: `/api/workflow-runs/${exported.runId}/cancel`, headers: { cookie } });
    expect(blocked.statusCode).toBe(409);
    expect(await runStatus(exported.runId)).toBe("exported");
    await app.close();
  });

  it("resume: chỉ từ failed có resume_from; đưa job lỗi của bước đó về queued và xóa lỗi run", async () => {
    const { app, cookie } = await createAuthedApp();
    const notFailed = await seedRun("preview_rendering", []);
    const refused = await app.inject({ method: "POST", url: `/api/workflow-runs/${notFailed.runId}/resume`, headers: { cookie } });
    expect(refused.statusCode).toBe(409);
    expect((refused.json() as { error: { code: string } }).error.code).toBe("invalid_transition");

    const seed = await seedRun("failed", [], {
      resumeFrom: "preview_rendering",
      failureCode: "render_interrupted",
      failureMessage: "killed",
    });
    const voice = await seedJob(seed.runId, "voice", "completed", "completed");
    const render = await seedJob(seed.runId, "video", "failed", "failed", `render:${seed.runId}:approval:${randomUUID()}`);
    const response = await app.inject({ method: "POST", url: `/api/workflow-runs/${seed.runId}/resume`, headers: { cookie } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      workflowRun: { status: "preview_rendering", resumeFrom: null, failureCode: null },
    });
    expect(await jobStatus(render.jobId)).toBe("queued");
    expect(await agentStatus(render.agentId)).toBe("queued");
    expect(await jobStatus(voice.jobId)).toBe("completed");
    expect(await approvalCount(seed.runId)).toBe(0);
    const events = await listEventsForRun(db, seed.runId);
    expect(events.find((event) => event.type === "workflow.transition")?.payload).toEqual({
      from: "failed",
      to: "preview_rendering",
      cause: "resume",
    });

    // Không còn job lỗi của bước cần chạy lại: từ chối, run đứng ở failed.
    const empty = await seedRun("failed", [], { resumeFrom: "qa" });
    const conflict = await app.inject({ method: "POST", url: `/api/workflow-runs/${empty.runId}/resume`, headers: { cookie } });
    expect(conflict.statusCode).toBe(409);
    expect((conflict.json() as { error: { code: string } }).error.code).toBe("conflict");
    expect(await runStatus(empty.runId)).toBe("failed");

    const unknown = await app.inject({ method: "POST", url: `/api/workflow-runs/${randomUUID()}/cancel`, headers: { cookie } });
    expect(unknown.statusCode).toBe(404);
    const anonymous = await app.inject({ method: "POST", url: `/api/workflow-runs/${seed.runId}/cancel` });
    expect(anonymous.statusCode).toBe(401);
    await app.close();
  });
});
