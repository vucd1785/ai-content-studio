import {
  agentRuns,
  createDbConnection,
  createProject,
  deleteProjectCascadeForTests,
  getDefaultBrandContact,
  insertBrief,
  jobs,
  setDefaultBrandContact,
  workflowRuns,
} from "@studio/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

/** ADR-018: liên hệ bản quyền của kênh và nút "Tạo lại bộ đăng bài". */
const TEST_PASSWORD = "director-test-password";
const TEST_SECRET = "0123456789abcdef0123456789abcdef0123456789ab";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";

type Db = ReturnType<typeof createDbConnection>["db"];
let db: Db;
let closeDb: () => Promise<void>;
let originalContact: string | null = null;
const projectIds: string[] = [];

beforeAll(async () => {
  const conn = createDbConnection(DATABASE_URL);
  db = conn.db;
  closeDb = conn.close;
  originalContact = (await getDefaultBrandContact(db))?.copyrightContact ?? null;
});

afterAll(async () => {
  await setDefaultBrandContact(db, originalContact ?? "");
  for (const id of projectIds) {
    await deleteProjectCascadeForTests(db, id);
  }
  await closeDb();
});

async function authedApp() {
  const app = await buildApp({
    password: TEST_PASSWORD,
    sessionSecret: TEST_SECRET,
    nowSeconds: 1_700_000_000,
    enableLogger: false,
    projects: { db, dataDir: "." },
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
  const project = await createProject(db, "ADR-018 test");
  projectIds.push(project.id);
  const brief = await insertBrief(db, project.id, {
    topic: "Bầu trời",
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
  return run.id;
}

describe("bộ đăng bài (ADR-018)", () => {
  it("đọc, ghi và xóa liên hệ bản quyền của kênh mặc định", async () => {
    const { app, cookie } = await authedApp();
    const put = await app.inject({
      method: "PUT",
      url: "/api/brand-profile/contact",
      headers: { cookie },
      payload: { copyrightContact: "  lienhe@example.com " },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().copyrightContact).toBe("lienhe@example.com");
    const get = await app.inject({ method: "GET", url: "/api/brand-profile/contact", headers: { cookie } });
    expect(get.json().copyrightContact).toBe("lienhe@example.com");
    const cleared = await app.inject({
      method: "PUT",
      url: "/api/brand-profile/contact",
      headers: { cookie },
      payload: { copyrightContact: "" },
    });
    expect(cleared.json().copyrightContact).toBeNull();
    const extra = await app.inject({
      method: "PUT",
      url: "/api/brand-profile/contact",
      headers: { cookie },
      payload: { copyrightContact: "x", other: 1 },
    });
    expect(extra.statusCode).toBe(400);
  });

  it("tạo lại chỉ khi đã xuất; job publish đang chờ thì không tạo thêm; run giữ exported", async () => {
    const { app, cookie } = await authedApp();
    const notExported = await seedRun("qa");
    const early = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${notExported}/publish-kit`,
      headers: { cookie },
    });
    expect(early.statusCode).toBe(409);

    const runId = await seedRun("exported");
    const first = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${runId}/publish-kit`,
      headers: { cookie },
    });
    expect(first.statusCode).toBe(202);
    const again = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${runId}/publish-kit`,
      headers: { cookie },
    });
    expect(again.statusCode).toBe(409);
    const agentIds = new Set(
      (await db.select().from(agentRuns))
        .filter((a) => a.workflowRunId === runId)
        .map((a) => a.id),
    );
    const queued = (await db.select().from(jobs))
      .filter((j) => agentIds.has(j.agentRunId))
      .map((j) => ({ key: j.idempotencyKey, queue: j.queue, status: j.status }));
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ queue: "llm", status: "queued" });
    expect(queued[0]?.key).toMatch(new RegExp(`^publish:${runId}:request:`));
    const run = (await db.select().from(workflowRuns)).find((r) => r.id === runId);
    expect(run?.status).toBe("exported");
  });
});
