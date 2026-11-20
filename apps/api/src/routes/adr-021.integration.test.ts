import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isChannelNameSet, PLACEHOLDER_CHANNEL_NAME } from "@studio/contracts";
import {
  agentRuns,
  approvals,
  artifacts,
  createBrandProfileForTests,
  createDbConnection,
  createProject,
  deleteBrandProfileForTests,
  deleteMotionAssetRowsForTests,
  deleteProjectCascadeForTests,
  insertBrief,
  jobs,
  setProjectBrandForTests,
  upsertMotionAssetFromManifest,
  workflowRuns,
} from "@studio/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

/** ADR-021: làm lại một phần ở Cổng 2, tên kênh trước lần xuất, kho "dùng trong", ảnh bìa. */
const TEST_PASSWORD = "director-test-password";
const TEST_SECRET = "0123456789abcdef0123456789abcdef0123456789ab";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";

type Db = ReturnType<typeof createDbConnection>["db"];
let db: Db;
let closeDb: () => Promise<void>;
let dataDir: string;
const projectIds: string[] = [];
const brandIds: string[] = [];
const TEST_BG = "bg_test_adr021_redo";

beforeAll(async () => {
  const conn = createDbConnection(DATABASE_URL);
  db = conn.db;
  closeDb = conn.close;
  dataDir = mkdtempSync(join(tmpdir(), "adr-021-"));
  await upsertMotionAssetFromManifest(db, {
    assetId: TEST_BG,
    kind: "background",
    version: "0.1.0",
    tags: ["thử"],
    brandProfileId: null,
    createdBy: "director",
    status: "approved",
    sourcePath: `packages/motion-kit/src/assets/background/${TEST_BG}`,
    previewStorageKey: null,
    manifestHash: "test",
  });
});

afterAll(async () => {
  for (const id of projectIds) {
    await deleteProjectCascadeForTests(db, id);
  }
  for (const id of brandIds) {
    await deleteBrandProfileForTests(db, id);
  }
  await deleteMotionAssetRowsForTests(db, { workflowRunIds: [], assetIds: [TEST_BG] });
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

const PROPS = {
  scenes: [
    { sceneId: "mo-dau", fromMs: 0, durationMs: 3000 },
    { sceneId: "giai-thich", fromMs: 3000, durationMs: 4000 },
  ],
  shots: [
    {
      sceneId: "mo-dau",
      background: "bg_room",
      camera: "cam_static",
      props: ["prop_laptop"],
      actors: [{ skin: "skin_ti", action: "action_idle", expression: "expr_happy" }],
    },
  ],
};

async function seed(opts: {
  status: "waiting_final_approval" | "exported" | "producing_assets";
  channelName: string;
}) {
  const brandId = await createBrandProfileForTests(db, opts.channelName);
  brandIds.push(brandId);
  const project = await createProject(db, "ADR-021 test");
  projectIds.push(project.id);
  await setProjectBrandForTests(db, project.id, brandId);
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
    .values({ projectId: project.id, briefId: brief.id, status: opts.status })
    .returning();
  if (run === undefined) throw new Error("seed run");
  const insert = async (
    type: "script" | "render_props" | "preview" | "qa_report" | "export",
    metadata = {},
  ) => {
    const key = `artifacts/${run.id}/${type}.json`;
    const [row] = await db
      .insert(artifacts)
      .values({
        projectId: project.id,
        workflowRunId: run.id,
        type,
        version: 1,
        schemaVersion: type === "script" || type === "render_props" ? "2" : "1",
        contentHash: "a".repeat(64),
        storageKey: key,
        metadata,
      })
      .returning();
    if (row === undefined) throw new Error(`seed ${type}`);
    return row;
  };
  const script = await insert("script");
  await db.insert(approvals).values({
    workflowRunId: run.id,
    gate: "script",
    decision: "approved",
    artifactId: script.id,
    variantIndex: 1,
  });
  mkdirSync(join(dataDir, "artifacts", run.id), { recursive: true });
  writeFileSync(join(dataDir, "artifacts", run.id, "render_props.json"), JSON.stringify(PROPS));
  await insert("render_props");
  const preview = await insert("preview");
  await insert("qa_report", { previewArtifactId: preview.id, passed: true });
  return { runId: run.id, previewId: preview.id, insert };
}

async function runJobs(runId: string) {
  const agents = (await db.select().from(agentRuns)).filter((a) => a.workflowRunId === runId);
  return (await db.select().from(jobs))
    .filter((j) => agents.some((a) => a.id === j.agentRunId))
    .map((j) => ({
      role: agents.find((a) => a.id === j.agentRunId)?.role,
      queue: j.queue,
      key: j.idempotencyKey,
    }));
}

const status = async (runId: string) =>
  (await db.select().from(workflowRuns)).find((r) => r.id === runId)?.status;

describe("làm lại một phần ở Cổng 2 (ADR-021)", () => {
  it("đổi nền: ghi file yêu cầu, run sang preview_rendering, đúng một job render có redoId", async () => {
    const { runId } = await seed({ status: "waiting_final_approval", channelName: "Kênh thử" });
    const { app, cookie } = await authedApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${runId}/redo`,
      headers: { cookie },
      payload: { kind: "background", sceneId: "mo-dau", backgroundId: TEST_BG },
    });
    expect(res.statusCode, res.body).toBe(202);
    const { redoId } = res.json() as { redoId: string };
    expect(await status(runId)).toBe("preview_rendering");
    const list = await runJobs(runId);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ role: "video", queue: "render" });
    expect(list[0]?.key).toMatch(
      new RegExp(`^render:${runId}:approval:[0-9a-f-]{36}:redo:${redoId}$`),
    );
    expect(readdirSync(join(dataDir, "artifacts", runId, "redo"))).toEqual([`${redoId}.json`]);

    // Đang dựng lại thì không nhận yêu cầu nữa; không để file mồ côi.
    const again = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${runId}/redo`,
      headers: { cookie },
      payload: { kind: "rerender" },
    });
    expect(again.statusCode).toBe(409);
    expect(readdirSync(join(dataDir, "artifacts", runId, "redo"))).toHaveLength(1);
    await app.close();
  });

  it("đọc lại cảnh: run sang producing_assets với một job voice", async () => {
    const { runId } = await seed({ status: "waiting_final_approval", channelName: "Kênh thử" });
    const { app, cookie } = await authedApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${runId}/redo`,
      headers: { cookie },
      payload: { kind: "revoice", sceneId: "giai-thich" },
    });
    expect(res.statusCode).toBe(202);
    expect(await status(runId)).toBe("producing_assets");
    const list = await runJobs(runId);
    expect(list.map((j) => [j.role, j.queue])).toEqual([["voice", "media"]]);
    expect(list[0]?.key.startsWith(`voice:${runId}:approval:`)).toBe(true);
    await app.close();
  });

  it("từ chối cảnh lạ, nền không có trong kho, hình không có trong video", async () => {
    const { runId } = await seed({ status: "waiting_final_approval", channelName: "Kênh thử" });
    const { app, cookie } = await authedApp();
    for (const payload of [
      { kind: "revoice", sceneId: "khong-co" },
      { kind: "background", sceneId: "mo-dau", backgroundId: "bg_khong_ton_tai_xyz" },
      { kind: "regenerate_asset", assetId: "bg_khong_ton_tai_xyz", note: "đẹp hơn" },
    ]) {
      const res = await app.inject({
        method: "POST",
        url: `/api/workflow-runs/${runId}/redo`,
        headers: { cookie },
        payload,
      });
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
    }
    expect(await status(runId)).toBe("waiting_final_approval");
    expect(await runJobs(runId)).toEqual([]);
    await app.close();
  });
});

describe("tên kênh trước lần xuất (ADR-021)", () => {
  it("contracts và seed cùng tên kênh mặc định", () => {
    expect(PLACEHOLDER_CHANNEL_NAME).toBe("Kênh mặc định");
    expect(isChannelNameSet(" Kênh mặc định ")).toBe(false);
    expect(isChannelNameSet("Tí Bit")).toBe(true);
  });

  it("kênh chưa đặt tên: duyệt bản cuối trả 409 kèm lý do, không ghi approval", async () => {
    const { runId, previewId } = await seed({
      status: "waiting_final_approval",
      channelName: PLACEHOLDER_CHANNEL_NAME,
    });
    const { app, cookie } = await authedApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${runId}/approvals`,
      headers: { cookie },
      payload: { gate: "final", decision: "approved", artifactId: previewId },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({
      error: { code: "conflict", details: { reason: "channel_name_required" } },
    });
    const finals = (await db.select().from(approvals)).filter(
      (a) => a.workflowRunId === runId && a.gate === "final",
    );
    expect(finals).toEqual([]);
    expect(await status(runId)).toBe("waiting_final_approval");
    await app.close();
  });
});

