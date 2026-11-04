import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  agentRunRoleEnum,
  agentRunStatusEnum,
  approvalDecisionEnum,
  approvalGateEnum,
  artifactTypeEnum,
  eventTypeEnum,
  jobQueueEnum,
  jobStatusEnum,
  referenceKindEnum,
  voiceProfileKindEnum,
  workflowResumeFromEnum,
  workflowRunStatusEnum,
} from "./enums.js";

/** Kênh (ADR-013, P6-07). Đúng một hàng `is_default`. */
export const brandProfiles = pgTable(
  "brand_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    palette: jsonb("palette").notNull().default({}),
    fonts: jsonb("fonts").notNull().default({}),
    introAssetId: text("intro_asset_id"),
    outroAssetId: text("outro_asset_id"),
    sonicLogoAssetId: text("sonic_logo_asset_id"),
    toneRules: text("tone_rules").notNull().default(""),
    /** Null là dùng `TTS_DEFAULT_VOICE`. Agent không điền giá trị này. */
    narratorVoiceId: text("narrator_voice_id"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("brand_profiles_slug_unique").on(table.slug),
    uniqueIndex("brand_profiles_single_default").on(table.isDefault).where(sql`${table.isDefault}`),
    check("brand_profiles_slug_format", sql`${table.slug} ~ '^[a-z0-9-]{1,40}$'`),
  ],
);

/** Dàn nhân vật của kênh (ADR-013, ADR-015). `character_key` là `speaker` trong script `2`. */
export const brandCharacters = pgTable(
  "brand_characters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    brandProfileId: uuid("brand_profile_id")
      .notNull()
      .references(() => brandProfiles.id, { onDelete: "cascade" }),
    characterKey: text("character_key").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role").notNull(),
    skinAssetId: text("skin_asset_id").notNull(),
    personality: text("personality").notNull().default(""),
    catchphrases: jsonb("catchphrases").notNull().default([]),
    signatureActionId: text("signature_action_id"),
    speaks: boolean("speaks").notNull(),
    /** `provider_voice_id` do service TTS trả về; Director chọn. */
    voiceId: text("voice_id"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("brand_characters_key_unique").on(table.brandProfileId, table.characterKey),
    check(
      "brand_characters_key_format",
      sql`${table.characterKey} ~ '^[a-z][a-z0-9_]{0,31}$' AND ${table.characterKey} <> 'narrator'`,
    ),
    check(
      "brand_characters_role_valid",
      sql`${table.role} IN ('protagonist', 'explainer', 'companion')`,
    ),
    check(
      "brand_characters_voice_only_if_speaks",
      sql`${table.speaks} OR ${table.voiceId} IS NULL`,
    ),
  ],
);

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  /** Mặc định là kênh `is_default`, qua hàm SQL của migration 0003. */
  brandProfileId: uuid("brand_profile_id")
    .notNull()
    .default(sql`studio_default_brand_profile_id()`)
    .references(() => brandProfiles.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const briefs = pgTable(
  "briefs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "restrict" }),
    topic: text("topic").notNull(),
    audience: text("audience").notNull(),
    goal: text("goal").notNull(),
    durationSec: integer("duration_sec").notNull(),
    language: text("language").notNull(),
    tone: text("tone").notNull(),
    visualStyle: text("visual_style").notNull(),
    notes: text("notes"),
    /** Gói thể loại trong `packages/contracts` (ADR-013). Khoảng thời lượng thật kiểm ở API theo gói. */
    formatId: text("format_id").notNull().default("story"),
    formatVersion: integer("format_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "briefs_duration_sec_range",
      sql`${table.durationSec} >= 10 AND ${table.durationSec} <= 600`,
    ),
  ],
);

