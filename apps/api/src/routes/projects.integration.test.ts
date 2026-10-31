import { mkdtemp, mkdir, readdir, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  countBriefsForProject,
  createDbConnection,
  deleteProjectCascadeForTests,
  getReferenceById,
  listBriefsForProject,
  listReferences,
} from "@studio/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { MAX_UPLOAD_BYTES } from "../storage/constants.js";
import * as dbProjects from "@studio/db";
import {
  fileExistsAtKey,
  readUploadFile,
  resolveStoragePath,
  StorageValidationError,
} from "../storage/upload.js";

const TEST_PASSWORD = "director-test-password";
const TEST_SECRET = "0123456789abcdef0123456789abcdef0123456789ab";
const NOW = 1_700_000_000;
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";

const MULTIPART_BOUNDARY = "----p203boundary";
const createdProjectIds: string[] = [];
let dataDir = "";
let db: ReturnType<typeof createDbConnection>["db"];
let closeDb: () => Promise<void>;

async function createAuthedApp(appDataDir: string = dataDir) {
  const app = await buildApp({
    password: TEST_PASSWORD,
    sessionSecret: TEST_SECRET,
    nowSeconds: NOW,
    enableProbe: false,
    enableLogger: false,
    projects: { db, dataDir: appDataDir },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/session/login",
    payload: { password: TEST_PASSWORD },
  });
  const setCookie = login.headers["set-cookie"];
  const line = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const cookieValue = line?.split(";")[0] ?? "";
  return { app, cookieHeader: cookieValue };
}

function validBrief() {
  return {
    topic: "Redis",
    audience: "Dev",
    goal: "Hiểu cache",
    durationSec: 60,
    language: "vi" as const,
    tone: "friendly",
    visualStyle: "edu",
    notes: "test",
  };
}

