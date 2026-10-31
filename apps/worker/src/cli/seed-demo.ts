import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseScript, researchSchema, scriptArtifactSchema } from "@studio/contracts";
import {
  agentRuns,
  artifacts,
  createDbConnection,
  createProject,
  deleteProjectCascadeForTests,
  insertBrief,
  insertUsageRecord,
  listProjects,
  type StudioDb,
  workflowRuns,
} from "@studio/db";
import { writeJsonArtifact } from "../jobs/job-support.js";
import { resolveRepoRoot } from "./paths.js";

/**
 * Dữ liệu demo để Director test UI bằng tay (quyết định 2, 2026-10-31). Không gọi Gemini, không TTS.
 *
 *   seed   : tạo một project tên DEMO_TITLE với run đang `waiting_script_approval`, research + script
 *            (kịch bản lấy từ fixtures/script.edu.json), hai row usage giả (chi phí 0).
 *   delete : xóa đúng các project có tên DEMO_TITLE cùng thư mục `DATA_DIR/artifacts/<runId>` của chúng.
 *            Không đụng project nào khác.
 */

export const DEMO_TITLE = "[Demo] Redis cache (seed)";

const REPO_ROOT = resolveRepoRoot(import.meta.url);

function dataDirFromEnv(): string {
  const raw = process.env.DATA_DIR?.trim() || "./data";
  return isAbsolute(raw) ? raw : resolve(REPO_ROOT, raw);
}

function fixtureScript(title: string) {
  const raw = JSON.parse(readFileSync(join(REPO_ROOT, "fixtures", "script.edu.json"), "utf8")) as Record<string, unknown>;
  return parseScript({
    ...raw,
    title,
    sources: [{ id: "src-redis-docs", title: "Redis documentation", url: "https://redis.io/docs/" }],
  });
}

async function insertArtifact(
  db: StudioDb,
  dataDir: string,
  run: { id: string; projectId: string },
  type: "research" | "script" | "render_props",
  content: unknown,
  version = 1,
) {
  const storageKey = `artifacts/${run.id}/${type}-v${version}-demo.json`;
  const contentHash = await writeJsonArtifact(dataDir, storageKey, content);
  const [row] = await db
    .insert(artifacts)
    .values({
      projectId: run.projectId,
      workflowRunId: run.id,
      type,
      version,
      schemaVersion: "1",
      contentHash,
      storageKey,
      metadata: { seed: "demo" },
    })
    .returning();
  if (row === undefined) {
    throw new Error("insert_artifact_failed");
  }
  return row;
}

export async function seedDemo(db: StudioDb, dataDir: string) {
  const project = await createProject(db, DEMO_TITLE);
  const brief = await insertBrief(db, project.id, {
    topic: "Redis là gì",
    audience: "Developer mới",
    goal: "Giải thích cache và TTL trong 60 giây",
    durationSec: 60,
    language: "vi",
    tone: "thân thiện",
    visualStyle: "gradient tối, flat icon",
    notes: "Dữ liệu demo, không gọi Gemini",
  });
  const [run] = await db
    .insert(workflowRuns)
    .values({ projectId: project.id, briefId: brief.id, status: "waiting_script_approval" })
    .returning();
  if (run === undefined) {
    throw new Error("insert_run_failed");
  }
  const [research, script] = await db
    .insert(agentRuns)
    .values([
      { workflowRunId: run.id, role: "research", status: "completed", attempt: 1 },
      { workflowRunId: run.id, role: "script", status: "waiting_approval", attempt: 1 },
    ])
    .returning();
  if (research === undefined || script === undefined) {
    throw new Error("insert_agent_runs_failed");
  }
  await insertArtifact(
    db,
    dataDir,
    run,
    "research",
    researchSchema.parse({
      schemaVersion: 1,
      summary: "Redis giữ dữ liệu trong RAM; TTL quyết định khi nào key hết hạn.",
      facts: [{ statement: "Cache giúp giảm tải database.", claimStatus: "assumption", sourceIds: ["ref-1"] }],
      sources: [{ id: "ref-1", title: "ghi-chu-demo.md", origin: "user_reference" }],
    }),
  );
  const scriptRow = await insertArtifact(
    db,
    dataDir,
    run,
    "script",
    scriptArtifactSchema.parse({
      variants: [fixtureScript("Redis trong 60 giây"), fixtureScript("Cache là gì? Hỏi Redis")],
    }),
  );
  // Hai version render props (P2-08): bản 2 đổi tiêu đề cảnh đầu; bản 1 vẫn mở được.
  const renderProps = JSON.parse(
    readFileSync(join(REPO_ROOT, "apps", "video", "fixtures", "edu-vertical-redis-props.json"), "utf8"),
  ) as { scenes: Record<string, unknown>[] };
  await insertArtifact(db, dataDir, run, "render_props", renderProps, 1);
  await insertArtifact(
    db,
    dataDir,
    run,
    "render_props",
    { ...renderProps, scenes: renderProps.scenes.map((scene, i) => (i === 0 ? { ...scene, headline: "Redis — bản 2" } : scene)) },
    2,
  );
  for (const [agentRunId, inputTokens, outputTokens] of [
    [research.id, 1200, 300],
    [script.id, 2400, 1800],
  ] as const) {
    await insertUsageRecord(db, {
      workflowRunId: run.id,
      agentRunId,
      provider: "demo",
      model: "demo-khong-goi-gemini",
      inputTokens,
      outputTokens,
      thinkingTokens: 0,
    });
  }
  return { projectId: project.id, runId: run.id, scriptArtifactId: scriptRow.id };
}

export async function deleteDemo(db: StudioDb, dataDir: string) {
  const demos = (await listProjects(db)).filter((project) => project.title === DEMO_TITLE);
  const runs = (await db.select({ id: workflowRuns.id, projectId: workflowRuns.projectId }).from(workflowRuns)).filter(
    (run) => demos.some((project) => project.id === run.projectId),
  );
  for (const project of demos) {
    await deleteProjectCascadeForTests(db, project.id);
  }
  for (const run of runs) {
    // Chỉ thư mục artifact của run demo; id là UUID do DB sinh nên không thoát được DATA_DIR.
    await rm(join(dataDir, "artifacts", run.id), { recursive: true, force: true });
  }
  return { deletedProjects: demos.length, deletedRuns: runs.length };
}

async function main() {
  const command = process.argv[2];
  if (command !== "seed" && command !== "delete") {
    console.error("Dùng: seed | delete");
    process.exit(2);
  }
  const databaseUrl = process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";
  const dataDir = dataDirFromEnv();
  const { db, close } = createDbConnection(databaseUrl);
  try {
    if (command === "seed") {
      const result = await seedDemo(db, dataDir);
      console.log(`Đã tạo project demo "${DEMO_TITLE}" (project ${result.projectId}, run ${result.runId}).`);
    } else {
      const result = await deleteDemo(db, dataDir);
      console.log(`Đã xóa ${result.deletedProjects} project demo, ${result.deletedRuns} run.`);
    }
  } finally {
    await close();
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
