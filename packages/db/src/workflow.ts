import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  assetJobKeyAfterScriptApproval,
  exportJobKeyAfterApproval,
  insertQueuedJob,
  scriptJobKeyAfterChangesRequested,
} from "./agent-jobs.js";
import { getBrandProfileById } from "./brand-profiles.js";
import type { StudioDb } from "./db.js";
import { publishEvents } from "./events.js";
import {
  agentRuns,
  approvals,
  artifactDependencies,
  artifacts,
  briefs,
  events,
  jobs,
  projects,
  references,
  usageRecords,
  workflowRuns,
} from "./schema/index.js";

export type StudioTx = Parameters<Parameters<StudioDb["transaction"]>[0]>[0];

/** Key job storyboard sau một job script `2` (P6-10): queue `render`, vai `visual`. */
export function storyboardJobKeyAfterScript(workflowRunId: string, scriptJobId: string): string {
  return `storyboard:${workflowRunId}:script:${scriptJobId}`;
}

/** Job visual của Phase 6 dựng storyboard ảnh tĩnh, khác job visual cũ sau duyệt script. */
export function isStoryboardJobKey(idempotencyKey: string): boolean {
  return idempotencyKey.startsWith("storyboard:");
}

/** Kênh của run qua project (P6-10): tính cách, giọng điệu, nhân vật cho prompt script `2`. */
export async function loadRunBrandProfile(db: StudioDb, workflowRunId: string) {
  const [row] = await db
    .select({ brandProfileId: projects.brandProfileId })
    .from(workflowRuns)
    .innerJoin(projects, eq(projects.id, workflowRuns.projectId))
    .where(eq(workflowRuns.id, workflowRunId))
    .limit(1);
  return row === undefined ? null : getBrandProfileById(db, row.brandProfileId);
}

type WorkflowRunStatus = (typeof workflowRuns.$inferSelect)["status"];
type ApprovalGate = (typeof approvals.$inferSelect)["gate"];
type ApprovalDecision = (typeof approvals.$inferSelect)["decision"];
type ArtifactType = (typeof artifacts.$inferSelect)["type"];

/** Trạng thái mà mỗi cổng chờ (docs/04-AGENT-ORCHESTRATION.md). */
export const APPROVAL_GATE_STATUS: Record<ApprovalGate, WorkflowRunStatus> = {
  script: "waiting_script_approval",
  final: "waiting_final_approval",
};

/** Artifact mà mỗi cổng duyệt: script duyệt artifact `script`, final duyệt `preview` (ADR-004). */
export const APPROVAL_GATE_ARTIFACT_TYPE: Record<ApprovalGate, ArtifactType> = {
  script: "script",
  final: "preview",
};

/**
 * Trạng thái kế tiếp sau decision. `rejected` giữ nguyên cổng.
 * script: changes_requested → scripting, approved → producing_assets.
 * final: changes_requested → scripting (viết lại kịch bản theo ghi chú, P3-14), approved → exporting.
 */
export function nextStatusAfterApproval(
  gate: ApprovalGate,
  decision: ApprovalDecision,
): WorkflowRunStatus {
  if (decision === "rejected") {
    return APPROVAL_GATE_STATUS[gate];
  }
  if (gate === "script") {
    return decision === "approved" ? "producing_assets" : "scripting";
  }
  return decision === "approved" ? "exporting" : "scripting";
}

export class ApprovalError extends Error {
  readonly code:
    | "not_found"
    | "invalid_transition"
    | "artifact_mismatch"
    | "invalid_variant"
    | "qa_not_passed";

  constructor(code: ApprovalError["code"], message: string) {
    super(message);
    this.name = "ApprovalError";
    this.code = code;
  }
}

export type RecordApprovalInput = {
  workflowRunId: string;
  gate: ApprovalGate;
  decision: ApprovalDecision;
  artifactId: string;
  /** Chỉ có khi `script` + `approved` (contract kiểm; DB có CHECK). */
  variantIndex?: 1 | 2 | null;
  note: string | null;
};

type EventInsert = typeof events.$inferInsert;

