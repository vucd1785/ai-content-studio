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

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
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
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "briefs_duration_sec_range",
      sql`${table.durationSec} >= 30 AND ${table.durationSec} <= 90`,
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

export const workflowRuns = pgTable("workflow_runs", {
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
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

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
    check(
      "artifact_dependencies_no_self",
      sql`${table.artifactId} <> ${table.parentArtifactId}`,
    ),
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
  estimatedCostUsd: numeric("estimated_cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
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

export * from "./enums.js";
