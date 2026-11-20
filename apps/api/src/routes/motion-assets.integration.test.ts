import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  artifacts,
  createDbConnection,
  createProject,
  deleteMotionAssetRowsForTests,
  deleteProjectCascadeForTests,
  insertBrief,
  listEventsForRun,
  listMotionAssets,
  motionAssetRequests,
  motionAssets,
  workflowRuns,
} from "@studio/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

/** ADR-017 mục 3 (P7-03): duyệt phương án ở Cổng 1 duyệt luôn tài sản `candidate` của phương án đó. */
const TEST_PASSWORD = "director-test-password";
const TEST_SECRET = "0123456789abcdef0123456789abcdef0123456789ab";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";

type Db = ReturnType<typeof createDbConnection>["db"];
let db: Db;
let closeDb: () => Promise<void>;
let dataDir = "";
const projectIds: string[] = [];
const assetIds: string[] = [];
const runIds: string[] = [];

beforeAll(async () => {
  const conn = createDbConnection(DATABASE_URL);
  db = conn.db;
  closeDb = conn.close;
  dataDir = await mkdtemp(join(tmpdir(), "studio-p7-03-"));
});

afterAll(async () => {
  await deleteMotionAssetRowsForTests(db, { workflowRunIds: runIds, assetIds });
  for (const id of projectIds) {
    await deleteProjectCascadeForTests(db, id);
  }
  await closeDb();
  await rm(dataDir, { recursive: true, force: true });
});

async function seed() {
  const project = await createProject(db, "P7-03 test run");
  projectIds.push(project.id);
  const brief = await insertBrief(db, project.id, {
    topic: "Giấc ngủ",
    audience: "Sinh viên",
    goal: "Ngủ đủ",
    durationSec: 60,
    language: "vi",
    tone: "vui",
    visualStyle: "hoạt hình",
  });
  const [run] = await db
    .insert(workflowRuns)
    .values({ projectId: project.id, briefId: brief.id, status: "waiting_script_approval" })
    .returning();
  if (run === undefined) throw new Error("seed run");
  runIds.push(run.id);
  const [script] = await db
    .insert(artifacts)
    .values({
      projectId: project.id,
      workflowRunId: run.id,
      type: "script",
      version: 1,
      schemaVersion: "2",
      contentHash: "test-script",
      storageKey: `test/p7-03/${run.id}/script.json`,
    })
    .returning({ id: artifacts.id });
  if (script === undefined) throw new Error("seed script");
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  const ids = [`prop_test_a_${suffix}`, `prop_test_b_${suffix}`] as const;
  assetIds.push(...ids);
  for (const assetId of ids) {
    await db.insert(motionAssets).values({
      assetId,
      kind: "prop",
      version: "0.1.0",
      tags: ["thử"],
      createdBy: "claude-code",
      status: "candidate",
      sourcePath: `packages/motion-kit/src/assets/prop/${assetId}`,
      previewStorageKey: `motion-assets/${assetId}.png`,
      manifestHash: `hash-${assetId}`,
    });
  }
  for (const [i, assetId] of ids.entries()) {
    await db.insert(motionAssetRequests).values({
      workflowRunId: run.id,
      scriptArtifactId: script.id,
      variantIndex: i + 1,
      sceneId: "c1,c2",
      requestKey: "r1",
      kind: "prop",
      description: `Đồ vật thử ${i + 1}`,
      fallbackAssetId: "prop_laptop",
      status: "fulfilled",
      fulfilledAssetId: assetId,
    });
  }
  return { runId: run.id, scriptId: script.id, ids };
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

const statusOf = async (assetId: string) =>
  (await listMotionAssets(db)).find((a) => a.assetId === assetId)?.status;

describe("tài sản tự tạo ở Cổng 1 (ADR-017, P7-03)", () => {
  it("GET asset-requests trả yêu cầu kèm tài sản; ảnh thiếu file là 404", async () => {
    const s = await seed();
    const { app, cookie } = await authedApp();
    const res = await app.inject({
      method: "GET",
      url: `/api/workflow-runs/${s.runId}/asset-requests`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      requests: { variantIndex: number; sceneIds: string[]; asset: { status: string } | null }[];
    };
    expect(body.requests.map((r) => [r.variantIndex, r.sceneIds, r.asset?.status])).toEqual([
      [1, ["c1", "c2"], "candidate"],
      [2, ["c1", "c2"], "candidate"],
    ]);
    const preview = await app.inject({
      method: "GET",
      url: `/api/motion-assets/${s.ids[0]}/preview`,
      headers: { cookie },
    });
    expect(preview.statusCode).toBe(404);
    await app.close();
  });

  it("từ chối và yêu cầu sửa không đổi trạng thái tài sản", async () => {
    const s = await seed();
    const { app, cookie } = await authedApp();
    const rejected = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${s.runId}/approvals`,
      headers: { cookie },
      payload: { gate: "script", decision: "rejected", artifactId: s.scriptId, note: "Chưa ổn" },
    });
    expect(rejected.statusCode).toBe(201);
    expect(await statusOf(s.ids[0])).toBe("candidate");
    const changes = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${s.runId}/approvals`,
      headers: { cookie },
      payload: {
        gate: "script",
        decision: "changes_requested",
        artifactId: s.scriptId,
        note: "Sửa cảnh 2",
      },
    });
    expect(changes.statusCode).toBe(201);
    expect(await statusOf(s.ids[0])).toBe("candidate");
    expect(await statusOf(s.ids[1])).toBe("candidate");
    await app.close();
  });

  it("duyệt phương án 1: chỉ tài sản của phương án 1 thành approved, event ghi approvedAssetIds", async () => {
    const s = await seed();
    const { app, cookie } = await authedApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${s.runId}/approvals`,
      headers: { cookie },
      payload: { gate: "script", decision: "approved", artifactId: s.scriptId, variantIndex: 1 },
    });
    expect(res.statusCode).toBe(201);
    expect(await statusOf(s.ids[0])).toBe("approved");
    expect(await statusOf(s.ids[1])).toBe("candidate");
    const recorded = (await listEventsForRun(db, s.runId)).find(
      (e) => e.type === "approval.recorded",
    );
    expect((recorded?.payload as { approvedAssetIds?: string[] }).approvedAssetIds).toEqual([
      s.ids[0],
    ]);
    await app.close();
  });
});