export const references = pgTable("references", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "restrict" }),
  kind: referenceKindEnum("kind").notNull(),
  uri: text("uri").notNull(),
  title: text("title"),
  mediaType: text("media_type"),
  byteSize: integer("byte_size"),
  contentHash: text("content_hash"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "restrict" }),
    briefId: uuid("brief_id")
      .notNull()
      .references(() => briefs.id, { onDelete: "restrict" }),
    status: workflowRunStatusEnum("status").notNull(),
    resumeFrom: workflowResumeFromEnum("resume_from"),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    /** Model LLM Director chọn khi bắt đầu run (P3-12); null là model mặc định của worker. */
    llmModel: text("llm_model"),
    /** `standard` hoặc `creative` (ADR-016); chọn khi bắt đầu run, không đổi sau đó. */
    creativeMode: text("creative_mode").notNull().default("standard"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "workflow_runs_creative_mode_valid",
      sql`${table.creativeMode} IN ('standard', 'creative')`,
    ),
  ],
);

export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  workflowRunId: uuid("workflow_run_id")
    .notNull()
    .references(() => workflowRuns.id, { onDelete: "restrict" }),
  role: agentRunRoleEnum("role").notNull(),
  status: agentRunStatusEnum("status").notNull(),
  attempt: integer("attempt").notNull().default(0),
  inputHash: text("input_hash"),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
  finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
});

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentRunId: uuid("agent_run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "restrict" }),
    queue: jobQueueEnum("queue").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    bullmqJobId: text("bullmq_job_id"),
    status: jobStatusEnum("status").notNull(),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(2),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("jobs_idempotency_key_unique").on(table.idempotencyKey)],
);

export const artifacts = pgTable(
  "artifacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "restrict" }),
    workflowRunId: uuid("workflow_run_id")
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "restrict" }),
    type: artifactTypeEnum("type").notNull(),
    version: integer("version").notNull(),
    schemaVersion: text("schema_version").notNull(),
    contentHash: text("content_hash").notNull(),
    storageKey: text("storage_key").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "artifacts_storage_key_safe",
      sql`${table.storageKey} NOT LIKE '%..%' AND ${table.storageKey} NOT LIKE '/%'`,
    ),
  ],
);

export const artifactDependencies = pgTable(
  "artifact_dependencies",
  {
    artifactId: uuid("artifact_id")
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
    parentArtifactId: uuid("parent_artifact_id")
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.artifactId, table.parentArtifactId] }),
    check("artifact_dependencies_no_self", sql`${table.artifactId} <> ${table.parentArtifactId}`),
  ],
);

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workflowRunId: uuid("workflow_run_id")
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "restrict" }),
    gate: approvalGateEnum("gate").notNull(),
    decision: approvalDecisionEnum("decision").notNull(),
    artifactId: uuid("artifact_id")
      .notNull()
      .references(() => artifacts.id, { onDelete: "restrict" }),
    /** Phương án được duyệt (1 hoặc 2) của artifact script; chỉ có khi `script` + `approved` (quyết định 6). */
    variantIndex: integer("variant_index"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "approvals_variant_index_valid",
      sql`${table.variantIndex} IS NULL OR (${table.gate} = 'script' AND ${table.decision} = 'approved' AND ${table.variantIndex} IN (1, 2))`,
    ),
  ],
);

