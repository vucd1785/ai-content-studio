import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { artifactDetailResponseSchema } from "@studio/contracts";
import {
  artifacts,
  createDbConnection,
  createProject,
  deleteProjectCascadeForTests,
  insertBrief,
  workflowRuns,
} from "@studio/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

const TEST_PASSWORD = "director-test-password";
const TEST_SECRET = "0123456789abcdef0123456789abcdef0123456789ab";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";

type Db = ReturnType<typeof createDbConnection>["db"];
type ArtifactType = (typeof artifacts.$inferSelect)["type"];

let db: Db;
let closeDb: () => Promise<void>;
let dataDir = "";
const createdProjectIds: string[] = [];
/** File test ghi ngoài `dataDir` (ca thoát volume); xóa trong `afterAll` kể cả khi test fail. */
const outsideFiles: string[] = [];

async function seedArtifact(type: ArtifactType, content: string | null) {
  const project = await createProject(db, "P3-04 artifact route test");
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
    .values({ projectId: project.id, briefId: brief.id, status: "waiting_script_approval" })
    .returning();
  const storageKey = `artifacts/${run?.id}/${type}-${randomUUID()}.json`;
  if (content !== null) {
    await mkdir(join(dataDir, "artifacts", run?.id ?? ""), { recursive: true });
    await writeFile(join(dataDir, storageKey), content, "utf8");
  }
  const [row] = await db
    .insert(artifacts)
    .values({
      projectId: project.id,
      workflowRunId: run?.id ?? "",
      type,
      version: 1,
      schemaVersion: "1",
      contentHash: "c".repeat(64),
      storageKey,
      metadata: { jobId: "j-1" },
    })
    .returning();
  if (row === undefined) {
    throw new Error("seed artifact failed");
  }
  return row;
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

beforeAll(async () => {
  const conn = createDbConnection(DATABASE_URL);
  db = conn.db;
  closeDb = conn.close;
  dataDir = await mkdtemp(join(tmpdir(), "studio-p3-04-api-"));
});

afterAll(async () => {
  for (const id of createdProjectIds) {
    await deleteProjectCascadeForTests(db, id);
  }
  await closeDb();
  for (const file of outsideFiles) {
    await rm(file, { force: true });
  }
  await rm(dataDir, { recursive: true, force: true });
});

describe("GET /api/artifacts/:artifactId", () => {
  it("artifact JSON trả nội dung đã lưu và metadata, không lộ storage_key", async () => {
    const stored = { variants: [{ title: "A" }, { title: "B" }] };
    const row = await seedArtifact("script", JSON.stringify(stored));
    const { app, cookie } = await authedApp();
    const response = await app.inject({
      method: "GET",
      url: `/api/artifacts/${row.id}`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    const body = artifactDetailResponseSchema.parse(response.json());
    expect(body.content).toEqual(stored);
    expect(body.artifact).toMatchObject({
      id: row.id,
      workflowRunId: row.workflowRunId,
      type: "script",
      version: 1,
      schemaVersion: "1",
      metadata: { jobId: "j-1" },
    });
    expect(response.body).not.toContain("storageKey");
    expect(response.body).not.toContain(row.storageKey);
    await app.close();
  });

  it("artifact media chỉ trả metadata, content null, không đọc file", async () => {
    const row = await seedArtifact("preview", null);
    const { app, cookie } = await authedApp();
    const response = await app.inject({
      method: "GET",
      url: `/api/artifacts/${row.id}`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    expect(artifactDetailResponseSchema.parse(response.json()).content).toBeNull();
    await app.close();
  });

  it("file thiếu hoặc JSON hỏng: 404; id lạ 404; id sai 400; thiếu session 401", async () => {
    const missing = await seedArtifact("script", null);
    const broken = await seedArtifact("research", "{ hỏng");
    const { app, cookie } = await authedApp();
    for (const id of [missing.id, broken.id, randomUUID()]) {
      const response = await app.inject({
        method: "GET",
        url: `/api/artifacts/${id}`,
        headers: { cookie },
      });
      expect(response.statusCode, id).toBe(404);
      expect(response.json().error.code).toBe("not_found");
    }
    const bad = await app.inject({
      method: "GET",
      url: "/api/artifacts/not-a-uuid",
      headers: { cookie },
    });
    expect(bad.statusCode).toBe(400);
    const noSession = await app.inject({ method: "GET", url: `/api/artifacts/${missing.id}` });
    expect(noSession.statusCode).toBe(401);
    await app.close();
  });
});

/** Hàng artifact trỏ tới `storageKey` cho trước; file (nếu có) ghi tương đối với `dataDir`. */
async function seedMedia(
  type: ArtifactType,
  storageKey: string,
  files: Record<string, Buffer | string> = {},
) {
  for (const [key, bytes] of Object.entries(files)) {
    await mkdir(dirname(join(dataDir, key)), { recursive: true });
    await writeFile(join(dataDir, key), bytes);
  }
  const row = await seedArtifact("script", null);
  const [media] = await db
    .insert(artifacts)
    .values({
      projectId: row.projectId,
      workflowRunId: row.workflowRunId,
      type,
      version: 1,
      schemaVersion: "1",
      contentHash: "d".repeat(64),
      storageKey,
    })
    .returning();
  return media?.id ?? "";
}

describe("GET /api/artifacts/:artifactId/stills/:variantIndex/:sceneId (P6-17)", () => {
  it("trả PNG có tên trong storyboard schema 2; cảnh lạ, khóa ngoài thư mục storyboard, artifact khác thì 404", async () => {
    const script = await seedArtifact("script", null);
    const runId = script.workflowRunId;
    const stillKey = `artifacts/${runId}/storyboard/v1-mo-dau.png`;
    const png = Buffer.from("PNGDATA");
    await mkdir(dirname(join(dataDir, stillKey)), { recursive: true });
    await writeFile(join(dataDir, stillKey), png);
    const outsideKey = `artifacts/${runId}/script-x.png`;
    await writeFile(join(dataDir, outsideKey), png);
    const boardKey = `artifacts/${runId}/storyboard-${randomUUID()}.json`;
    await writeFile(
      join(dataDir, boardKey),
      JSON.stringify({
        schemaVersion: 2,
        variants: [
          {
            variantIndex: 1,
            scenes: [
              { sceneId: "mo-dau", stillKey, issues: [] },
              { sceneId: "lech", stillKey: outsideKey, issues: [] },
            ],
          },
        ],
        errors: [],
      }),
    );
    const [board] = await db
      .insert(artifacts)
      .values({
        projectId: script.projectId,
        workflowRunId: runId,
        type: "storyboard",
        version: 1,
        schemaVersion: "2",
        contentHash: "e".repeat(64),
        storageKey: boardKey,
      })
      .returning();
    const { app, cookie } = await authedApp();
    const get = (url: string) => app.inject({ method: "GET", url, headers: { cookie } });
    const ok = await get(`/api/artifacts/${board?.id}/stills/1/mo-dau`);
    expect(ok.statusCode).toBe(200);
    expect(ok.headers["content-type"]).toBe("image/png");
    expect(ok.rawPayload.equals(png)).toBe(true);
    expect((await get(`/api/artifacts/${board?.id}/stills/2/mo-dau`)).statusCode).toBe(404);
    expect((await get(`/api/artifacts/${board?.id}/stills/1/lech`)).statusCode).toBe(404);
    expect((await get(`/api/artifacts/${script.id}/stills/1/mo-dau`)).statusCode).toBe(404);
    expect((await get(`/api/artifacts/${board?.id}/stills/1/..%2F..`)).statusCode).toBe(400);
    const noSession = await app.inject({
      method: "GET",
      url: `/api/artifacts/${board?.id}/stills/1/mo-dau`,
    });
    expect(noSession.statusCode).toBe(401);
    await app.close();
  });
});

describe("GET /api/artifacts/:artifactId/media", () => {
  const MP4 = Buffer.from("0123456789abcdef");

  it("preview: stream MP4 cả file, Range một khoảng trả 206, khoảng ngoài file trả 416", async () => {
    const key = `render/cache/StickStory/p2-09-${randomUUID()}.mp4`;
    const id = await seedMedia("preview", key, { [key]: MP4 });
    const { app, cookie } = await authedApp();
    const full = await app.inject({
      method: "GET",
      url: `/api/artifacts/${id}/media`,
      headers: { cookie },
    });
    expect(full.statusCode).toBe(200);
    expect(full.headers["content-type"]).toBe("video/mp4");
    expect(full.headers["accept-ranges"]).toBe("bytes");
    expect(full.headers["content-length"]).toBe(String(MP4.length));
    // Tên file tải về theo chủ đề của brief, không dấu; bản xem trước có hậu tố riêng.
    expect(full.headers["content-disposition"]).toBe('inline; filename="redis-ban-xem-truoc.mp4"');
    expect(full.rawPayload.equals(MP4)).toBe(true);

    const part = await app.inject({
      method: "GET",
      url: `/api/artifacts/${id}/media`,
      headers: { cookie, range: "bytes=2-5" },
    });
    expect(part.statusCode).toBe(206);
    expect(part.headers["content-range"]).toBe(`bytes 2-5/${MP4.length}`);
    expect(part.body).toBe("2345");
    const tail = await app.inject({
      method: "GET",
      url: `/api/artifacts/${id}/media`,
      headers: { cookie, range: "bytes=-3" },
    });
    expect(tail.body).toBe("def");

    const outside = await app.inject({
      method: "GET",
      url: `/api/artifacts/${id}/media`,
      headers: { cookie, range: "bytes=99-" },
    });
    expect(outside.statusCode).toBe(416);
    expect(outside.headers["content-range"]).toBe(`bytes */${MP4.length}`);

    const head = await app.inject({
      method: "HEAD",
      url: `/api/artifacts/${id}/media`,
      headers: { cookie },
    });
    expect(head.statusCode).toBe(200);
    expect(head.headers["content-type"]).toBe("video/mp4");
    await app.close();
  });

  it("render_props: khóa audio do worker ghi tương đối với render/public vẫn phát được (player có tiếng)", async () => {
    const publicKey = `pipeline/edu-${randomUUID().slice(0, 16)}.wav`;
    const propsKey = `artifacts/p6-17/${randomUUID()}.json`;
    const id = await seedMedia("render_props", propsKey, {
      [`render/public/${publicKey}`]: "RIFFpublic",
      [propsKey]: JSON.stringify({ audio: { storageKey: publicKey, durationMs: 1000 } }),
    });
    const { app, cookie } = await authedApp();
    const response = await app.inject({
      method: "GET",
      url: `/api/artifacts/${id}/media`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("audio/wav");
    expect(response.body).toBe("RIFFpublic");
    await app.close();
  });

  it("render_props: stream WAV ở audio.storageKey của props", async () => {
    const wavKey = `render/public/p2-09-${randomUUID()}.wav`;
    const propsKey = `artifacts/p2-09/${randomUUID()}.json`;
    const id = await seedMedia("render_props", propsKey, {
      [wavKey]: "RIFFwav",
      [propsKey]: JSON.stringify({ audio: { storageKey: wavKey, durationMs: 1000 } }),
    });
    const { app, cookie } = await authedApp();
    const response = await app.inject({
      method: "GET",
      url: `/api/artifacts/${id}/media`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("audio/wav");
    expect(response.body).toBe("RIFFwav");
    await app.close();
  });

  it("key thoát volume, đuôi không phải media, artifact không có file media, file thiếu: đều 404", async () => {
    // File thật nằm ngoài dataDir. Hàng artifact không thể có `storage_key` chứa `..` (CHECK
    // `artifacts_storage_key_safe`), nhưng `audio.storageKey` bên trong props thì DB không kiểm: route phải chặn.
    const outsideName = `p2-09-outside-${randomUUID()}.wav`;
    outsideFiles.push(join(dataDir, "..", outsideName));
    await writeFile(join(dataDir, "..", outsideName), "RIFFoutside");
    const jsonKey = `artifacts/p2-09/${randomUUID()}.json`;
    const notMedia = await seedMedia("preview", jsonKey, { [jsonKey]: "{}" });
    const manifestKey = `artifacts/p2-09/${randomUUID()}.json`;
    const manifest = await seedMedia("audio", manifestKey, { [manifestKey]: "{}" });
    const propsKey = `artifacts/p2-09/${randomUUID()}.json`;
    const propsEscape = await seedMedia("render_props", propsKey, {
      [propsKey]: JSON.stringify({ audio: { storageKey: `../${outsideName}` } }),
    });
    const script = await seedMedia("script", jsonKey);
    const missing = await seedMedia(
      "export",
      `render/cache/StickStory/missing-${randomUUID()}.mp4`,
    );
    const { app, cookie } = await authedApp();
    for (const id of [notMedia, manifest, propsEscape, script, missing, randomUUID()]) {
      const response = await app.inject({
        method: "GET",
        url: `/api/artifacts/${id}/media`,
        headers: { cookie },
      });
      expect(response.statusCode, id).toBe(404);
      expect(response.body).not.toContain("outside");
    }
    const noSession = await app.inject({ method: "GET", url: `/api/artifacts/${notMedia}/media` });
    expect(noSession.statusCode).toBe(401);
    await app.close();
  });
});
