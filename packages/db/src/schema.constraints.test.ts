import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";

const EXPECTED_TABLES = [
  "projects",
  "briefs",
  "references",
  "workflow_runs",
  "agent_runs",
  "jobs",
  "artifacts",
  "artifact_dependencies",
  "approvals",
  "events",
  "usage_records",
  "voice_profiles",
  "brand_profiles",
  "brand_characters",
  "motion_assets",
  "motion_asset_requests",
] as const;

describe("P2-01 schema constraints (Postgres)", () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(() => {
    sql = postgres(databaseUrl, { max: 1 });
  });

  afterAll(async () => {
    await sql.end();
  });

  it("có đủ bảng documented", async () => {
    const rows = await sql<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    const names = new Set(rows.map((r) => r.tablename));
    for (const table of EXPECTED_TABLES) {
      expect(names.has(table), `missing table ${table}`).toBe(true);
    }
  });

  it("events.id là bigint auto-increment (bigserial)", async () => {
    const rows = await sql<{ data_type: string; column_default: string | null }[]>`
      SELECT data_type, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'id'
    `;
    expect(rows[0]?.data_type).toBe("bigint");
    expect(rows[0]?.column_default ?? "").toMatch(/nextval\(/i);
  });

  it("từ chối jobs.idempotency_key trùng", async () => {
    await sql.begin(async (tx) => {
      const [project] = await tx<{ id: string }[]>`
        INSERT INTO projects (title) VALUES ('constraint-test') RETURNING id
      `;
      if (!project) {
        throw new Error("project insert failed");
      }
      const [brief] = await tx<{ id: string }[]>`
        INSERT INTO briefs (
          project_id, topic, audience, goal, duration_sec, language, tone, visual_style
        ) VALUES (
          ${project.id}, 't', 'a', 'g', 60, 'vi', 'neutral', 'flat'
        ) RETURNING id
      `;
      const [run] = await tx<{ id: string }[]>`
        INSERT INTO workflow_runs (project_id, brief_id, status)
        VALUES (${project.id}, ${brief!.id}, 'idea_submitted') RETURNING id
      `;
      const [agent] = await tx<{ id: string }[]>`
        INSERT INTO agent_runs (workflow_run_id, role, status)
        VALUES (${run!.id}, 'producer', 'idle') RETURNING id
      `;
      const key = "dup-key-" + crypto.randomUUID();
      await tx`
        INSERT INTO jobs (agent_run_id, queue, idempotency_key, status)
        VALUES (${agent!.id}, 'llm', ${key}, 'queued')
      `;
      await expect(
        tx`
          INSERT INTO jobs (agent_run_id, queue, idempotency_key, status)
          VALUES (${agent!.id}, 'llm', ${key}, 'queued')
        `,
      ).rejects.toThrow();
      throw new Error("ROLLBACK");
    }).catch((error: unknown) => {
      if (error instanceof Error && error.message === "ROLLBACK") {
        return;
      }
      throw error;
    });
  });

  it("từ chối workflow_runs.status không hợp lệ", async () => {
    await sql.begin(async (tx) => {
      const [project] = await tx<{ id: string }[]>`
        INSERT INTO projects (title) VALUES ('bad-status') RETURNING id
      `;
      const [brief] = await tx<{ id: string }[]>`
        INSERT INTO briefs (
          project_id, topic, audience, goal, duration_sec, language, tone, visual_style
        ) VALUES (
          ${project!.id}, 't', 'a', 'g', 45, 'vi', 'n', 'v'
        ) RETURNING id
      `;
      await expect(
        tx`
          INSERT INTO workflow_runs (project_id, brief_id, status)
          VALUES (${project!.id}, ${brief!.id}, 'not_a_real_status')
        `,
      ).rejects.toThrow();
      throw new Error("ROLLBACK");
    }).catch((error: unknown) => {
      if (error instanceof Error && error.message === "ROLLBACK") {
        return;
      }
      throw error;
    });
  });

  it("approvals.decision NOT NULL — không có default approved", async () => {
    const rows = await sql<{ is_nullable: string; column_default: string | null }[]>`
      SELECT is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'approvals' AND column_name = 'decision'
    `;
    expect(rows[0]?.is_nullable).toBe("NO");
    expect(rows[0]?.column_default).toBeNull();
  });

  it("từ chối briefs.duration_sec ngoài giới hạn an toàn 10–600 (P6-07)", async () => {
    await sql.begin(async (tx) => {
      const [project] = await tx<{ id: string }[]>`
        INSERT INTO projects (title) VALUES ('bad-duration') RETURNING id
      `;
      // Khoảng của gói kiểm ở API; DB chỉ chặn giá trị vô lý.
      await tx`
        INSERT INTO briefs (
          project_id, topic, audience, goal, duration_sec, language, tone, visual_style
        ) VALUES (
          ${project!.id}, 't', 'a', 'g', 120, 'vi', 'n', 'v'
        )
      `;
      await expect(
        tx.savepoint((sp) => sp`
          INSERT INTO briefs (
            project_id, topic, audience, goal, duration_sec, language, tone, visual_style
          ) VALUES (
            ${project!.id}, 't', 'a', 'g', 601, 'vi', 'n', 'v'
          )
        `),
      ).rejects.toThrow();
      await expect(
        tx.savepoint((sp) => sp`
          INSERT INTO briefs (
            project_id, topic, audience, goal, duration_sec, language, tone, visual_style
          ) VALUES (
            ${project!.id}, 't', 'a', 'g', 9, 'vi', 'n', 'v'
          )
        `),
      ).rejects.toThrow();
      throw new Error("ROLLBACK");
    }).catch((error: unknown) => {
      if (error instanceof Error && error.message === "ROLLBACK") {
        return;
      }
      throw error;
    });
  });
});
