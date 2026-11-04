import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDefaultBrandProfile, listBrandProfiles } from "./brand-profiles.js";
import { createDbConnection, type DbConnection, type StudioDb } from "./db.js";
import {
  insertMotionAssetRequests,
  listMotionAssetRequests,
  listMotionAssets,
  MotionAssetRequestError,
  resolveMotionAssetRequest,
  upsertMotionAssetFromManifest,
} from "./motion-assets.js";
import { createProject, insertBrief } from "./projects.js";

/** P6-07: kênh, thể loại, chế độ, kho tài sản (03-DATABASE-DESIGN, Phase 6). Chạy trên `studio_test`. */

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio_test";
const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle");

class Rollback extends Error {}

async function inRollback(sql: postgres.Sql, body: (tx: postgres.TransactionSql) => Promise<void>) {
  await sql
    .begin(async (tx) => {
      await body(tx);
      throw new Rollback();
    })
    .catch((error: unknown) => {
      if (!(error instanceof Rollback)) {
        throw error;
      }
    });
}

describe("P6-07 migration 0003 (Postgres)", () => {
  let sql: postgres.Sql;
  let db: StudioDb;
  let connection: DbConnection;
  const suffix = crypto.randomUUID().slice(0, 8);

  beforeAll(() => {
    sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
    connection = createDbConnection(databaseUrl);
    db = connection.db;
  });

  afterAll(async () => {
    await sql.end();
    await connection.close();
  });

  it("chạy migrate lại không lỗi và không thêm kênh", async () => {
    const before = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM brand_profiles`;
    await migrate(drizzle(sql), { migrationsFolder });
    const after = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM brand_profiles`;
    expect(after[0]?.n).toBe(before[0]?.n);
  });

  it("seed kênh mặc định có Tí, Bit nói và Đậu không nói, không có giọng", async () => {
    const brand = await getDefaultBrandProfile(db);
    expect(brand?.slug).toBe("kenh-mac-dinh");
    expect(brand?.narratorVoiceId).toBeNull();
    expect(brand?.characters.map((c) => [c.characterKey, c.role, c.speaks, c.voiceId])).toEqual([
      ["ti", "protagonist", true, null],
      ["bit", "explainer", true, null],
      ["dau", "companion", false, null],
    ]);
    const all = await listBrandProfiles(db);
    expect(all.filter((b) => b.isDefault)).toHaveLength(1);
  });

  it("project mới gắn kênh mặc định, brief mới là story v1 (migration 0005), run mới là standard", async () => {
    await inRollback(sql, async (tx) => {
      const [project] = await tx<{ id: string; slug: string }[]>`
        INSERT INTO projects (title) VALUES ('p6-07')
        RETURNING id, (SELECT slug FROM brand_profiles WHERE id = brand_profile_id) AS slug
      `;
      expect(project?.slug).toBe("kenh-mac-dinh");
      const [brief] = await tx<{ id: string; format_id: string; format_version: number }[]>`
        INSERT INTO briefs (project_id, topic, audience, goal, duration_sec, language, tone, visual_style)
        VALUES (${project!.id}, 't', 'a', 'g', 60, 'vi', 'n', 'v')
        RETURNING id, format_id, format_version
      `;
      expect([brief?.format_id, brief?.format_version]).toEqual(["story", 1]);
      const [run] = await tx<{ creative_mode: string }[]>`
        INSERT INTO workflow_runs (project_id, brief_id, status)
        VALUES (${project!.id}, ${brief!.id}, 'idea_submitted') RETURNING creative_mode
      `;
      expect(run?.creative_mode).toBe("standard");
      await expect(
        tx.savepoint(
          (sp) => sp`
          INSERT INTO workflow_runs (project_id, brief_id, status, creative_mode)
          VALUES (${project!.id}, ${brief!.id}, 'idea_submitted', 'wild')
        `,
        ),
      ).rejects.toThrow(/workflow_runs_creative_mode_valid/);
    });
  });

  it("createProject và insertBrief nhận kênh, thể loại tùy chọn", async () => {
    const brand = await getDefaultBrandProfile(db);
    const project = await createProject(db, `p6-07-${suffix}`, { brandProfileId: brand!.id });
    const brief = await insertBrief(db, project.id, {
      topic: "Nếu như…?",
      audience: "mọi người",
      goal: "giải trí",
      durationSec: 45,
      language: "vi",
      tone: "vui",
      visualStyle: "người que",
      formatId: "what_if",
      formatVersion: 1,
    });
    const [row] = await sql<{ format_id: string; brand_profile_id: string }[]>`
      SELECT b.format_id, p.brand_profile_id FROM briefs b JOIN projects p ON p.id = b.project_id
      WHERE b.id = ${brief.id}
    `;
    expect(row).toEqual({ format_id: "what_if", brand_profile_id: brand!.id });
  });

  it("chặn nhân vật không nói có giọng, khóa narrator, kênh mặc định thứ hai", async () => {
    await inRollback(sql, async (tx) => {
      const [brand] = await tx<{ id: string }[]>`
        INSERT INTO brand_profiles (slug, display_name) VALUES (${`k-${suffix}`}, 'Kênh thử') RETURNING id
      `;
      await expect(
        tx.savepoint(
          (sp) => sp`
          INSERT INTO brand_characters (brand_profile_id, character_key, display_name, role, skin_asset_id, speaks, voice_id)
          VALUES (${brand!.id}, 'dau', 'Đậu', 'companion', 'skin_dau', false, 'voice-x')
        `,
        ),
      ).rejects.toThrow(/brand_characters_voice_only_if_speaks/);
      await expect(
        tx.savepoint(
          (sp) => sp`
          INSERT INTO brand_characters (brand_profile_id, character_key, display_name, role, skin_asset_id, speaks)
          VALUES (${brand!.id}, 'narrator', 'Người dẫn', 'explainer', 'skin_ti', true)
        `,
        ),
      ).rejects.toThrow(/brand_characters_key_format/);
      await expect(
        tx.savepoint(
          (sp) => sp`UPDATE brand_profiles SET is_default = true WHERE id = ${brand!.id}`,
        ),
      ).rejects.toThrow(/brand_profiles_single_default/);
    });
  });

  it("đồng bộ manifest: cùng hash không đổi hàng; id sai định dạng bị chặn", async () => {
    const assetId = `pose_test_${suffix}`;
    const input = {
      assetId,
      kind: "pose" as const,
      version: "0.1.0",
      tags: ["test"],
      brandProfileId: null,
      createdBy: "director" as const,
      status: "approved" as const,
      sourcePath: `packages/motion-kit/src/assets/pose/${assetId}/asset.json`,
      previewStorageKey: null,
      manifestHash: "h1",
    };
    expect((await upsertMotionAssetFromManifest(db, input)).changed).toBe(true);
    expect((await upsertMotionAssetFromManifest(db, input)).changed).toBe(false);
    const changed = await upsertMotionAssetFromManifest(db, {
      ...input,
      manifestHash: "h2",
      version: "0.2.0",
    });
    expect([changed.changed, changed.row.version]).toEqual([true, "0.2.0"]);
    const approved = await listMotionAssets(db, { status: "approved", kind: "pose" });
    expect(approved.some((a) => a.assetId === assetId)).toBe(true);

    await expect(
      upsertMotionAssetFromManifest(db, { ...input, assetId: "Bad-Id", manifestHash: "x" }),
    ).rejects.toThrow();
    await expect(
      upsertMotionAssetFromManifest(db, {
        ...input,
        assetId: `bad_path_${suffix}`,
        sourcePath: "../x",
      }),
    ).rejects.toThrow();
  });

  it("yêu cầu tài sản: ghi lại không trùng, fulfilled chỉ với tài sản approved, không tạo approval", async () => {
    const [run] = await sql<{ run_id: string; project_id: string }[]>`
      WITH p AS (INSERT INTO projects (title) VALUES (${`req-${suffix}`}) RETURNING id),
      b AS (
        INSERT INTO briefs (project_id, topic, audience, goal, duration_sec, language, tone, visual_style)
        SELECT id, 't', 'a', 'g', 60, 'vi', 'n', 'v' FROM p RETURNING id, project_id
      )
      INSERT INTO workflow_runs (project_id, brief_id, status, creative_mode)
      SELECT project_id, id, 'waiting_script_approval', 'creative' FROM b
      RETURNING id AS run_id, project_id
    `;
    const [artifact] = await sql<{ id: string }[]>`
      INSERT INTO artifacts (project_id, workflow_run_id, type, version, schema_version, content_hash, storage_key)
      VALUES (${run!.project_id}, ${run!.run_id}, 'script', 1, '2', 'hash', ${`artifacts/${suffix}/script.json`})
      RETURNING id
    `;
    const target = {
      workflowRunId: run!.run_id,
      scriptArtifactId: artifact!.id,
      variantIndex: 1 as const,
    };
    const requests = [
      {
        sceneId: "s1",
        requestKey: "r1",
        kind: "action" as const,
        description: "Tí vấp ngã",
        fallbackAssetId: "action_ti_scared",
      },
      {
        sceneId: "s2",
        requestKey: "r2",
        kind: "prop" as const,
        description: "cái ô",
        fallbackAssetId: "prop_box",
      },
    ];
    expect(await insertMotionAssetRequests(db, target, requests)).toBe(2);
    expect(await insertMotionAssetRequests(db, target, requests)).toBe(0);
    const open = await listMotionAssetRequests(db, { workflowRunId: run!.run_id, status: "open" });
    expect(open.map((r) => r.requestKey)).toEqual(["r1", "r2"]);

    const candidateId = `action_candidate_${suffix}`;
    await upsertMotionAssetFromManifest(db, {
      assetId: candidateId,
      kind: "action",
      version: "0.1.0",
      tags: [],
      brandProfileId: null,
      createdBy: "claude-code",
      status: "candidate",
      sourcePath: `packages/motion-kit/src/assets/action/${candidateId}/asset.json`,
      previewStorageKey: null,
      manifestHash: "c1",
    });
    const r1 = open[0]!;
    await expect(
      resolveMotionAssetRequest(db, r1.id, { status: "fulfilled", assetId: candidateId }),
    ).rejects.toMatchObject({
      code: "asset_not_approved",
    } satisfies Partial<MotionAssetRequestError>);

    const approvedId = `action_approved_${suffix}`;
    await upsertMotionAssetFromManifest(db, {
      assetId: approvedId,
      kind: "action",
      version: "0.1.0",
      tags: [],
      brandProfileId: null,
      createdBy: "claude-code",
      status: "approved",
      sourcePath: `packages/motion-kit/src/assets/action/${approvedId}/asset.json`,
      previewStorageKey: null,
      manifestHash: "a1",
    });
    const fulfilled = await resolveMotionAssetRequest(db, r1.id, {
      status: "fulfilled",
      assetId: approvedId,
    });
    expect([fulfilled.status, fulfilled.fulfilledAssetId]).toEqual(["fulfilled", approvedId]);
    await expect(
      resolveMotionAssetRequest(db, r1.id, { status: "dismissed" }),
    ).rejects.toMatchObject({
      code: "not_open",
    });
    const dismissed = await resolveMotionAssetRequest(db, open[1]!.id, { status: "dismissed" });
    expect([dismissed.status, dismissed.fulfilledAssetId]).toEqual(["dismissed", null]);

    await expect(
      sql`UPDATE motion_asset_requests SET fulfilled_asset_id = NULL, status = 'fulfilled' WHERE id = ${r1.id}`,
    ).rejects.toThrow(/motion_asset_requests_fulfilled/);

    const approvals = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM approvals WHERE workflow_run_id = ${run!.run_id}
    `;
    const status = await sql<
      { status: string }[]
    >`SELECT status FROM workflow_runs WHERE id = ${run!.run_id}`;
    expect(approvals[0]?.n).toBe(0);
    expect(status[0]?.status).toBe("waiting_script_approval");
  });
});
