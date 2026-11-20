import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encryptToken, type YoutubeEnv } from "@studio/config/youtube";
import { youtubeUploadArtifactSchema } from "@studio/contracts";
import {
  agentRuns,
  artifacts,
  createDbConnection,
  createProject,
  deleteProjectCascadeForTests,
  deleteYoutubeConnection,
  getDefaultBrandProfile,
  getYoutubeConnection,
  getYoutubeUpload,
  insertBrief,
  jobs,
  requestYoutubeUpload,
  saveYoutubeConnection,
  updateYoutubeUpload,
  workflowRuns,
  youtubeConnections,
} from "@studio/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createFakeYoutube, type FakeYoutube } from "./fake-youtube.js";
import { startResumableUpload, uploadFile } from "./youtube-client.js";
import { runYoutubeUploadJob } from "./youtube-upload-job.js";

/** ADR-031: job đăng YouTube trên DB test, YouTube giả. */
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio_test";
type Db = ReturnType<typeof createDbConnection>["db"];
let db: Db;
let closeDb: () => Promise<void>;
let dataDir: string;
let brandId: string;
let original: typeof youtubeConnections.$inferSelect | undefined;
const projectIds: string[] = [];
const VIDEO = randomBytes(1000);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), randomBytes(50)]);

const ENV: YoutubeEnv = {
  clientId: "id",
  clientSecret: "secret",
  tokenKey: randomBytes(32),
  redirectUri: "http://127.0.0.1:3001/api/youtube/oauth/callback",
};

const REQUEST = {
  title: "Vì sao đom đóm phát sáng?",
  description: "Mô tả",
  tags: ["đom đóm"],
  privacy: "private" as const,
  madeForKids: false,
  containsSyntheticMedia: false,
  includeThumbnail: true,
};

beforeAll(async () => {
  const conn = createDbConnection(DATABASE_URL);
  db = conn.db;
  closeDb = conn.close;
  dataDir = await mkdtemp(join(tmpdir(), "yt-job-"));
  const brand = await getDefaultBrandProfile(db);
  if (brand === null) throw new Error("no default brand");
  brandId = brand.id;
  original = (await db.select().from(youtubeConnections)).find((r) => r.brandProfileId === brandId);
});

beforeEach(async () => {
  await saveYoutubeConnection(db, {
    brandProfileId: brandId,
    channelId: "UCtest",
    channelTitle: "Tí Hay Hỏi",
    channelThumbnail: null,
    refreshTokenEnc: encryptToken(ENV.tokenKey, "1//refresh", brandId),
    scopes: "s",
  });
});

afterAll(async () => {
  for (const id of projectIds) {
    await deleteProjectCascadeForTests(db, id);
  }
  await deleteYoutubeConnection(db, brandId);
  if (original !== undefined) {
    await db.insert(youtubeConnections).values(original);
  }
  await closeDb();
  await rm(dataDir, { recursive: true, force: true });
});

async function seed(options: { thumbnail?: boolean } = {}) {
  const project = await createProject(db, "ADR-031 worker test");
  projectIds.push(project.id);
  const brief = await insertBrief(db, project.id, {
    topic: "Đom đóm",
    audience: "Mọi người",
    goal: "Hiểu",
    durationSec: 60,
    language: "vi",
    tone: "vui",
    visualStyle: "hoạt hình",
  });
  const [run] = await db
    .insert(workflowRuns)
    .values({ projectId: project.id, briefId: brief.id, status: "exported" })
    .returning();
  if (run === undefined) throw new Error("seed run");
  const videoKey = `artifacts/${run.id}/export.mp4`;
  const thumbKey = `artifacts/${run.id}/thumbnail-abc.jpg`;
  await mkdir(join(dataDir, "artifacts", run.id), { recursive: true });
  await writeFile(join(dataDir, videoKey), VIDEO);
  await writeFile(join(dataDir, thumbKey), JPEG);
  await db.insert(artifacts).values({
    projectId: project.id,
    workflowRunId: run.id,
    type: "export",
    version: 1,
    schemaVersion: "1",
    contentHash: "a".repeat(64),
    storageKey: videoKey,
    metadata: options.thumbnail === false ? {} : { thumbnailKey: thumbKey },
  });
  const queued = await requestYoutubeUpload(db, {
    workflowRunId: run.id,
    nonce: randomUUID(),
    request: REQUEST,
    confirmRepeat: false,
  });
  if (queued.status !== "queued") throw new Error(queued.status);
  return { runId: run.id, uploadId: queued.uploadId, jobId: queued.jobId };
}