describe("projects API (I1–I13 + security)", () => {
  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "studio-p2-03-"));
    const conn = createDbConnection(DATABASE_URL);
    db = conn.db;
    closeDb = conn.close;
  });

  afterAll(async () => {
    for (const id of createdProjectIds) {
      await deleteProjectCascadeForTests(db, id);
    }
    await closeDb();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("I1 GET /api/projects without session returns 401", async () => {
    const app = await buildApp({
      password: TEST_PASSWORD,
      sessionSecret: TEST_SECRET,
      nowSeconds: NOW,
      enableLogger: false,
      projects: { db, dataDir },
    });
    const response = await app.inject({ method: "GET", url: "/api/projects" });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("I2 POST project and list contains title", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const create = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: { cookie: cookieHeader },
      payload: { title: "P2-03 test project" },
    });
    expect(create.statusCode).toBe(201);
    const project = create.json() as { id: string; title: string };
    createdProjectIds.push(project.id);
    const list = await app.inject({
      method: "GET",
      url: "/api/projects",
      headers: { cookie: cookieHeader },
    });
    expect(list.statusCode).toBe(200);
    const titles = (list.json() as { projects: { title: string }[] }).projects.map((p) => p.title);
    expect(titles).toContain("P2-03 test project");
    await app.close();
  });

  it("I3 GET unknown project returns 404 without leaking paths", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/projects/00000000-0000-4000-8000-000000000099",
      headers: { cookie: cookieHeader },
    });
    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain(dataDir);
    await app.close();
  });

  it("I4 PATCH title updates project", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const create = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: { cookie: cookieHeader },
      payload: { title: "Before patch" },
    });
    const project = create.json() as { id: string };
    createdProjectIds.push(project.id);
    const patch = await app.inject({
      method: "PATCH",
      url: `/api/projects/${project.id}`,
      headers: { cookie: cookieHeader },
      payload: { title: "After patch" },
    });
    expect(patch.statusCode).toBe(200);
    expect((patch.json() as { title: string }).title).toBe("After patch");
    await app.close();
  });

  it("I5 invalid brief rejected with 400", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const create = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: { cookie: cookieHeader },
      payload: { title: "Brief invalid" },
    });
    const project = create.json() as { id: string };
    createdProjectIds.push(project.id);
    const bad = await app.inject({
      method: "PUT",
      url: `/api/projects/${project.id}/brief`,
      headers: { cookie: cookieHeader },
      payload: { ...validBrief(), durationSec: 10 },
    });
    expect(bad.statusCode).toBe(400);
    expect(await countBriefsForProject(db, project.id)).toBe(0);
    await app.close();
  });

  it("I6 two PUT briefs preserve history and return latest", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const create = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: { cookie: cookieHeader },
      payload: { title: "Brief history" },
    });
    const project = create.json() as { id: string };
    createdProjectIds.push(project.id);
    await app.inject({
      method: "PUT",
      url: `/api/projects/${project.id}/brief`,
      headers: { cookie: cookieHeader },
      payload: validBrief(),
    });
    await app.inject({
      method: "PUT",
      url: `/api/projects/${project.id}/brief`,
      headers: { cookie: cookieHeader },
      payload: { ...validBrief(), topic: "Second brief" },
    });
    expect(await countBriefsForProject(db, project.id)).toBe(2);
    const detail = await app.inject({
      method: "GET",
      url: `/api/projects/${project.id}`,
      headers: { cookie: cookieHeader },
    });
    expect((detail.json() as { brief: { topic: string } }).brief.topic).toBe("Second brief");
    await app.close();
  });

  it("I7 malicious filename does not appear in stored uri", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const create = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: { cookie: cookieHeader },
      payload: { title: "Upload traversal name" },
    });
    const project = create.json() as { id: string };
    createdProjectIds.push(project.id);
    const boundary = "----p203";
    const payload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="../../../evil.pdf"',
      "Content-Type: application/pdf",
      "",
      "%PDF-1.4 test content",
      `--${boundary}--`,
      "",
    ].join("\r\n");
    const upload = await app.inject({
      method: "POST",
      url: `/api/projects/${project.id}/references`,
      headers: {
        cookie: cookieHeader,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });
    expect(upload.statusCode).toBe(201);
    const refId = (upload.json() as { id: string }).id;
    const row = await getReferenceById(db, refId);
    expect(row?.uri).toBeDefined();
    expect(row?.uri.includes("..")).toBe(false);
    expect(row?.uri).toMatch(/^uploads\/[0-9a-f-]{36}\.pdf$/);
    expect((upload.json() as { title: string }).title).toBe("evil.pdf");
    expect(await fileExistsAtKey(dataDir, row?.uri ?? "")).toBe(true);
    await app.close();
  });

  it("I8 oversized upload returns 413 and leaves no new upload file", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const create = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: { cookie: cookieHeader },
      payload: { title: "Oversized" },
    });
    const project = create.json() as { id: string };
    createdProjectIds.push(project.id);
    const uploadsPath = join(dataDir, "uploads");
    const before = await readdir(uploadsPath).catch(() => [] as string[]);
    const boundary = "----big";
    const big = Buffer.alloc(MAX_UPLOAD_BYTES + 512);
    big.write("%PDF", 0);
    const payload = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="big.pdf"\r\nContent-Type: application/pdf\r\n\r\n`,
      ),
      big,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const upload = await app.inject({
      method: "POST",
      url: `/api/projects/${project.id}/references`,
      headers: {
        cookie: cookieHeader,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });
    expect(upload.statusCode).toBe(413);
    const after = await readdir(uploadsPath).catch(() => [] as string[]);
    expect(after.length).toBe(before.length);
    await app.close();
  });

  it("I9 valid txt upload creates reference and file under uploads", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const create = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: { cookie: cookieHeader },
      payload: { title: "Txt upload" },
    });
    const project = create.json() as { id: string };
    createdProjectIds.push(project.id);
    const boundary = "----txt";
    const payload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="notes.txt"',
      "Content-Type: text/plain",
      "",
      "hello studio",
      `--${boundary}--`,
      "",
    ].join("\r\n");
    const upload = await app.inject({
      method: "POST",
      url: `/api/projects/${project.id}/references`,
      headers: {
        cookie: cookieHeader,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });
    expect(upload.statusCode).toBe(201);
    const refId = (upload.json() as { id: string }).id;
    const row = await getReferenceById(db, refId);
    expect(row?.kind).toBe("user_file");
    const content = await readUploadFile(dataDir, row?.uri ?? "");
    expect(content.toString("utf8")).toBe("hello studio");
    await app.close();
  });

  it("I10 JSON url reference without network fetch", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const create = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: { cookie: cookieHeader },
      payload: { title: "URL ref" },
    });
    const project = create.json() as { id: string };
    createdProjectIds.push(project.id);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const upload = await app.inject({
      method: "POST",
      url: `/api/projects/${project.id}/references`,
      headers: { cookie: cookieHeader, "content-type": "application/json" },
      payload: { url: "https://example.com/a", title: "Example" },
    });
    expect(upload.statusCode).toBe(201);
    expect((upload.json() as { kind: string }).kind).toBe("user_url");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    await app.close();
  });

  it("I11 DELETE reference keeps file on disk", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const create = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: { cookie: cookieHeader },
      payload: { title: "Delete ref" },
    });
    const project = create.json() as { id: string };
    createdProjectIds.push(project.id);
    const boundary = "----del";
    const payload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="keep.txt"',
      "Content-Type: text/plain",
      "",
      "persist",
      `--${boundary}--`,
      "",
    ].join("\r\n");
    const upload = await app.inject({
      method: "POST",
      url: `/api/projects/${project.id}/references`,
      headers: {
        cookie: cookieHeader,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });
    const ref = upload.json() as { id: string };
    const row = await getReferenceById(db, ref.id);
    const key = row?.uri ?? "";
    const del = await app.inject({
      method: "DELETE",
      url: `/api/projects/${project.id}/references/${ref.id}`,
      headers: { cookie: cookieHeader },
    });
    expect(del.statusCode).toBe(204);
    expect(await fileExistsAtKey(dataDir, key)).toBe(true);
    await app.close();
  });

  it("I12 DELETE reference from wrong project returns 404", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const a = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: { cookie: cookieHeader },
      payload: { title: "A" },
    });
    const b = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: { cookie: cookieHeader },
      payload: { title: "B" },
    });
    const projectA = a.json() as { id: string };
    const projectB = b.json() as { id: string };
    createdProjectIds.push(projectA.id, projectB.id);
    const upload = await app.inject({
      method: "POST",
      url: `/api/projects/${projectA.id}/references`,
      headers: { cookie: cookieHeader, "content-type": "application/json" },
      payload: { url: "https://example.com/x" },
    });
    const ref = upload.json() as { id: string };
    const del = await app.inject({
      method: "DELETE",
      url: `/api/projects/${projectB.id}/references/${ref.id}`,
      headers: { cookie: cookieHeader },
    });
    expect(del.statusCode).toBe(404);
    await app.close();
  });

  it("I13 forbidden Origin blocks POST /api/projects", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const beforeCount = (await listProjectsSafe(app, cookieHeader)).length;
    const create = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: { cookie: cookieHeader, origin: "https://evil.example" },
      payload: { title: "Blocked origin" },
    });
    expect(create.statusCode).toBe(401);
    const afterCount = (await listProjectsSafe(app, cookieHeader)).length;
    expect(afterCount).toBe(beforeCount);
    await app.close();
  });

  it("rejects invalid PDF signature without DB row", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const create = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: { cookie: cookieHeader },
      payload: { title: "Bad pdf" },
    });
    const project = create.json() as { id: string };
    createdProjectIds.push(project.id);
    const boundary = "----badpdf";
    const payload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="bad.pdf"',
      "Content-Type: application/pdf",
      "",
      "NOTPDFCONTENT",
      `--${boundary}--`,
      "",
    ].join("\r\n");
    const upload = await app.inject({
      method: "POST",
      url: `/api/projects/${project.id}/references`,
      headers: {
        cookie: cookieHeader,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });
    expect(upload.statusCode).toBe(400);
    const rows = await listReferences(db, project.id);
    expect(rows.length).toBe(0);
    await app.close();
  });

  it("database insert failure removes newly written upload file", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const create = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: { cookie: cookieHeader },
      payload: { title: "Insert fail" },
    });
    const project = create.json() as { id: string };
    createdProjectIds.push(project.id);
    const spy = vi
      .spyOn(dbProjects, "insertReferenceFile")
      .mockRejectedValueOnce(new Error("insert failed"));
    const uploadsPath = join(dataDir, "uploads");
    const before = await readdir(uploadsPath).catch(() => [] as string[]);
    const boundary = "----fail";
    const payload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="x.txt"',
      "Content-Type: text/plain",
      "",
      "data",
      `--${boundary}--`,
      "",
    ].join("\r\n");
    const upload = await app.inject({
      method: "POST",
      url: `/api/projects/${project.id}/references`,
      headers: {
        cookie: cookieHeader,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });
    expect(upload.statusCode).toBe(500);
    expect(upload.body).not.toContain("insert failed");
    expect(upload.body).not.toContain(dataDir);
    expect((await listReferences(db, project.id)).length).toBe(0);
    const after = await readdir(uploadsPath).catch(() => [] as string[]);
    expect(after.length).toBe(before.length);
    spy.mockRestore();
    await app.close();
  });

  it("U1 resolve rejects traversal key before touching disk", async () => {
    await expect(
      resolveStoragePath(dataDir, "uploads/../outside-secret.txt"),
    ).rejects.toThrow(StorageValidationError);
  });

  it("symlink/junction escape: reading a key that links outside uploads is rejected", async () => {
    const outside = await mkdtemp(join(tmpdir(), "studio-p2-03-outside-"));
    await writeFile(join(outside, "secret.txt"), "secret");
    const uploadsPath = join(dataDir, "uploads");
    await mkdir(uploadsPath, { recursive: true });
    const key = `uploads/${randomUUID()}.txt`;
    const linkPath = join(uploadsPath, key.slice("uploads/".length));
    // Junction không cần quyền admin trên Windows; trên POSIX type bị bỏ qua (symlink thường).
    await symlink(outside, linkPath, "junction");
    try {
      await expect(readUploadFile(dataDir, key)).rejects.toMatchObject({
        code: "storage_path_escape",
      });
    } finally {
      await unlink(linkPath);
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("symlink/junction escape: uploads dir linked outside DATA_DIR rejects upload, no file, no row", async () => {
    const escapeDataDir = await mkdtemp(join(tmpdir(), "studio-p2-03-escape-"));
    const outside = await mkdtemp(join(tmpdir(), "studio-p2-03-outside-"));
    const uploadsLink = join(escapeDataDir, "uploads");
    await symlink(outside, uploadsLink, "junction");
    const { app, cookieHeader } = await createAuthedApp(escapeDataDir);
    try {
      const project = await createProjectVia(app, cookieHeader, "Junction escape");
      const upload = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/references`,
        headers: multipartHeaders(cookieHeader),
        payload: multipartBody("x.txt", "data"),
      });
      expect(upload.statusCode).toBe(400);
      expect(upload.body).not.toContain(outside);
      expect(upload.body).not.toContain(escapeDataDir);
      expect(await readdir(outside)).toEqual([]);
      expect((await listReferences(db, project.id)).length).toBe(0);
    } finally {
      await app.close();
      await unlink(uploadsLink);
      await rm(escapeDataDir, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("every project route requires a session (401, no write)", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const project = await createProjectVia(app, cookieHeader, "Unauth target");
    const id = project.id;
    const calls = [
      { method: "GET" as const, url: `/api/projects/${id}` },
      { method: "POST" as const, url: "/api/projects", payload: { title: "x" } },
      { method: "PATCH" as const, url: `/api/projects/${id}`, payload: { title: "hijack" } },
      { method: "PUT" as const, url: `/api/projects/${id}/brief`, payload: validBrief() },
      {
        method: "POST" as const,
        url: `/api/projects/${id}/references`,
        payload: { url: "https://example.com/u" },
      },
      { method: "DELETE" as const, url: `/api/projects/${id}/references/${randomUUID()}` },
    ];
    const before = (await listProjectsSafe(app, cookieHeader)).length;
    for (const call of calls) {
      const response = await app.inject({
        ...call,
        headers: { cookie: "studio_session=forged.value" },
      });
      expect(response.statusCode, `${call.method} ${call.url}`).toBe(401);
      expect((response.json() as { error: { code: string } }).error.code).toBe("unauthorized");
    }
    expect((await listProjectsSafe(app, cookieHeader)).length).toBe(before);
    expect(await countBriefsForProject(db, id)).toBe(0);
    expect((await listReferences(db, id)).length).toBe(0);
    const detail = await app.inject({
      method: "GET",
      url: `/api/projects/${id}`,
      headers: { cookie: cookieHeader },
    });
    expect((detail.json() as { project: { title: string } }).project.title).toBe("Unauth target");
    await app.close();
  });

  it("invalid UUID params return 400 validation_error", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const project = await createProjectVia(app, cookieHeader, "UUID target");
    const calls = [
      { method: "GET" as const, url: "/api/projects/not-a-uuid" },
      { method: "PATCH" as const, url: "/api/projects/not-a-uuid", payload: { title: "x" } },
      { method: "PUT" as const, url: "/api/projects/..%2F..%2Fetc/brief", payload: validBrief() },
      {
        method: "POST" as const,
        url: "/api/projects/123/references",
        payload: { url: "https://example.com/u" },
      },
      { method: "DELETE" as const, url: `/api/projects/${project.id}/references/not-a-uuid` },
    ];
    for (const call of calls) {
      const response = await app.inject({ ...call, headers: { cookie: cookieHeader } });
      expect(response.statusCode, `${call.method} ${call.url}`).toBe(400);
      expect((response.json() as { error: { code: string } }).error.code).toBe("validation_error");
    }
    await app.close();
  });

  it("unknown project returns 404 for PATCH, PUT brief, POST and DELETE reference", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const missing = randomUUID();
    const calls = [
      { method: "PATCH" as const, url: `/api/projects/${missing}`, payload: { title: "x" } },
      { method: "PUT" as const, url: `/api/projects/${missing}/brief`, payload: validBrief() },
      {
        method: "POST" as const,
        url: `/api/projects/${missing}/references`,
        payload: { url: "https://example.com/u" },
      },
      { method: "DELETE" as const, url: `/api/projects/${missing}/references/${randomUUID()}` },
    ];
    for (const call of calls) {
      const response = await app.inject({ ...call, headers: { cookie: cookieHeader } });
      expect(response.statusCode, `${call.method} ${call.url}`).toBe(404);
      expect((response.json() as { error: { code: string } }).error.code).toBe("not_found");
    }
    await app.close();
  });

  it("PATCH with empty or too long title returns 400 and keeps title; empty detail shape", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const project = await createProjectVia(app, cookieHeader, "Keep me");
    for (const title of ["", "a".repeat(201)]) {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/projects/${project.id}`,
        headers: { cookie: cookieHeader },
        payload: { title },
      });
      expect(response.statusCode).toBe(400);
    }
    const detail = await app.inject({
      method: "GET",
      url: `/api/projects/${project.id}`,
      headers: { cookie: cookieHeader },
    });
    const body = detail.json() as {
      project: { title: string };
      brief: unknown;
      workflowRun: unknown;
      references: unknown[];
    };
    expect(body.project.title).toBe("Keep me");
    expect(body.brief).toBeNull();
    expect(body.workflowRun).toBeNull();
    expect(body.references).toEqual([]);
    await app.close();
  });

  it("I5 brief with language en returns 400 and no row", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const project = await createProjectVia(app, cookieHeader, "Brief en");
    const bad = await app.inject({
      method: "PUT",
      url: `/api/projects/${project.id}/brief`,
      headers: { cookie: cookieHeader },
      payload: { ...validBrief(), language: "en" },
    });
    expect(bad.statusCode).toBe(400);
    expect(await countBriefsForProject(db, project.id)).toBe(0);
    await app.close();
  });

  it("I6 brief history: old brief row keeps original content", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const project = await createProjectVia(app, cookieHeader, "Brief history rows");
    const first = await app.inject({
      method: "PUT",
      url: `/api/projects/${project.id}/brief`,
      headers: { cookie: cookieHeader },
      payload: { ...validBrief(), topic: "First" },
    });
    expect(first.statusCode).toBe(201);
    const second = await app.inject({
      method: "PUT",
      url: `/api/projects/${project.id}/brief`,
      headers: { cookie: cookieHeader },
      payload: { ...validBrief(), topic: "Second", durationSec: 90 },
    });
    expect(second.statusCode).toBe(201);
    const rows = await listBriefsForProject(db, project.id);
    const firstId = (first.json() as { id: string }).id;
    expect(rows.find((r) => r.id === firstId)).toMatchObject({ topic: "First", durationSec: 60 });
    expect(rows.map((r) => r.topic).sort()).toEqual(["First", "Second"]);
    await app.close();
  });

  it("rejects unsupported extension, text with NUL, and txt carrying PDF bytes (no file, no row)", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const project = await createProjectVia(app, cookieHeader, "Bad uploads");
    const uploadsPath = join(dataDir, "uploads");
    const before = await readdir(uploadsPath).catch(() => [] as string[]);
    const cases: [string, string | Buffer][] = [
      ["run.exe", "MZ"],
      ["noext", "hello"],
      ["notes.md", Buffer.from([0x68, 0x00, 0x69])],
      ["fake.txt", "%PDF-1.4 hidden"],
    ];
    for (const [filename, content] of cases) {
      const upload = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/references`,
        headers: multipartHeaders(cookieHeader),
        payload: multipartBody(filename, content),
      });
      expect(upload.statusCode, filename).toBe(400);
      expect((upload.json() as { error: { code: string } }).error.code).toBe("validation_error");
    }
    expect(await readdir(uploadsPath).catch(() => [] as string[])).toEqual(before);
    expect((await listReferences(db, project.id)).length).toBe(0);
    await app.close();
  });

  it("I8 oversized upload creates no DB row", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const project = await createProjectVia(app, cookieHeader, "Oversized no row");
    const big = Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0x61);
    const upload = await app.inject({
      method: "POST",
      url: `/api/projects/${project.id}/references`,
      headers: multipartHeaders(cookieHeader),
      payload: multipartBody("big.txt", big),
    });
    expect(upload.statusCode).toBe(413);
    expect((upload.json() as { error: { code: string } }).error.code).toBe("payload_too_large");
    expect((await listReferences(db, project.id)).length).toBe(0);
    await app.close();
  });

  it("upload response hides storage key; title is sanitized basename", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const project = await createProjectVia(app, cookieHeader, "Title sanitize");
    const longName = `${"n".repeat(300)}.md`;
    const upload = await app.inject({
      method: "POST",
      url: `/api/projects/${project.id}/references`,
      headers: multipartHeaders(cookieHeader),
      payload: multipartBody(`..\\..\\dir\\${longName}`, "# heading"),
    });
    expect(upload.statusCode).toBe(201);
    const body = upload.json() as Record<string, unknown>;
    expect(body).not.toHaveProperty("uri");
    expect(body).not.toHaveProperty("storageKey");
    expect(upload.body).not.toContain("uploads/");
    expect(upload.body).not.toContain(dataDir);
    expect((body.title as string).length).toBe(200);
    expect(body.title as string).not.toContain("\\");
    expect(body.mediaType).toBe("text/markdown");
    const row = await getReferenceById(db, body.id as string);
    expect(row?.uri).toMatch(/^uploads\/[0-9a-f-]{36}\.md$/);
    await app.close();
  });

  it("malformed JSON, unsupported content-type, non-http URL return 400 without internals", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const project = await createProjectVia(app, cookieHeader, "Malformed");
    const badJson = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: { cookie: cookieHeader, "content-type": "application/json" },
      payload: '{"title": ',
    });
    expect(badJson.statusCode).toBe(400);
    expect((badJson.json() as { error: { code: string } }).error.code).toBe("validation_error");
    expect(badJson.body).not.toMatch(/stack|FST_|Unexpected/);
    const textBody = await app.inject({
      method: "POST",
      url: `/api/projects/${project.id}/references`,
      headers: { cookie: cookieHeader, "content-type": "text/plain" },
      payload: "https://example.com",
    });
    expect(textBody.statusCode).toBe(400);
    const badUrl = await app.inject({
      method: "POST",
      url: `/api/projects/${project.id}/references`,
      headers: { cookie: cookieHeader, "content-type": "application/json" },
      payload: { url: "file:///etc/passwd" },
    });
    expect(badUrl.statusCode).toBe(400);
    expect(badUrl.body).not.toContain("/etc/passwd");
    expect((await listReferences(db, project.id)).length).toBe(0);
    await app.close();
  });

  it("forbidden Origin blocks PUT brief, POST reference and DELETE reference", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const project = await createProjectVia(app, cookieHeader, "Origin guard");
    const ref = await app.inject({
      method: "POST",
      url: `/api/projects/${project.id}/references`,
      headers: { cookie: cookieHeader, "content-type": "application/json" },
      payload: { url: "https://example.com/keep" },
    });
    const refId = (ref.json() as { id: string }).id;
    const evil = { cookie: cookieHeader, origin: "https://evil.example" };
    const put = await app.inject({
      method: "PUT",
      url: `/api/projects/${project.id}/brief`,
      headers: evil,
      payload: validBrief(),
    });
    const post = await app.inject({
      method: "POST",
      url: `/api/projects/${project.id}/references`,
      headers: { ...evil, "content-type": "application/json" },
      payload: { url: "https://example.com/evil" },
    });
    const del = await app.inject({
      method: "DELETE",
      url: `/api/projects/${project.id}/references/${refId}`,
      headers: evil,
    });
    expect([put.statusCode, post.statusCode, del.statusCode]).toEqual([401, 401, 401]);
    expect(await countBriefsForProject(db, project.id)).toBe(0);
    const refs = await listReferences(db, project.id);
    expect(refs.map((r) => r.id)).toEqual([refId]);
    await app.close();
  });

  it("I12 cross-project DELETE keeps the reference row", async () => {
    const { app, cookieHeader } = await createAuthedApp();
    const a = await createProjectVia(app, cookieHeader, "Owner A");
    const b = await createProjectVia(app, cookieHeader, "Other B");
    const ref = await app.inject({
      method: "POST",
      url: `/api/projects/${a.id}/references`,
      headers: { cookie: cookieHeader, "content-type": "application/json" },
      payload: { url: "https://example.com/owned" },
    });
    const refId = (ref.json() as { id: string }).id;
    const del = await app.inject({
      method: "DELETE",
      url: `/api/projects/${b.id}/references/${refId}`,
      headers: { cookie: cookieHeader },
    });
    expect(del.statusCode).toBe(404);
    expect(await getReferenceById(db, refId)).not.toBeNull();
    await app.close();
  });
});

function multipartHeaders(cookieHeader: string) {
  return {
    cookie: cookieHeader,
    "content-type": `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
  };
}

function multipartBody(filename: string, content: string | Buffer): Buffer {
  return Buffer.concat([
    Buffer.from(
      `--${MULTIPART_BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
    ),
    typeof content === "string" ? Buffer.from(content) : content,
    Buffer.from(`\r\n--${MULTIPART_BOUNDARY}--\r\n`),
  ]);
}

async function createProjectVia(
  app: Awaited<ReturnType<typeof buildApp>>,
  cookieHeader: string,
  title: string,
): Promise<{ id: string }> {
  const create = await app.inject({
    method: "POST",
    url: "/api/projects",
    headers: { cookie: cookieHeader },
    payload: { title },
  });
  expect(create.statusCode).toBe(201);
  const project = create.json() as { id: string };
  createdProjectIds.push(project.id);
  return project;
}

async function listProjectsSafe(app: Awaited<ReturnType<typeof buildApp>>, cookieHeader: string) {
  const list = await app.inject({
    method: "GET",
    url: "/api/projects",
    headers: { cookie: cookieHeader },
  });
  return (list.json() as { projects: unknown[] }).projects;
}