describe("kho: dùng trong video nào; ảnh bìa (ADR-021)", () => {
  it("usage liệt kê video có tài sản theo render_props mới nhất", async () => {
    const { runId } = await seed({ status: "exported", channelName: "Kênh thử" });
    const { app, cookie } = await authedApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/motion-assets/usage",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      videos: { workflowRunId: string; exported: boolean }[];
      usage: Record<string, number[]>;
    };
    const index = body.videos.findIndex((v) => v.workflowRunId === runId);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(body.videos[index]?.exported).toBe(true);
    for (const id of [
      "bg_room",
      "cam_static",
      "prop_laptop",
      "skin_ti",
      "action_idle",
      "expr_happy",
    ]) {
      expect(body.usage[id], id).toContain(index);
    }
    await app.close();
  });

  it("ảnh bìa: chỉ file JPEG trong metadata của bản xuất đúng run", async () => {
    const { runId, insert } = await seed({ status: "exported", channelName: "Kênh thử" });
    const key = `artifacts/${runId}/thumbnail-abc.jpg`;
    writeFileSync(join(dataDir, key), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    const good = await insert("export", { thumbnailKey: key });
    const bad = await insert("export", { thumbnailKey: `artifacts/${runId}/render_props.json` });
    const { app, cookie } = await authedApp();
    const ok = await app.inject({
      method: "GET",
      url: `/api/artifacts/${good.id}/thumbnail`,
      headers: { cookie },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.headers["content-type"]).toBe("image/jpeg");
    // Tên file tải về theo chủ đề của brief, không dấu (ADR-027).
    expect(ok.headers["content-disposition"]).toBe('inline; filename="bien-anh-bia.jpg"');
    const rejected = await app.inject({
      method: "GET",
      url: `/api/artifacts/${bad.id}/thumbnail`,
      headers: { cookie },
    });
    expect(rejected.statusCode).toBe(404);
    await app.close();
  });
});