export type RecordApprovalDeps = {
  /** Thay được trong test để chứng minh rollback khi insert event lỗi. */
  insertEvents: (tx: StudioTx, rows: EventInsert[]) => Promise<void>;
};

const defaultDeps: RecordApprovalDeps = {
  insertEvents: async (tx, rows) => {
    await publishEvents(tx, rows);
  },
};

function toIso(date: Date): string {
  return date.toISOString();
}

type WorkflowRunRow = typeof workflowRuns.$inferSelect;

export function mapWorkflowRunRow(row: WorkflowRunRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    briefId: row.briefId,
    status: row.status,
    resumeFrom: row.resumeFrom,
    failureCode: row.failureCode,
    failureMessage: row.failureMessage,
    llmModel: row.llmModel,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function mapApprovalRow(row: typeof approvals.$inferSelect) {
  return {
    id: row.id,
    workflowRunId: row.workflowRunId,
    gate: row.gate,
    decision: row.decision,
    artifactId: row.artifactId,
    variantIndex: row.variantIndex,
    note: row.note,
    createdAt: toIso(row.createdAt),
  };
}

/**
 * Hàm duy nhất ghi `approvals` (docs/08-SECURITY.md). Chỉ route approval gọi.
 * Một transaction: khóa run, kiểm cổng và artifact, insert approval, đổi status, insert event.
 */
export async function recordApproval(
  db: StudioDb,
  input: RecordApprovalInput,
  deps: RecordApprovalDeps = defaultDeps,
) {
  // Quyết định 6: duyệt cổng script phải nói rõ phương án; chỗ khác không được có phương án.
  const needsVariant = input.gate === "script" && input.decision === "approved";
  if (needsVariant !== (input.variantIndex !== undefined && input.variantIndex !== null)) {
    throw new ApprovalError("invalid_variant", "variantIndex is required only for script approval");
  }
  return db.transaction(async (tx) => {
    const [run] = await tx
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.id, input.workflowRunId))
      .for("update")
      .limit(1);
    if (run === undefined) {
      throw new ApprovalError("not_found", "workflow run not found");
    }
    if (run.status !== APPROVAL_GATE_STATUS[input.gate]) {
      throw new ApprovalError("invalid_transition", "gate does not match workflow status");
    }

    const [artifact] = await tx
      .select({ id: artifacts.id, type: artifacts.type })
      .from(artifacts)
      .where(and(eq(artifacts.id, input.artifactId), eq(artifacts.workflowRunId, run.id)))
      .limit(1);
    if (artifact === undefined) {
      throw new ApprovalError("not_found", "artifact not found in workflow run");
    }
    if (artifact.type !== APPROVAL_GATE_ARTIFACT_TYPE[input.gate]) {
      throw new ApprovalError("artifact_mismatch", "artifact type does not match gate");
    }
    // P3-06 (05-VIDEO-PIPELINE mục QA): error trong QA chặn duyệt final của đúng preview đó.
    if (input.gate === "final" && input.decision === "approved") {
      const [qa] = await tx
        .select({ metadata: artifacts.metadata })
        .from(artifacts)
        .where(
          and(
            eq(artifacts.workflowRunId, run.id),
            eq(artifacts.type, "qa_report"),
            sql`${artifacts.metadata} ->> 'previewArtifactId' = ${artifact.id}`,
          ),
        )
        .orderBy(desc(artifacts.version))
        .limit(1);
      if ((qa?.metadata as { passed?: unknown } | undefined)?.passed !== true) {
        throw new ApprovalError("qa_not_passed", "preview has no passing qa_report");
      }
    }

    const [approval] = await tx
      .insert(approvals)
      .values({
        workflowRunId: run.id,
        gate: input.gate,
        decision: input.decision,
        artifactId: artifact.id,
        variantIndex: input.variantIndex ?? null,
        note: input.note,
      })
      .returning();
    if (approval === undefined) {
      throw new Error("insert_approval_failed");
    }

    const nextStatus = nextStatusAfterApproval(input.gate, input.decision);
    const [updated] = await tx
      .update(workflowRuns)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(workflowRuns.id, run.id))
      .returning();
    if (updated === undefined) {
      throw new Error("update_workflow_run_failed");
    }

    const eventRows: EventInsert[] = [
      {
        workflowRunId: run.id,
        type: "approval.recorded",
        payload: {
          approvalId: approval.id,
          gate: approval.gate,
          decision: approval.decision,
          artifactId: approval.artifactId,
          ...(approval.variantIndex === null ? {} : { variantIndex: approval.variantIndex }),
        },
      },
    ];
    if (nextStatus !== run.status) {
      eventRows.push({
        workflowRunId: run.id,
        type: "workflow.transition",
        payload: { from: run.status, to: nextStatus, cause: "approval", approvalId: approval.id },
      });
    }

    // Cổng script (P3-04): agent script đang chờ duyệt xong lượt của nó khi Director duyệt hoặc yêu cầu sửa.
    // `changes_requested` tạo job script mới cùng transaction; job đó đọc note qua approval id trong key.
    // Không tạo job research: research đã có artifact và không chạy lại.
    if (input.gate === "script" && input.decision !== "rejected") {
      const waiting = await tx
        .update(agentRuns)
        .set({ status: "completed" })
        .where(
          and(
            eq(agentRuns.workflowRunId, run.id),
            eq(agentRuns.role, "script"),
            eq(agentRuns.status, "waiting_approval"),
          ),
        )
        .returning({ id: agentRuns.id });
      for (const agent of waiting) {
        eventRows.push({
          workflowRunId: run.id,
          agentRunId: agent.id,
          type: "agent.status",
          payload: { role: "script", status: "completed" },
        });
      }
      if (input.decision === "changes_requested") {
        const created = await insertQueuedJob(tx, run.id, {
          role: "script",
          queue: "llm",
          idempotencyKey: scriptJobKeyAfterChangesRequested(run.id, approval.id),
        });
        eventRows.push(created.event);
      }
      // P3-05: duyệt script tạo visual (queue llm) và voice (queue media) cùng lúc; hai job chạy song song.
      if (input.decision === "approved") {
        for (const [role, queue] of [
          ["visual", "llm"],
          ["voice", "media"],
        ] as const) {
          const created = await insertQueuedJob(tx, run.id, {
            role,
            queue,
            idempotencyKey: assetJobKeyAfterScriptApproval(role, run.id, approval.id),
          });
          eventRows.push(created.event);
        }
      }
    }
    // P3-14: yêu cầu sửa bản cuối tạo job script mới như ở cổng script; job đọc ghi chú qua approval id trong key.
    // Research không chạy lại. Kịch bản mới phải được duyệt lại, rồi giọng, hình và render chạy lại từ đó.
    if (input.gate === "final" && input.decision === "changes_requested") {
      const created = await insertQueuedJob(tx, run.id, {
        role: "script",
        queue: "llm",
        idempotencyKey: scriptJobKeyAfterChangesRequested(run.id, approval.id),
      });
      eventRows.push(created.event);
    }
    // P3-06: duyệt final tạo job export; job chỉ export đúng preview mà approval này trỏ tới.
    if (input.gate === "final" && input.decision === "approved") {
      const created = await insertQueuedJob(tx, run.id, {
        role: "video",
        queue: "render",
        idempotencyKey: exportJobKeyAfterApproval(run.id, approval.id),
      });
      eventRows.push(created.event);
    }
    await deps.insertEvents(tx, eventRows);

    return { approval: mapApprovalRow(approval), workflowRun: mapWorkflowRunRow(updated) };
  });
}

