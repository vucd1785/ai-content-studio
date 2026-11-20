import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  decryptToken,
  type GoogleFetch,
  readEnvFile,
  type YoutubeEnv,
} from "@studio/config/youtube";
import {
  agentRuns,
  artifacts,
  createDbConnection,
  createProject,
  deleteProjectCascadeForTests,
  deleteYoutubeConnection,
  getDefaultBrandProfile,
  insertBrief,
  jobs,
  markJobStatusForTests,
  updateYoutubeUpload,
  workflowRuns,
  youtubeConnections,
  youtubeUploads,
} from "@studio/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, redactOauthQuery } from "../app.js";

/** ADR-031: kết nối kênh YouTube và nút "Đăng". Google là bản giả; không gọi mạng. */
const TEST_PASSWORD = "director-test-password";
const TEST_SECRET = "0123456789abcdef0123456789abcdef0123456789ab";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";
const REFRESH = "1//refresh-token-that-must-not-leak";

type Db = ReturnType<typeof createDbConnection>["db"];
let db: Db;
let closeDb: () => Promise<void>;
let brandId: string;
/** Kết nối thật của Director (nếu có) được giữ lại và trả về sau test. */
let original: typeof youtubeConnections.$inferSelect | undefined;
const projectIds: string[] = [];

const ENV: YoutubeEnv = {
  clientId: "client-id.apps.googleusercontent.com",
  clientSecret: "client-secret",
  tokenKey: randomBytes(32),
  redirectUri: "http://127.0.0.1:3001/api/youtube/oauth/callback",
};

const calls: { url: string; body: string }[] = [];
const fakeGoogle: GoogleFetch = async (url, init) => {
  calls.push({ url, body: String(init.body ?? "") });
  if (url.startsWith("https://oauth2.googleapis.com/token")) {
    const body = new URLSearchParams(String(init.body));
    if (body.get("code") !== "good-code" || (body.get("code_verifier") ?? "").length < 43) {
      return Response.json({ error: "invalid_grant" }, { status: 400 });
    }
    return Response.json({ access_token: "ya29.access", refresh_token: REFRESH, scope: "a b" });
  }
  if (url.startsWith("https://www.googleapis.com/youtube/v3/channels")) {
    return Response.json({
      items: [
        {
          id: "UCtest",
          snippet: {
            title: "Tí Hay Hỏi",
            thumbnails: { default: { url: "https://yt3.ggpht.com/abc=s88" } },
          },
        },
      ],
    });
  }
  if (url.startsWith("https://oauth2.googleapis.com/revoke")) {
    return new Response("", { status: 200 });
  }
  return new Response("not found", { status: 404 });
};

beforeAll(async () => {
  const conn = createDbConnection(DATABASE_URL);
  db = conn.db;
  closeDb = conn.close;
  const brand = await getDefaultBrandProfile(db);
  if (brand === null) throw new Error("no default brand");
  brandId = brand.id;
  [original] = (await db.select().from(youtubeConnections)).filter(
    (r) => r.brandProfileId === brandId,
  );
  await deleteYoutubeConnection(db, brandId);
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
});