export const events = pgTable(
  "events",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    workflowRunId: uuid("workflow_run_id")
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "restrict" }),
    agentRunId: uuid("agent_run_id").references(() => agentRuns.id, { onDelete: "set null" }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    type: eventTypeEnum("type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("events_workflow_run_id_id_idx").on(table.workflowRunId, table.id)],
);

export const usageRecords = pgTable("usage_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  workflowRunId: uuid("workflow_run_id")
    .notNull()
    .references(() => workflowRuns.id, { onDelete: "restrict" }),
  agentRunId: uuid("agent_run_id")
    .notNull()
    .references(() => agentRuns.id, { onDelete: "restrict" }),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  thinkingTokens: integer("thinking_tokens").notNull().default(0),
  estimatedCostUsd: numeric("estimated_cost_usd", { precision: 12, scale: 6 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const voiceProfiles = pgTable(
  "voice_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(),
    providerVoiceId: text("provider_voice_id").notNull(),
    displayName: text("display_name").notNull(),
    kind: voiceProfileKindEnum("kind").notNull(),
    consentRecordedAt: timestamp("consent_recorded_at", { withTimezone: true, mode: "date" }),
    enabled: boolean("enabled").notNull().default(false),
  },
  (table) => [
    check(
      "voice_profiles_clone_requires_consent",
      sql`(${table.kind} <> 'clone') OR (${table.consentRecordedAt} IS NOT NULL)`,
    ),
  ],
);

const MOTION_ASSET_KINDS = sql.raw(
  "'character_skin', 'expression', 'pose', 'action', 'background', 'prop', 'camera', 'sfx', 'brand_card'",
);

/** Bản sao chỉ đọc của `asset.json` trong `packages/motion-kit` (ADR-016). Script đồng bộ là nguồn ghi duy nhất. */
export const motionAssets = pgTable(
  "motion_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assetId: text("asset_id").notNull(),
    kind: text("kind").notNull(),
    version: text("version").notNull(),
    tags: jsonb("tags").notNull().default([]),
    /** Null là tài sản dùng chung mọi kênh. */
    brandProfileId: uuid("brand_profile_id").references(() => brandProfiles.id, {
      onDelete: "restrict",
    }),
    createdBy: text("created_by").notNull(),
    status: text("status").notNull(),
    sourcePath: text("source_path").notNull(),
    previewStorageKey: text("preview_storage_key"),
    manifestHash: text("manifest_hash").notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("motion_assets_asset_id_unique").on(table.assetId),
    check("motion_assets_asset_id_format", sql`${table.assetId} ~ '^[a-z0-9_]{1,64}$'`),
    check("motion_assets_kind_valid", sql`${table.kind} IN (${MOTION_ASSET_KINDS})`),
    check("motion_assets_created_by_valid", sql`${table.createdBy} IN ('director', 'claude-code')`),
    check("motion_assets_status_valid", sql`${table.status} IN ('candidate', 'approved')`),
    check(
      "motion_assets_paths_safe",
      sql`${table.sourcePath} NOT LIKE '%..%' AND ${table.sourcePath} NOT LIKE '/%' AND (${table.previewStorageKey} IS NULL OR (${table.previewStorageKey} NOT LIKE '%..%' AND ${table.previewStorageKey} NOT LIKE '/%'))`,
    ),
  ],
);

/** Yêu cầu tài sản mới từ run `creative` (ADR-016). Ghi bảng này không phải approval. */
export const motionAssetRequests = pgTable(
  "motion_asset_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workflowRunId: uuid("workflow_run_id")
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "restrict" }),
    scriptArtifactId: uuid("script_artifact_id")
      .notNull()
      .references(() => artifacts.id, { onDelete: "restrict" }),
    variantIndex: integer("variant_index").notNull(),
    sceneId: text("scene_id").notNull(),
    requestKey: text("request_key").notNull(),
    kind: text("kind").notNull(),
    description: text("description").notNull(),
    fallbackAssetId: text("fallback_asset_id").notNull(),
    status: text("status").notNull().default("open"),
    fulfilledAssetId: text("fulfilled_asset_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("motion_asset_requests_key_unique").on(
      table.scriptArtifactId,
      table.variantIndex,
      table.requestKey,
    ),
    index("motion_asset_requests_run_idx").on(table.workflowRunId),
    check("motion_asset_requests_variant_valid", sql`${table.variantIndex} IN (1, 2)`),
    check("motion_asset_requests_kind_valid", sql`${table.kind} IN (${MOTION_ASSET_KINDS})`),
    check(
      "motion_asset_requests_status_valid",
      sql`${table.status} IN ('open', 'fulfilled', 'dismissed')`,
    ),
    check(
      "motion_asset_requests_fulfilled",
      sql`(${table.status} = 'fulfilled') = (${table.fulfilledAssetId} IS NOT NULL)`,
    ),
  ],
);

export * from "./enums.js";