export class ExportNotAllowedError extends Error {
  readonly code = "approval_required" as const;

  constructor(message: string) {
    super(message);
    this.name = "ExportNotAllowedError";
  }
}

/**
 * Export chỉ được với preview mà decision `final` mới nhất của run đã `approved` (ADR-004,
 * 04-AGENT-ORCHESTRATION mục Approval). Preview khác, hay approval đã bị decision sau thay thế, là `approval_required`.
 */
export async function assertExportAllowed(
  db: StudioDb,
  workflowRunId: string,
  previewArtifactId: string,
) {
  const [latest] = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.workflowRunId, workflowRunId), eq(approvals.gate, "final")))
    .orderBy(desc(approvals.createdAt), desc(approvals.id))
    .limit(1);
  if (
    latest === undefined ||
    latest.decision !== "approved" ||
    latest.artifactId !== previewArtifactId
  ) {
    throw new ExportNotAllowedError("preview is not the approved final preview");
  }
  return mapApprovalRow(latest);
}

/** Chỉ đọc. Không tạo run, agent, approval. */
type JobProgressRow = {
  done: number;
  total: number;
  unit: "scene_step" | "frame";
  sceneIndex: number | null;
  sceneCount: number | null;
  phase: "synthesize" | "align" | null;
};

function positiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

