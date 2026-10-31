import { z } from "zod/v4";

export const approvalGateSchema = z.enum(["script", "final"]);
export const approvalDecisionSchema = z.enum(["approved", "rejected", "changes_requested"]);

export type ApprovalGate = z.infer<typeof approvalGateSchema>;
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;

export const workflowRunStatusSchema = z.enum([
  "idea_submitted",
  "researching",
  "research_ready",
  "scripting",
  "waiting_script_approval",
  "producing_assets",
  "preview_rendering",
  "qa",
  "waiting_final_approval",
  "exporting",
  "exported",
  "failed",
  "cancelled",
]);

export type WorkflowRunStatus = z.infer<typeof workflowRunStatusSchema>;

/**
 * docs/07-API-CONTRACTS.md mục Workflow và approval. Không default cho `decision` (ADR-004).
 * `changes_requested` và `rejected` bắt buộc `note` 1–2000 ký tự; `approved` cho phép rỗng.
 */
export const approvalBodySchema = z
  .object({
    gate: approvalGateSchema,
    decision: approvalDecisionSchema,
    artifactId: z.uuid(),
    /** Phương án được duyệt ở cổng script (quyết định 6): bắt buộc khi `script` + `approved`, cấm ở chỗ khác. */
    variantIndex: z.union([z.literal(1), z.literal(2)]).optional(),
    note: z.string().max(2000).optional(),
  })
  .superRefine((value, ctx) => {
    const needsVariant = value.gate === "script" && value.decision === "approved";
    if (needsVariant && value.variantIndex === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["variantIndex"],
        message: "variantIndex là bắt buộc khi duyệt cổng script",
      });
    }
    if (!needsVariant && value.variantIndex !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["variantIndex"],
        message: "variantIndex chỉ dùng khi duyệt cổng script",
      });
    }
    if (value.decision !== "approved" && (value.note === undefined || value.note.trim() === "")) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "note là bắt buộc khi decision khác approved",
      });
    }
  });

export type ApprovalBody = z.infer<typeof approvalBodySchema>;

export const approvalSchema = z.object({
  id: z.uuid(),
  workflowRunId: z.uuid(),
  gate: approvalGateSchema,
  decision: approvalDecisionSchema,
  artifactId: z.uuid(),
  variantIndex: z.number().int().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
});

export type Approval = z.infer<typeof approvalSchema>;

export const workflowRunSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  briefId: z.uuid(),
  status: workflowRunStatusSchema,
  resumeFrom: z.string().nullable(),
  failureCode: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const approvalCreatedResponseSchema = z.object({
  approval: approvalSchema,
  workflowRun: workflowRunSchema,
});

export const workflowRunDetailResponseSchema = z.object({
  workflowRun: workflowRunSchema,
  agentRuns: z.array(
    z.object({
      id: z.uuid(),
      role: z.string(),
      status: z.string(),
    }),
  ),
  approvals: z.array(approvalSchema),
  artifacts: z.array(
    z.object({
      id: z.uuid(),
      type: z.string(),
      version: z.number().int(),
      createdAt: z.string(),
    }),
  ),
});

export const runIdParamsSchema = z.object({
  runId: z.uuid(),
});

/** Enum `event_type` (docs/03-DATABASE-DESIGN.md). */
export const eventTypeSchema = z.enum([
  "workflow.transition",
  "agent.status",
  "job.progress",
  "job.completed",
  "job.failed",
  "approval.recorded",
]);

export type EventType = z.infer<typeof eventTypeSchema>;

const EVENT_ID_PATTERN = /^(0|[1-9][0-9]{0,18})$/;

/**
 * `events.id` là bigint: nhận chuỗi số nguyên không âm, tối đa giới hạn bigint của Postgres.
 * Zod v4 vẫn chạy `refine` khi regex đã fail, nên refine tự kiểm pattern trước khi gọi `BigInt`.
 */
export const eventIdSchema = z
  .string()
  .regex(EVENT_ID_PATTERN)
  .refine((value) => EVENT_ID_PATTERN.test(value) && BigInt(value) <= 9_223_372_036_854_775_807n);

/** Query của `GET /api/workflow-runs/:runId/events/stream` (docs/07-API-CONTRACTS.md mục SSE). */
export const eventStreamQuerySchema = z.object({
  afterId: eventIdSchema.optional(),
});

/**
 * Field `data` của một event SSE: payload đã lưu, cộng `workflowRunId` của hàng.
 * `job.progress` giữ nguyên payload callback Remotion.
 */
export const eventStreamDataSchema = z
  .object({ workflowRunId: z.uuid() })
  .catchall(z.unknown());

export type EventStreamData = z.infer<typeof eventStreamDataSchema>;

/** Một hàng `usage_records`. `estimatedCostUsd` là chuỗi numeric đã lưu, không phải hóa đơn. */
export const usageRecordSchema = z.object({
  id: z.uuid(),
  workflowRunId: z.uuid(),
  agentRunId: z.uuid(),
  provider: z.string(),
  model: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  thinkingTokens: z.number().int().nonnegative(),
  estimatedCostUsd: z.string(),
  createdAt: z.string(),
});

export type UsageRecord = z.infer<typeof usageRecordSchema>;

/** `GET /api/workflow-runs/:runId/usage`. */
export const usageListResponseSchema = z.object({
  usageRecords: z.array(usageRecordSchema),
});

/** Loại artifact là file media; route đọc trả metadata, nội dung stream qua `/media` (07-API-CONTRACTS). */
export const MEDIA_ARTIFACT_TYPES = ["audio", "preview", "export"] as const;

export const artifactIdParamsSchema = z.object({
  artifactId: z.uuid(),
});

/**
 * `GET /api/artifacts/:artifactId` (Director chốt 2026-10-31 cùng định dạng artifact script).
 * `content` là JSON đã lưu cho artifact JSON; `null` cho media. Không trả `storage_key`.
 */
export const artifactDetailResponseSchema = z.object({
  artifact: z.object({
    id: z.uuid(),
    projectId: z.uuid(),
    workflowRunId: z.uuid(),
    type: z.string(),
    version: z.number().int(),
    schemaVersion: z.string(),
    contentHash: z.string(),
    metadata: z.record(z.string(), z.unknown()),
    createdAt: z.string(),
  }),
  content: z.unknown().nullable(),
});

export type ArtifactDetailResponse = z.infer<typeof artifactDetailResponseSchema>;
