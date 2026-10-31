import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDbConnection,
  createProject,
  deleteProjectCascadeForTests,
  getWorkflowRunDetail,
  listProjects,
  listUsageRecordsForRun,
} from "@studio/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_TITLE, deleteDemo, seedDemo } from "./seed-demo.js";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";

let db: ReturnType<typeof createDbConnection>["db"];
let closeDb: () => Promise<void>;
let dataDir = "";
let otherProjectId = "";
/** Project demo đã có trước test (Director seed để test tay) thì test không chạy, tránh xóa nhầm. */
let demoAlreadyPresent = false;

beforeAll(async () => {
  const conn = createDbConnection(DATABASE_URL);
  db = conn.db;
  closeDb = conn.close;
  dataDir = await mkdtemp(join(tmpdir(), "studio-seed-demo-"));
  demoAlreadyPresent = (await listProjects(db)).some((project) => project.title === DEMO_TITLE);
  otherProjectId = (await createProject(db, "seed-demo test: project khác")).id;
});

afterAll(async () => {
  await deleteProjectCascadeForTests(db, otherProjectId);
  await closeDb();
  await rm(dataDir, { recursive: true, force: true });
});

describe("seed demo", () => {
  it("seed tạo run chờ duyệt có hai phương án; delete chỉ xóa project demo và thư mục artifact của nó", async (context) => {
    if (demoAlreadyPresent) {
      context.skip();
    }
    const seeded = await seedDemo(db, dataDir);
    const detail = await getWorkflowRunDetail(db, seeded.runId);
    expect(detail?.workflowRun.status).toBe("waiting_script_approval");
    expect(detail?.agentRuns.map((agent) => [agent.role, agent.status]).sort()).toEqual([
      ["research", "completed"],
      ["script", "waiting_approval"],
    ]);
    expect(detail?.artifacts.map((artifact) => `${artifact.type}@${artifact.version}`).sort()).toEqual([
      "render_props@1",
      "render_props@2",
      "research@1",
      "script@1",
    ]);
    expect(detail?.approvals).toEqual([]);
    expect(await listUsageRecordsForRun(db, seeded.runId)).toHaveLength(2);
    expect(existsSync(join(dataDir, "artifacts", seeded.runId))).toBe(true);

    expect(await deleteDemo(db, dataDir)).toEqual({ deletedProjects: 1, deletedRuns: 1 });
    const titles = (await listProjects(db)).map((project) => project.title);
    expect(titles).not.toContain(DEMO_TITLE);
    expect((await listProjects(db)).some((project) => project.id === otherProjectId)).toBe(true);
    expect(existsSync(join(dataDir, "artifacts", seeded.runId))).toBe(false);
  });
});