/** Đọc payload `job.progress` đã chuẩn hóa (P3-17); payload khác (cũ, thiếu field) trả null. */
export function readJobProgress(payload: unknown): JobProgressRow | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const value = payload as Record<string, unknown>;
  const total = positiveInt(value.total);
  const done =
    typeof value.done === "number" && Number.isInteger(value.done) && value.done >= 0
      ? value.done
      : null;
  if (total === null || done === null || (value.unit !== "scene_step" && value.unit !== "frame")) {
    return null;
  }
  return {
    done: Math.min(done, total),
    total,
    unit: value.unit,
    sceneIndex: positiveInt(value.sceneIndex),
    sceneCount: positiveInt(value.sceneCount),
    phase: value.phase === "synthesize" || value.phase === "align" ? value.phase : null,
  };
}

export async function getWorkflowRunDetail(db: StudioDb, runId: string) {
  const [run] = await db.select().from(workflowRuns).where(eq(workflowRuns.id, runId)).limit(1);
  if (run === undefined) {
    return null;
  }
  const agentRows = await db
    .select({
      id: agentRuns.id,
      role: agentRuns.role,
      status: agentRuns.status,
      startedAt: agentRuns.startedAt,
      finishedAt: agentRuns.finishedAt,
      errorCode: agentRuns.errorCode,
      errorMessage: agentRuns.errorMessage,
    })
    .from(agentRuns)
    .where(eq(agentRuns.workflowRunId, runId));
  // P3-17: event tiến độ mới nhất của từng agent; chỉ dùng khi thuộc lượt chạy hiện tại (sau `startedAt`).
  const progressRows = await db
    .selectDistinctOn([events.agentRunId], {
      agentRunId: events.agentRunId,
      payload: events.payload,
      createdAt: events.createdAt,
    })
    .from(events)
    .where(and(eq(events.workflowRunId, runId), eq(events.type, "job.progress")))
    .orderBy(events.agentRunId, desc(events.id));
  const progressByAgent = new Map(progressRows.map((row) => [row.agentRunId, row]));
  const approvalRows = await db
    .select()
    .from(approvals)
    .where(eq(approvals.workflowRunId, runId))
    .orderBy(asc(approvals.createdAt));
  const artifactRows = await db
    .select({
      id: artifacts.id,
      type: artifacts.type,
      version: artifacts.version,
      createdAt: artifacts.createdAt,
    })
    .from(artifacts)
    .where(eq(artifacts.workflowRunId, runId))
    .orderBy(desc(artifacts.createdAt));
  return {
    workflowRun: mapWorkflowRunRow(run),
    agentRuns: agentRows.map((row) => {
      const latest = progressByAgent.get(row.id);
      const current =
        latest !== undefined && row.startedAt !== null && latest.createdAt >= row.startedAt
          ? readJobProgress(latest.payload)
          : null;
      return {
        ...row,
        startedAt: row.startedAt === null ? null : toIso(row.startedAt),
        finishedAt: row.finishedAt === null ? null : toIso(row.finishedAt),
        progress: current,
      };
    }),
    approvals: approvalRows.map(mapApprovalRow),
    artifacts: artifactRows.map((row) => ({ ...row, createdAt: toIso(row.createdAt) })),
  };
}

/** Một artifact theo id, gồm `storageKey` để route đọc file trong `DATA_DIR`. Chỉ đọc. */
export async function getArtifactById(db: StudioDb, artifactId: string) {
  const [row] = await db.select().from(artifacts).where(eq(artifacts.id, artifactId)).limit(1);
  return row ?? null;
}