const deps = (yt: FakeYoutube) => ({
  dataDir,
  youtube: ENV,
  fetch: yt.fetch,
  sleep: async () => {},
  chunkBytes: 256,
  processing: { timeoutMs: 100, intervalMs: 1 },
});

async function jobRow(jobId: string) {
  const job = (await db.select().from(jobs)).find((j) => j.id === jobId);
  const agent = (await db.select().from(agentRuns)).find((a) => a.id === job?.agentRunId);
  return { job, agent };
}

async function runStatus(runId: string) {
  return (await db.select().from(workflowRuns)).find((r) => r.id === runId)?.status;
}

describe("job đăng YouTube (ADR-031)", () => {
  it("đăng đủ file với đúng ô đã xác nhận, đặt ảnh bìa, ghi artifact; run giữ exported", async () => {
    const yt = createFakeYoutube();
    const { runId, uploadId, jobId } = await seed();
    const result = await runYoutubeUploadJob(db, jobId, deps(yt));
    expect(result).toEqual({ status: "completed", videoId: "vid_ABC123" });
    expect(Buffer.concat(yt.state.uploadedBytes).equals(VIDEO)).toBe(true);
    expect(yt.state.metadata).toMatchObject({
      snippet: { title: REQUEST.title, categoryId: "27", defaultLanguage: "vi" },
      status: {
        privacyStatus: "private",
        selfDeclaredMadeForKids: false,
        containsSyntheticMedia: false,
      },
    });
    expect(yt.state.thumbnails).toBe(1);
    const upload = await getYoutubeUpload(db, uploadId);
    expect(upload).toMatchObject({ videoId: "vid_ABC123", thumbnail: "set", sessionUri: null });
    const art = (await db.select().from(artifacts)).find((a) => a.id === upload?.resultArtifactId);
    expect(art?.type).toBe("youtube_upload");
    const content = youtubeUploadArtifactSchema.parse(
      JSON.parse(await readFile(join(dataDir, art?.storageKey ?? ""), "utf8")),
    );
    expect(content).toMatchObject({
      privacyStatus: "private",
      channelTitle: "Tí Hay Hỏi",
      thumbnail: "set",
      // File giả không đo được: run khung dọc nên là Short, link `/shorts/`.
      isShort: true,
      url: "https://www.youtube.com/shorts/vid_ABC123",
    });
    expect((await jobRow(jobId)).job?.status).toBe("completed");
    expect(await runStatus(runId)).toBe("exported");
  });

  it("worker tắt giữa chừng: chạy lại hỏi phiên cũ, gửi nốt, một phiên, một video", async () => {
    const yt = createFakeYoutube();
    const { runId, uploadId, jobId } = await seed();
    const client = { fetch: yt.fetch, chunkBytes: 256 };
    const session = await startResumableUpload(client, "tok", {} as never, VIDEO.length);
    await updateYoutubeUpload(db, uploadId, { sessionUri: session });
    // Gửi được một khúc, khúc thứ hai đứt mạng, rồi worker tắt trong lúc chờ thử lại.
    yt.faults.networkOnChunk = 2;
    const dying = { ...client, sleep: async () => Promise.reject(new Error("tắt")) };
    const file = join(dataDir, "artifacts", runId, "export.mp4");
    await expect(uploadFile(dying, session, file, VIDEO.length, 0)).rejects.toThrow("tắt");
    expect(yt.state.received).toBe(256);
    const result = await runYoutubeUploadJob(db, jobId, deps(yt));
    expect(result.status).toBe("completed");
    expect(yt.state.sessionsOpened).toBe(1);
    expect(yt.state.videosCreated).toBe(1);
    expect(Buffer.concat(yt.state.uploadedBytes).equals(VIDEO)).toBe(true);
  });

  it("đã có videoId: không upload lại, chỉ đặt ảnh bìa và ghi kết quả", async () => {
    const yt = createFakeYoutube();
    const { uploadId, jobId } = await seed();
    await updateYoutubeUpload(db, uploadId, { videoId: "vid_ABC123" });
    // Worker đọc lại cấu hình mỗi lần job chạy (ADR-031 bổ sung 2026-11-16).
    let reads = 0;
    const result = await runYoutubeUploadJob(db, jobId, {
      ...deps(yt),
      youtube: () => {
        reads += 1;
        return ENV;
      },
    });
    expect(reads).toBe(1);
    expect(result.status).toBe("completed");
    expect(yt.state.sessionsOpened).toBe(0);
    expect(yt.state.uploadedBytes).toHaveLength(0);
    expect(yt.state.thumbnails).toBe(1);
  });

  it("403 ảnh bìa: video vẫn đăng, ảnh bìa failed kèm lý do; bản xuất không có ảnh bìa thì skipped", async () => {
    const yt = createFakeYoutube();
    yt.faults.thumbnailError = { status: 403, reason: "forbidden" };
    const first = await seed();
    expect((await runYoutubeUploadJob(db, first.jobId, deps(yt))).status).toBe("completed");
    const upload = await getYoutubeUpload(db, first.uploadId);
    expect(upload?.thumbnail).toBe("failed");
    expect(upload?.thumbnailReason).toContain("xác minh");

    const yt2 = createFakeYoutube();
    const second = await seed({ thumbnail: false });
    expect((await runYoutubeUploadJob(db, second.jobId, deps(yt2))).status).toBe("completed");
    expect((await getYoutubeUpload(db, second.uploadId))?.thumbnail).toBe("skipped");
  });

  it("hết hạn mức: failed youtube_quota, không thử lại; run giữ exported", async () => {
    const yt = createFakeYoutube();
    yt.faults.startError = { status: 403, reason: "uploadLimitExceeded" };
    const { runId, jobId } = await seed();
    expect(await runYoutubeUploadJob(db, jobId, deps(yt))).toEqual({
      status: "failed",
      errorCode: "youtube_quota",
    });
    const { job, agent } = await jobRow(jobId);
    expect(job?.status).toBe("failed");
    expect(agent?.errorMessage).toContain("hạn mức");
    expect(await runStatus(runId)).toBe("exported");
  });

  it("Google từ chối refresh token: youtube_auth, kết nối ghi 'Cần kết nối lại'", async () => {
    const yt = createFakeYoutube();
    yt.faults.tokenError = "invalid_grant";
    const { jobId } = await seed();
    expect(await runYoutubeUploadJob(db, jobId, deps(yt))).toEqual({
      status: "failed",
      errorCode: "youtube_auth",
    });
    expect((await getYoutubeConnection(db, brandId))?.lastError).toContain("kết nối lại");
    expect(yt.state.sessionsOpened).toBe(0);
  });

  it("lỗi mạng kéo dài: ném ra để BullMQ thử lại, URI phiên còn lưu", async () => {
    const yt = createFakeYoutube();
    const { uploadId, jobId } = await seed();
    const flaky = {
      ...yt,
      fetch: async (url: string, init: RequestInit) => {
        if (
          init.method === "PUT" &&
          !String(new Headers(init.headers).get("content-range")).startsWith("bytes */")
        ) {
          throw new TypeError("fetch failed");
        }
        return yt.fetch(url, init);
      },
    };
    await expect(runYoutubeUploadJob(db, jobId, deps(flaky as FakeYoutube))).rejects.toBeTruthy();
    expect((await getYoutubeUpload(db, uploadId))?.sessionUri).toMatch(
      /^https:\/\/www\.googleapis\.com\//,
    );
    // Lần thử lại của BullMQ: job còn running, nhận lại được và gửi tiếp trên cùng phiên.
    const result = await runYoutubeUploadJob(db, jobId, deps(yt));
    expect(result.status).toBe("completed");
    expect(yt.state.sessionsOpened).toBe(1);
    expect(yt.state.videosCreated).toBe(1);
  });
});
