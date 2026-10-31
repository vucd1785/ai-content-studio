import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  const login = await app.inject({ method: "POST", url: "/api/session/login", payload: { password: TEST_PASSWORD } });
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
  await rm(dataDir, { recursive: true, force: true });
});

describe("GET /api/artifacts/:artifactId", () => {
  it("artifact JSON trả nội dung đã lưu và metadata, không lộ storage_key", async () => {
    const stored = { variants: [{ title: "A" }, { title: "B" }] };
    const row = await seedArtifact("script", JSON.stringify(stored));
    const { app, cookie } = await authedApp();
    const response = await app.inject({ method: "GET", url: `/api/artifacts/${row.id}`, headers: { cookie } });
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
    const response = await app.inject({ method: "GET", url: `/api/artifacts/${row.id}`, headers: { cookie } });
    expect(response.statusCode).toBe(200);
    expect(artifactDetailResponseSchema.parse(response.json()).content).toBeNull();
    await app.close();
  });

  it("file thiếu hoặc JSON hỏng: 404; id lạ 404; id sai 400; thiếu session 401", async () => {
    const missing = await seedArtifact("script", null);
    const broken = await seedArtifact("research", "{ hỏng");
    const { app, cookie } = await authedApp();
    for (const id of [missing.id, broken.id, randomUUID()]) {
      const response = await app.inject({ method: "GET", url: `/api/artifacts/${id}`, headers: { cookie } });
      expect(response.statusCode, id).toBe(404);
      expect(response.json().error.code).toBe("not_found");
    }
    const bad = await app.inject({ method: "GET", url: "/api/artifacts/not-a-uuid", headers: { cookie } });
    expect(bad.statusCode).toBe(400);
    const noSession = await app.inject({ method: "GET", url: `/api/artifacts/${missing.id}` });
    expect(noSession.statusCode).toBe(401);
    await app.close();
  });
});