export async function listEventsForRun(db: StudioDb, runId: string) {
  return db
    .select({ id: events.id, type: events.type, payload: events.payload })
    .from(events)
    .where(eq(events.workflowRunId, runId))
    .orderBy(asc(events.id));
}

/**
 * Chỉ dùng trong test: xóa đúng project đã tạo và mọi hàng con theo thứ tự khóa ngoại.
 * Không gọi từ route.
 */
export async function deleteProjectCascadeForTests(db: StudioDb, projectId: string): Promise<void> {
  const runRows = await db
    .select({ id: workflowRuns.id })
    .from(workflowRuns)
    .where(eq(workflowRuns.projectId, projectId));
  const runIds = runRows.map((r) => r.id);
  if (runIds.length > 0) {
    await db.delete(events).where(inArray(events.workflowRunId, runIds));
    await db.delete(usageRecords).where(inArray(usageRecords.workflowRunId, runIds));
    await db.delete(approvals).where(inArray(approvals.workflowRunId, runIds));
    const agentRows = await db
      .select({ id: agentRuns.id })
      .from(agentRuns)
      .where(inArray(agentRuns.workflowRunId, runIds));
    const agentIds = agentRows.map((r) => r.id);
    if (agentIds.length > 0) {
      await db.delete(jobs).where(inArray(jobs.agentRunId, agentIds));
      await db.delete(agentRuns).where(inArray(agentRuns.id, agentIds));
    }
    await db.delete(artifacts).where(inArray(artifacts.workflowRunId, runIds));
    await db.delete(workflowRuns).where(inArray(workflowRuns.id, runIds));
  }
  await db.delete(references).where(eq(references.projectId, projectId));
  await db.delete(briefs).where(eq(briefs.projectId, projectId));
  await db.delete(projects).where(eq(projects.id, projectId));
}

export class ScriptEditError extends Error {
  readonly code: "not_found" | "invalid_transition" | "stale";

  constructor(code: ScriptEditError["code"], message: string) {
    super(message);
    this.name = "ScriptEditError";
    this.code = code;
  }
}

/**
 * Lưu bản kịch bản Director đã sửa (P2-12) thành artifact `script` version mới, phụ thuộc bản gốc.
 * Chỉ khi run đang chờ duyệt kịch bản và bản gốc vẫn là bản mới nhất (không ghi đè sửa của người khác).
 * File JSON đã được route ghi trước; hàm này chỉ ghi hàng. Không ghi approval.
 */
export async function saveDirectorScriptEdit(
  db: StudioDb,
  input: {
    workflowRunId: string;
    baseArtifactId: string;
    variantIndex: 1 | 2;
    storageKey: string;
    contentHash: string;
  },
) {
  return db.transaction(async (tx) => {
    const [run] = await tx
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.id, input.workflowRunId))
      .for("update")
      .limit(1);
    if (run === undefined) {
      throw new ScriptEditError("not_found", "workflow run not found");
    }
    if (run.status !== "waiting_script_approval") {
      throw new ScriptEditError("invalid_transition", `workflow run is ${run.status}`);
    }
    const [latest] = await tx
      .select({ id: artifacts.id, version: artifacts.version })
      .from(artifacts)
      .where(and(eq(artifacts.workflowRunId, run.id), eq(artifacts.type, "script")))
      .orderBy(desc(artifacts.version))
      .limit(1);
    if (latest === undefined) {
      throw new ScriptEditError("not_found", "run has no script");
    }
    if (latest.id !== input.baseArtifactId) {
      throw new ScriptEditError("stale", "base script is not the latest version");
    }
    const [row] = await tx
      .insert(artifacts)
      .values({
        projectId: run.projectId,
        workflowRunId: run.id,
        type: "script",
        version: latest.version + 1,
        schemaVersion: "1",
        contentHash: input.contentHash,
        storageKey: input.storageKey,
        metadata: {
          editedBy: "director",
          baseArtifactId: latest.id,
          variantIndex: input.variantIndex,
        },
      })
      .returning({ id: artifacts.id, version: artifacts.version });
    if (row === undefined) {
      throw new Error("insert_artifact_failed");
    }
    await tx
      .insert(artifactDependencies)
      .values({ artifactId: row.id, parentArtifactId: latest.id });
    return row;
  });
}
