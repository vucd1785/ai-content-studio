import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { videoLibraryResponseSchema } from "@studio/contracts";
import {
  agentRuns,
  artifactDependencies,
  artifacts,
  createDbConnection,
  createProject,
  deleteProjectCascadeForTests,
  getDefaultBrandProfile,
  insertBrief,
  jobs,
  workflowRuns,
  youtubeUploads,
} from "@studio/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

/** P8-08: màn Video chỉ đọc, gom bản xuất của mọi dự án. */
const TEST_PASSWORD = "director-test-password";
const TEST_SECRET = "0123456789abcdef0123456789abcdef0123456789ab";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";

type Db = ReturnType<typeof createDbConnection>["db"];
let db: Db;
let closeDb: () => Promise<void>;
let dataDir: string;
const projectIds: string[] = [];

beforeAll(async () => {
  const conn = createDbConnection(DATABASE_URL);
  db = conn.db;
  closeDb = conn.close;
  dataDir = await mkdtemp(join(tmpdir(), "videos-"));
});

afterAll(async () => {
  for (const id of projectIds) {
    await deleteProjectCascadeForTests(db, id);
  }
  await closeDb();
  await rm(dataDir, { recursive: true, force: true });
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

async function artifact(
  projectId: string,
  runId: string,
  type: "render_props" | "preview" | "export" | "youtube_upload",
  storageKey: string,
  metadata: Record<string, unknown> = {},
  version = 1,
) {
  const [row] = await db
    .insert(artifacts)
    .values({
      projectId,
      workflowRunId: runId,
      type,
      version,
      schemaVersion: "1",
      contentHash: "a".repeat(64),
      storageKey,
      metadata,
    })
    .returning();
  if (row === undefined) throw new Error("seed artifact");
  return row;
}

/** Run đã xuất: render_props → preview → export (có thể hai bản xuất). */
async function seedExported(opts: {
  title: string;
  topic: string;
  aspectRatio: "9:16" | "16:9";
  width: number;
  height: number;
  durationMs: number;
  exports?: number;
}) {
  const project = await createProject(db, opts.title);
  projectIds.push(project.id);
  const brief = await insertBrief(db, project.id, {
    topic: opts.topic,
    audience: "Mọi người",
    goal: "Hiểu",
    durationSec: 60,
    language: "vi",
    tone: "vui",
    visualStyle: "hoạt hình",
  });
  const [run] = await db
    .insert(workflowRuns)
    .values({
      projectId: project.id,
      briefId: brief.id,
      status: "exported",
      aspectRatio: opts.aspectRatio,
    })
    .returning();
  if (run === undefined) throw new Error("seed run");
  const propsKey = `artifacts/${run.id}/render-props.json`;
  await mkdir(join(dataDir, "artifacts", run.id), { recursive: true });
  await writeFile(
    join(dataDir, propsKey),
    JSON.stringify({
      width: opts.width,
      height: opts.height,
      audio: { durationMs: opts.durationMs },
    }),
  );
  const props = await artifact(project.id, run.id, "render_props", propsKey);
  const preview = await artifact(project.id, run.id, "preview", `artifacts/${run.id}/p.mp4`);
  await db
    .insert(artifactDependencies)
    .values({ artifactId: preview.id, parentArtifactId: props.id });
  const exportIds: string[] = [];
  for (let v = 1; v <= (opts.exports ?? 1); v += 1) {
    const exported = await artifact(
      project.id,
      run.id,
      "export",
      `artifacts/${run.id}/export-${v}.mp4`,
      { thumbnailKey: `artifacts/${run.id}/thumbnail-${v}.jpg` },
      v,
    );
    await db
      .insert(artifactDependencies)
      .values({ artifactId: exported.id, parentArtifactId: preview.id });
    exportIds.push(exported.id);
  }
  return { projectId: project.id, runId: run.id, exportIds };
}

describe("GET /api/videos (P8-08)", () => {
  it("cần đăng nhập", async () => {
    const app = await buildApp({
      password: TEST_PASSWORD,
      sessionSecret: TEST_SECRET,
      nowSeconds: 1_700_000_000,
      enableLogger: false,
      projects: { db, dataDir },
    });
    expect((await app.inject({ method: "GET", url: "/api/videos" })).statusCode).toBe(401);
    await app.close();
  });

  it("bản xuất mới nhất mỗi run, khung và thời lượng từ render props, link Short theo khung", async () => {
    const tall = await seedExported({
      title: "Dự án dọc",
      topic: "Trái Đất ngừng quay",
      aspectRatio: "9:16",
      width: 1080,
      height: 1920,
      durationMs: 68_030,
      exports: 2,
    });
    const wide = await seedExported({
      title: "Dự án ngang",
      topic: "Cờ các nước",
      aspectRatio: "16:9",
      width: 1920,
      height: 1080,
      durationMs: 240_000,
    });
    // Bản xuất thứ hai của run dọc đã đăng YouTube.
    const brand = await getDefaultBrandProfile(db);
    if (brand === null) throw new Error("no brand");
    const [agent] = await db
      .insert(agentRuns)
      .values({ workflowRunId: tall.runId, role: "publish", status: "completed" })
      .returning();
    if (agent === undefined) throw new Error("seed agent");
    const [job] = await db
      .insert(jobs)
      .values({
        agentRunId: agent.id,
        queue: "upload",
        idempotencyKey: `youtube:${tall.exportIds[1]}:test`,
        status: "completed",
      })
      .returning();
    if (job === undefined) throw new Error("seed job");
    const result = await artifact(
      tall.projectId,
      tall.runId,
      "youtube_upload",
      `artifacts/${tall.runId}/yt.json`,
      { privacyStatus: "public", publishAt: null, isShort: true },
    );
    await db.insert(youtubeUploads).values({
      jobId: job.id,
      workflowRunId: tall.runId,
      exportArtifactId: tall.exportIds[1] ?? "",
      brandProfileId: brand.id,
      request: {},
      videoId: "B2_fwhKvE4o",
      resultArtifactId: result.id,
    });

    const { app, cookie } = await authedApp();
    const res = await app.inject({ method: "GET", url: "/api/videos", headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const body = videoLibraryResponseSchema.parse(res.json());
    const mine = body.videos.filter((v) => [tall.runId, wide.runId].includes(v.workflowRunId));
    expect(mine).toHaveLength(2);
    // Mới nhất trước: run ngang được tạo sau.
    expect(mine[0]?.workflowRunId).toBe(wide.runId);
    expect(mine[0]).toMatchObject({
      projectTitle: "Dự án ngang",
      topic: "Cờ các nước",
      aspectRatio: "16:9",
      width: 1920,
      height: 1080,
      durationSec: 240,
      isShort: false,
      hasThumbnail: true,
      youtube: null,
    });
    expect(mine[1]).toMatchObject({
      exportArtifactId: tall.exportIds[1],
      topic: "Trái Đất ngừng quay",
      durationSec: 68,
      isShort: true,
      youtube: {
        status: "completed",
        videoId: "B2_fwhKvE4o",
        url: "https://www.youtube.com/shorts/B2_fwhKvE4o",
        privacyStatus: "public",
      },
    });
    await app.close();
  });
});
