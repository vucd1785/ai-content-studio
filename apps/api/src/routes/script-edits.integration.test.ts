import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  artifacts,
  createDbConnection,
  createProject,
  deleteProjectCascadeForTests,
  insertBrief,
  motionAssetRequests,
  workflowRuns,
} from "@studio/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

/** ADR-020: sửa chữ trong câu tại Cổng 1, không gọi LLM, không ghi approval. */
const TEST_PASSWORD = "director-test-password";
const TEST_SECRET = "0123456789abcdef0123456789abcdef0123456789ab";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";

type Db = ReturnType<typeof createDbConnection>["db"];
let db: Db;
let closeDb: () => Promise<void>;
let dataDir: string;
const projectIds: string[] = [];

beforeAll(() => {
  const conn = createDbConnection(DATABASE_URL);
  db = conn.db;
  closeDb = conn.close;
  dataDir = mkdtempSync(join(tmpdir(), "script-edits-"));
});

afterAll(async () => {
  for (const id of projectIds) {
    await deleteProjectCascadeForTests(db, id);
  }
  await closeDb();
  rmSync(dataDir, { recursive: true, force: true });
});

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

const variant = (title: string) => ({
  title,
  scenes: [
    {
      id: "mo-dau",
      beat: "cold_open",
      lines: [
        { id: "l1", speaker: "ti", text: "Sao nước biển mặn?" },
        { id: "l2", speaker: "bit", text: "Muối đến từ đá." },
      ],
      shots: [
        { id: "s1", lineId: "l1", cutOnWord: "Sao" },
        { id: "s2", lineId: "l2", cutOnWord: "đá" },
      ],
    },
  ],
});

async function seed(status: "waiting_script_approval" | "producing_assets") {
  const project = await createProject(db, "ADR-020 test");
  projectIds.push(project.id);
  const brief = await insertBrief(db, project.id, {
    topic: "Biển",
    audience: "Mọi người",
    goal: "Hiểu",
    durationSec: 60,
    language: "vi",
    tone: "vui",
    visualStyle: "hoạt hình",
  });
  const [run] = await db
    .insert(workflowRuns)
    .values({ projectId: project.id, briefId: brief.id, status })
    .returning();
  if (run === undefined) throw new Error("seed run");
  const key = `artifacts/${run.id}/script-seed.json`;
  mkdirSync(join(dataDir, "artifacts", run.id), { recursive: true });
  writeFileSync(join(dataDir, key), JSON.stringify({ variants: [variant("A"), variant("B")] }));
  const [script] = await db
    .insert(artifacts)
    .values({
      projectId: project.id,
      workflowRunId: run.id,
      type: "script",
      version: 1,
      schemaVersion: "2",
      contentHash: "a".repeat(64),
      storageKey: key,
      metadata: { formatId: "story", creativeMode: "creative" },
    })
    .returning();
  if (script === undefined) throw new Error("seed script");
  await db.insert(motionAssetRequests).values({
    workflowRunId: run.id,
    scriptArtifactId: script.id,
    variantIndex: 1,
    sceneId: "mo-dau",
    requestKey: "r1",
    kind: "prop",
    description: "Hạt muối",
    fallbackAssetId: "prop_laptop",
    status: "fulfilled",
    fulfilledAssetId: "prop_hat_muoi_1a2b",
  });
  return { runId: run.id, scriptId: script.id };
}

describe("sửa câu tại Cổng 1 (ADR-020)", () => {
  it("ghi phiên bản mới, đổi từ cắt cảnh khi cần, chép yêu cầu tài sản, không đổi trạng thái", async () => {
    const { runId, scriptId } = await seed("waiting_script_approval");
    const { app, cookie } = await authedApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${runId}/script-edits`,
      headers: { cookie },
      payload: {
        artifactId: scriptId,
        variantIndex: 1,
        edits: [{ lineId: "l2", text: "Muối bắt nguồn từ núi." }],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { artifactId: string; version: number; retargetedShots: unknown };
    expect(body.version).toBe(2);
    expect(body.retargetedShots).toEqual([{ shotId: "s2", cutOnWord: "Muối" }]);

    // API không phụ thuộc drizzle-orm trực tiếp: lọc trong JS.
    const row = (await db.select().from(artifacts)).find((a) => a.id === body.artifactId);
    const content = JSON.parse(readFileSync(join(dataDir, row?.storageKey ?? ""), "utf8"));
    expect(content.variants[0].scenes[0].lines[1].text).toBe("Muối bắt nguồn từ núi.");
    expect(content.variants[1].scenes[0].lines[1].text).toBe("Muối đến từ đá.");
    expect(row?.metadata).toMatchObject({ editedBy: "director", baseArtifactId: scriptId });

    const copied = (await db.select().from(motionAssetRequests)).filter(
      (r) => r.scriptArtifactId === body.artifactId,
    );
    expect(copied.map((r) => [r.requestKey, r.status, r.fulfilledAssetId])).toEqual([
      ["r1", "fulfilled", "prop_hat_muoi_1a2b"],
    ]);
    const run = (await db.select().from(workflowRuns)).find((r) => r.id === runId);
    expect(run?.status).toBe("waiting_script_approval");

    // Sửa tiếp trên bản cũ thì 409 (đã có bản mới hơn); câu lạ thì 400 (validation_error).
    const stale = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${runId}/script-edits`,
      headers: { cookie },
      payload: { artifactId: scriptId, variantIndex: 1, edits: [{ lineId: "l1", text: "Hả?" }] },
    });
    expect(stale.statusCode).toBe(409);
    const unknown = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${runId}/script-edits`,
      headers: { cookie },
      payload: {
        artifactId: body.artifactId,
        variantIndex: 2,
        edits: [{ lineId: "l9", text: "Hả?" }],
      },
    });
    expect(unknown.statusCode).toBe(400);
    await app.close();
  });

  it("chỉ sửa khi đang chờ duyệt kịch bản", async () => {
    const { runId, scriptId } = await seed("producing_assets");
    const { app, cookie } = await authedApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${runId}/script-edits`,
      headers: { cookie },
      payload: { artifactId: scriptId, variantIndex: 1, edits: [{ lineId: "l1", text: "Ơ?" }] },
    });
    expect(res.statusCode).toBe(409);
    expect((res.json() as { error: { code: string } }).error.code).toBe("invalid_transition");
    await app.close();
  });
});
