import { randomUUID } from "node:crypto";
import {
  ApprovalError,
  approvals,
  artifacts,
  createDbConnection,
  createProject,
  deleteProjectCascadeForTests,
  getWorkflowRunDetail,
  insertBrief,
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

async function seedRun(status: RunStatus, artifactTypes: ArtifactType[] = ["script"]) {
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
    .values({ projectId: project.id, briefId: brief.id, status })
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

  it("final gate: approved → exporting, changes_requested → producing_assets", async () => {
    const a = await seedRun("waiting_final_approval", ["preview"]);
    const b = await seedRun("waiting_final_approval", ["preview"]);
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
});