async function authedApp(
  options: { configured?: boolean; now?: () => number; envFile?: string } = {},
) {
  const app = await buildApp({
    password: TEST_PASSWORD,
    sessionSecret: TEST_SECRET,
    nowSeconds: 1_700_000_000,
    enableLogger: false,
    projects: { db, dataDir: "." },
    youtube: {
      youtube: options.configured === false ? null : ENV,
      fetch: fakeGoogle,
      ...(options.now === undefined ? {} : { now: options.now }),
      ...(options.envFile === undefined ? {} : { envFile: options.envFile }),
    },
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

async function seedRun(status: "exported" | "qa") {
  const project = await createProject(db, "ADR-031 test");
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
    .values({ projectId: project.id, briefId: brief.id, status })
    .returning();
  if (run === undefined) throw new Error("seed run");
  const [exported] = await db
    .insert(artifacts)
    .values({
      projectId: project.id,
      workflowRunId: run.id,
      type: "export",
      version: 1,
      schemaVersion: "1",
      contentHash: "a".repeat(64),
      storageKey: `artifacts/${run.id}/export.mp4`,
      metadata: {},
    })
    .returning();
  if (exported === undefined) throw new Error("seed export");
  return { runId: run.id, exportId: exported.id };
}

const UPLOAD = {
  title: "Vì sao đom đóm phát sáng?",
  description: "Mô tả có liên hệ lienhe@example.com",
  tags: ["đom đóm", "khoa học"],
  privacy: "private",
  madeForKids: false,
  containsSyntheticMedia: false,
  includeThumbnail: true,
};

async function connect(app: Awaited<ReturnType<typeof authedApp>>["app"], cookie: string) {
  const start = await app.inject({
    method: "POST",
    url: "/api/youtube/oauth/start",
    headers: { cookie },
  });
  expect(start.statusCode).toBe(200);
  const authUrl = new URL(start.json().authUrl as string);
  return authUrl;
}

describe("kết nối YouTube (ADR-031)", () => {
  it("chưa cấu hình: trạng thái configured=false và không bắt đầu đăng nhập được", async () => {
    const { app, cookie } = await authedApp({ configured: false });
    const status = await app.inject({
      method: "GET",
      url: "/api/youtube/connection",
      headers: { cookie },
    });
    expect(status.json()).toMatchObject({ configured: false, connected: false });
    const start = await app.inject({
      method: "POST",
      url: "/api/youtube/oauth/start",
      headers: { cookie },
    });
    expect(start.statusCode).toBe(409);
  });

  it("bắt đầu đăng nhập cần phiên Director", async () => {
    const { app } = await authedApp();
    const start = await app.inject({
      method: "POST",
      url: "/api/youtube/oauth/start",
      headers: { origin: "http://localhost:5173" },
    });
    expect(start.statusCode).toBe(401);
  });

  it("URL đăng nhập có PKCE S256, state, scope tối thiểu; callback lưu token mã hóa; state dùng một lần", async () => {
    const { app, cookie } = await authedApp();
    const authUrl = await connect(app, cookie);
    expect(authUrl.origin).toBe("https://accounts.google.com");
    expect(authUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authUrl.searchParams.get("redirect_uri")).toBe(ENV.redirectUri);
    expect(authUrl.searchParams.get("scope")?.split(" ").sort()).toEqual([
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/youtube.upload",
    ]);
    const state = authUrl.searchParams.get("state") ?? "";
    expect(state.length).toBeGreaterThanOrEqual(40);

    const wrong = await app.inject({
      method: "GET",
      url: `/api/youtube/oauth/callback?state=sai&code=good-code`,
    });
    expect(wrong.statusCode).toBe(400);

    // Callback không cần cookie (Google chuyển về host của API).
    const ok = await app.inject({
      method: "GET",
      url: `/api/youtube/oauth/callback?state=${state}&code=good-code`,
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.headers["content-security-policy"]).toBe(
      "default-src 'none'; style-src 'unsafe-inline'",
    );
    expect(ok.body).toContain("Tí Hay Hỏi");
    expect(ok.body).not.toContain(REFRESH);

    const [row] = (await db.select().from(youtubeConnections)).filter(
      (r) => r.brandProfileId === brandId,
    );
    expect(row?.channelId).toBe("UCtest");
    expect(row?.refreshTokenEnc).not.toContain(REFRESH);
    expect(decryptToken(ENV.tokenKey, row?.refreshTokenEnc ?? "", brandId)).toBe(REFRESH);
    // Gắn với kênh: đổi AAD thì không giải mã được.
    expect(() => decryptToken(ENV.tokenKey, row?.refreshTokenEnc ?? "", "khac")).toThrow();

    const again = await app.inject({
      method: "GET",
      url: `/api/youtube/oauth/callback?state=${state}&code=good-code`,
    });
    expect(again.statusCode).toBe(400);

    const status = await app.inject({
      method: "GET",
      url: "/api/youtube/connection",
      headers: { cookie },
    });
    const body = status.json();
    expect(body).toMatchObject({ configured: true, connected: true, channelTitle: "Tí Hay Hỏi" });
    expect(JSON.stringify(body)).not.toContain(REFRESH);
  });

  it("state quá 10 phút bị từ chối; code sai báo lỗi, không lưu", async () => {
    let t = 1_000_000;
    const { app, cookie } = await authedApp({ now: () => t });
    const old = (await connect(app, cookie)).searchParams.get("state");
    t += 10 * 60 * 1000 + 1;
    const late = await app.inject({
      method: "GET",
      url: `/api/youtube/oauth/callback?state=${old}&code=good-code`,
    });
    expect(late.statusCode).toBe(400);

    const fresh = (await connect(app, cookie)).searchParams.get("state");
    const bad = await app.inject({
      method: "GET",
      url: `/api/youtube/oauth/callback?state=${fresh}&code=bad-code`,
    });
    expect(bad.statusCode).toBe(502);
    expect(bad.body).toContain("hết hạn");
  });

  it("log không giữ code và state của callback", () => {
    expect(redactOauthQuery("/api/youtube/oauth/callback?state=s&code=c")).toBe(
      "/api/youtube/oauth/callback?[REDACTED]",
    );
    expect(redactOauthQuery("/api/projects?x=1")).toBe("/api/projects?x=1");
  });
});

describe("đăng YouTube (ADR-031)", () => {
  it("409 khi chưa xuất, thiếu kết nối, mô tả còn dòng nhắc liên hệ; 202 tạo job upload; đã đăng cần xác nhận lần hai", async () => {
    const { app, cookie } = await authedApp();
    await deleteYoutubeConnection(db, brandId);

    const early = await seedRun("qa");
    const notExported = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${early.runId}/youtube-uploads`,
      headers: { cookie },
      payload: UPLOAD,
    });
    expect(notExported.statusCode).toBe(409);

    const { runId, exportId } = await seedRun("exported");
    const url = `/api/workflow-runs/${runId}/youtube-uploads`;
    const noConnection = await app.inject({
      method: "POST",
      url,
      headers: { cookie },
      payload: UPLOAD,
    });
    expect(noConnection.statusCode).toBe(409);
    expect(noConnection.json().error.message).toContain("Chưa kết nối");

    const state = (await connect(app, cookie)).searchParams.get("state");
    await app.inject({
      method: "GET",
      url: `/api/youtube/oauth/callback?state=${state}&code=good-code`,
    });

    const missing = await app.inject({
      method: "POST",
      url,
      headers: { cookie },
      payload: {
        ...UPLOAD,
        description: "[CHƯA CÓ LIÊN HỆ - điền ở Bộ nhận diện kênh rồi tạo lại]",
      },
    });
    expect(missing.statusCode).toBe(409);

    const noKids = await app.inject({
      method: "POST",
      url,
      headers: { cookie },
      payload: { ...UPLOAD, madeForKids: undefined },
    });
    expect(noKids.statusCode).toBe(400);

    const first = await app.inject({ method: "POST", url, headers: { cookie }, payload: UPLOAD });
    expect(first.statusCode).toBe(202);
    const uploadId = first.json().uploadId as string;
    const upload = (await db.select().from(youtubeUploads)).find((r) => r.id === uploadId);
    expect(upload?.exportArtifactId).toBe(exportId);
    expect(upload?.request).toMatchObject({ title: UPLOAD.title, madeForKids: false });
    const job = (await db.select().from(jobs)).find((r) => r.id === upload?.jobId);
    expect(job).toMatchObject({ queue: "upload", status: "queued" });
    expect(job?.idempotencyKey).toMatch(new RegExp(`^youtube:${exportId}:`));
    const agent = (await db.select().from(agentRuns)).find((r) => r.id === job?.agentRunId);
    expect(agent?.role).toBe("publish");

    const busy = await app.inject({ method: "POST", url, headers: { cookie }, payload: UPLOAD });
    expect(busy.statusCode).toBe(409);

    // Worker đăng xong.
    await markJobStatusForTests(db, job?.id ?? "", "completed");
    await updateYoutubeUpload(db, uploadId, { videoId: "dQw4w9WgXcQ" });

    const list = await app.inject({ method: "GET", url, headers: { cookie } });
    expect(list.json()).toMatchObject({
      busy: false,
      uploads: [
        {
          id: uploadId,
          url: "https://www.youtube.com/shorts/dQw4w9WgXcQ",
          isShort: true,
          title: UPLOAD.title,
        },
      ],
    });

    const repeat = await app.inject({ method: "POST", url, headers: { cookie }, payload: UPLOAD });
    expect(repeat.statusCode).toBe(409);
    expect(repeat.json().error.message).toContain("đã đăng");
    const confirmed = await app.inject({
      method: "POST",
      url,
      headers: { cookie },
      payload: { ...UPLOAD, confirmRepeat: true },
    });
    expect(confirmed.statusCode).toBe(202);

    const run = (await db.select().from(workflowRuns)).find((r) => r.id === runId);
    expect(run?.status).toBe("exported");
  });

  it("ngắt kết nối xóa token và thu hồi ở Google", async () => {
    const { app, cookie } = await authedApp();
    const state = (await connect(app, cookie)).searchParams.get("state");
    await app.inject({
      method: "GET",
      url: `/api/youtube/oauth/callback?state=${state}&code=good-code`,
    });
    calls.length = 0;
    const del = await app.inject({
      method: "DELETE",
      url: "/api/youtube/connection",
      headers: { cookie, origin: "http://localhost:5173" },
    });
    expect(del.statusCode).toBe(200);
    expect(del.json()).toMatchObject({ connected: false });
    expect(
      calls.some(
        (c) =>
          c.url.startsWith("https://oauth2.googleapis.com/revoke") &&
          c.body.includes("refresh-token"),
      ),
    ).toBe(true);
  });
});

describe("cấu hình OAuth từ giao diện (ADR-031 bổ sung 2026-11-16)", () => {
  const CLIENT_ID = "123456789012-abcdefghijklmnop.apps.googleusercontent.com";
  const SECRET = "GOCSPX-abcdefghijklmnop";

  it("ghi Client ID, secret vào .env, tự tạo khóa một lần, không trả secret; dùng được ngay không cần khởi động lại", async () => {
    const dir = await mkdtemp(join(tmpdir(), "yt-env-"));
    const envFile = join(dir, ".env");
    await writeFile(envFile, "STUDIO_PASSWORD=giu-nguyen\n");
    const { app, cookie } = await authedApp({ configured: false, envFile });
    const headers = { cookie, origin: "http://localhost:5173" };

    const before = await app.inject({ method: "GET", url: "/api/youtube/connection", headers });
    expect(before.json()).toMatchObject({
      configured: false,
      clientIdHint: null,
      hasClientSecret: false,
    });

    const noSecret = await app.inject({
      method: "PUT",
      url: "/api/youtube/config",
      headers,
      payload: { clientId: CLIENT_ID, clientSecret: "" },
    });
    expect(noSecret.statusCode).toBe(400);
    const badId = await app.inject({
      method: "PUT",
      url: "/api/youtube/config",
      headers,
      payload: { clientId: "khong-phai-client", clientSecret: SECRET },
    });
    expect(badId.statusCode).toBe(400);
    const injected = await app.inject({
      method: "PUT",
      url: "/api/youtube/config",
      headers,
      payload: { clientId: CLIENT_ID, clientSecret: "abc\nSTUDIO_PASSWORD=hack" },
    });
    expect(injected.statusCode).toBe(400);

    const saved = await app.inject({
      method: "PUT",
      url: "/api/youtube/config",
      headers,
      payload: { clientId: CLIENT_ID, clientSecret: SECRET },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.body).not.toContain(SECRET);
    expect(saved.json()).toMatchObject({ configured: true, hasClientSecret: true });
    expect(saved.json().clientIdHint).toMatch(/^1234…-abcd…\.apps\.googleusercontent\.com$/);
    const env1 = readEnvFile(envFile);
    expect(env1).toMatchObject({
      STUDIO_PASSWORD: "giu-nguyen",
      YOUTUBE_CLIENT_ID: CLIENT_ID,
      YOUTUBE_CLIENT_SECRET: SECRET,
    });
    expect(Buffer.from(env1.STUDIO_TOKEN_KEY ?? "", "base64")).toHaveLength(32);

    // Dùng được ngay: bắt đầu đăng nhập Google với client mới.
    const start = await app.inject({ method: "POST", url: "/api/youtube/oauth/start", headers });
    expect(start.statusCode).toBe(200);
    expect(new URL(start.json().authUrl).searchParams.get("client_id")).toBe(CLIENT_ID);

    // Lưu lại, bỏ trống secret: giữ secret và khóa cũ.
    const again = await app.inject({
      method: "PUT",
      url: "/api/youtube/config",
      headers,
      payload: { clientId: CLIENT_ID, clientSecret: "" },
    });
    expect(again.statusCode).toBe(200);
    const env2 = readEnvFile(envFile);
    expect(env2.YOUTUBE_CLIENT_SECRET).toBe(SECRET);
    expect(env2.STUDIO_TOKEN_KEY).toBe(env1.STUDIO_TOKEN_KEY);
    expect((await readFile(envFile, "utf8")).match(/STUDIO_TOKEN_KEY=/g)).toHaveLength(1);

    const noSession = await app.inject({
      method: "PUT",
      url: "/api/youtube/config",
      headers: { origin: "http://localhost:5173" },
      payload: { clientId: CLIENT_ID, clientSecret: SECRET },
    });
    expect(noSession.statusCode).toBe(401);
    await rm(dir, { recursive: true, force: true });
  });

  it("đổi Client ID khi đang kết nối: báo cần kết nối lại", async () => {
    const dir = await mkdtemp(join(tmpdir(), "yt-env-"));
    const envFile = join(dir, ".env");
    await writeFile(
      envFile,
      `YOUTUBE_CLIENT_ID=${ENV.clientId}\nYOUTUBE_CLIENT_SECRET=${ENV.clientSecret}\nSTUDIO_TOKEN_KEY=${ENV.tokenKey.toString("base64")}\n`,
    );
    const { app, cookie } = await authedApp({ envFile });
    const state = (await connect(app, cookie)).searchParams.get("state");
    await app.inject({
      method: "GET",
      url: `/api/youtube/oauth/callback?state=${state}&code=good-code`,
    });
    const changed = await app.inject({
      method: "PUT",
      url: "/api/youtube/config",
      headers: { cookie, origin: "http://localhost:5173" },
      payload: { clientId: CLIENT_ID, clientSecret: SECRET },
    });
    expect(changed.statusCode).toBe(200);
    expect(changed.json().lastError).toContain("Kết nối lại");
    expect(readEnvFile(envFile).STUDIO_TOKEN_KEY).toBe(ENV.tokenKey.toString("base64"));
    await rm(dir, { recursive: true, force: true });
  });
});
