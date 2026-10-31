import { and, asc, desc, eq, inArray, max, sql } from "drizzle-orm";
import type { StudioDb } from "./db.js";
import { type EventInsert, publishEvents } from "./events.js";
import {
  agentRuns,
  approvals,
  artifactDependencies,
  artifacts,
  briefs,
  jobs,
  references,
  workflowRuns,
} from "./schema/index.js";
import type { StudioTx } from "./workflow.js";

/**
 * Vòng đời job của agent (P3-03 trở đi). Hàm ở đây không tự quyết cạnh workflow:
 * worker tính cạnh bằng `applyWorkflowCommand` (`@studio/contracts`) rồi truyền `{ from, to }`;
 * DB chỉ đổi khi status hiện tại đúng `from` (compare-and-set dưới khóa hàng run).
 */

type WorkflowRunRow = typeof workflowRuns.$inferSelect;
type WorkflowRunStatus = WorkflowRunRow["status"];
type ResumeFrom = NonNullable<WorkflowRunRow["resumeFrom"]>;
type ArtifactType = (typeof artifacts.$inferSelect)["type"];
type AgentRole = (typeof agentRuns.$inferSelect)["role"];
type JobQueue = (typeof jobs.$inferSelect)["queue"];

export type RunTransition = { from: WorkflowRunStatus; to: WorkflowRunStatus };

export class JobStateError extends Error {
  readonly code: "not_found" | "not_claimable" | "invalid_transition";

  constructor(code: JobStateError["code"], message: string) {
    super(message);
    this.name = "JobStateError";
    this.code = code;
  }
}

export async function loadJobContext(db: StudioDb, jobId: string) {
  const [row] = await db
    .select({ job: jobs, agentRun: agentRuns, workflowRun: workflowRuns, brief: briefs })
    .from(jobs)
    .innerJoin(agentRuns, eq(agentRuns.id, jobs.agentRunId))
    .innerJoin(workflowRuns, eq(workflowRuns.id, agentRuns.workflowRunId))
    .innerJoin(briefs, eq(briefs.id, workflowRuns.briefId))
    .where(eq(jobs.id, jobId))
    .limit(1);
  if (row === undefined) {
    return null;
  }
  const referenceRows = await db
    .select()
    .from(references)
    .where(eq(references.projectId, row.workflowRun.projectId))
    .orderBy(asc(references.createdAt), asc(references.id));
  return { ...row, references: referenceRows };
}

export type JobContext = NonNullable<Awaited<ReturnType<typeof loadJobContext>>>;

async function lockRun(tx: StudioTx, runId: string): Promise<WorkflowRunRow> {
  const [run] = await tx.select().from(workflowRuns).where(eq(workflowRuns.id, runId)).for("update").limit(1);
  if (run === undefined) {
    throw new JobStateError("not_found", "workflow run not found");
  }
  return run;
}

async function lockJob(tx: StudioTx, jobId: string) {
  const [row] = await tx
    .select({ job: jobs, agentRun: agentRuns })
    .from(jobs)
    .innerJoin(agentRuns, eq(agentRuns.id, jobs.agentRunId))
    .where(eq(jobs.id, jobId))
    .for("update", { of: jobs })
    .limit(1);
  if (row === undefined) {
    throw new JobStateError("not_found", "job not found");
  }
  return row;
}

function transitionEvent(run: WorkflowRunRow, to: WorkflowRunStatus, cause: string, jobId: string): EventInsert {
  return { workflowRunId: run.id, jobId, type: "workflow.transition", payload: { from: run.status, to, cause } };
}

function agentStatusEvent(
  runId: string,
  agentRunId: string,
  jobId: string,
  role: string,
  status: string,
): EventInsert {
  return { workflowRunId: runId, agentRunId, jobId, type: "agent.status", payload: { role, status } };
}

/**
 * Nhận job để chạy: job `queued`/`running` → `running`, tăng `attempt`; agent → `running`.
 * `runTransition` tùy chọn (ví dụ `idea_submitted` → `researching`) chỉ áp khi run đang ở `from`.
 * Run phải đang ở một trong `allowedRunStatuses`; khác đi (đã hủy, đã fail) thì không nhận.
 */
export async function claimJob(
  db: StudioDb,
  input: { jobId: string; allowedRunStatuses: WorkflowRunStatus[]; runTransition?: RunTransition },
) {
  return db.transaction(async (tx) => {
    const { job, agentRun } = await lockJob(tx, input.jobId);
    const run = await lockRun(tx, agentRun.workflowRunId);
    if (job.status !== "queued" && job.status !== "running") {
      throw new JobStateError("not_claimable", `job is ${job.status}`);
    }
    if (!input.allowedRunStatuses.includes(run.status)) {
      throw new JobStateError("not_claimable", `workflow run is ${run.status}`);
    }
    const now = new Date();
    const [claimed] = await tx
      .update(jobs)
      .set({ status: "running", attempt: job.attempt + 1, updatedAt: now })
      .where(eq(jobs.id, job.id))
      .returning();
    await tx
      .update(agentRuns)
      .set({ status: "running", attempt: agentRun.attempt + 1, startedAt: now, errorCode: null, errorMessage: null })
      .where(eq(agentRuns.id, agentRun.id));
    const rows: EventInsert[] = [];
    if (input.runTransition !== undefined && run.status === input.runTransition.from) {
      await tx
        .update(workflowRuns)
        .set({ status: input.runTransition.to, updatedAt: now })
        .where(eq(workflowRuns.id, run.id));
      rows.push(transitionEvent(run, input.runTransition.to, "job", job.id));
    }
    rows.push(agentStatusEvent(run.id, agentRun.id, job.id, agentRun.role, "running"));
    await publishEvents(tx, rows);
    if (claimed === undefined) {
      throw new Error("claim_job_failed");
    }
    return claimed;
  });
}

/** Key job script sau khi research xong: một job cho mỗi job research. */
export function scriptJobKeyAfterResearch(workflowRunId: string, researchJobId: string): string {
  return `script:${workflowRunId}:research:${researchJobId}`;
}

/** Key job script do lượt `changes_requested` tạo; approval id nằm trong key để job đọc note. */
export function scriptJobKeyAfterChangesRequested(workflowRunId: string, approvalId: string): string {
  return `script:${workflowRunId}:changes:${approvalId}`;
}

const CHANGES_KEY_PATTERN = /^script:[0-9a-f-]{36}:changes:([0-9a-f-]{36})$/;

export function approvalIdFromScriptJobKey(idempotencyKey: string): string | null {
  return CHANGES_KEY_PATTERN.exec(idempotencyKey)?.[1] ?? null;
}

/** Vai trò chạy song song sau khi duyệt script (P3-05). */
export type AssetRole = "visual" | "voice";

/** Key job visual/voice do một approval `script` + `approved` tạo. */
export function assetJobKeyAfterScriptApproval(role: AssetRole, workflowRunId: string, approvalId: string): string {
  return `${role}:${workflowRunId}:approval:${approvalId}`;
}

/** Key job render chỉ tạo khi cả visual lẫn voice của cùng approval đã xong (rào phụ thuộc). */
export function renderJobKeyAfterAssets(workflowRunId: string, approvalId: string): string {
  return `render:${workflowRunId}:approval:${approvalId}`;
}

/** Key job QA sau một job render (P3-06). */
export function qaJobKeyAfterRender(workflowRunId: string, renderJobId: string): string {
  return `qa:${workflowRunId}:render:${renderJobId}`;
}

/** Key job export do một approval `final` + `approved` tạo; approval id nằm trong key (P3-06). */
export function exportJobKeyAfterApproval(workflowRunId: string, approvalId: string): string {
  return `export:${workflowRunId}:approval:${approvalId}`;
}

const EXPORT_KEY_PATTERN = /^export:[0-9a-f-]{36}:approval:([0-9a-f-]{36})$/;

export function approvalIdFromExportJobKey(idempotencyKey: string): string | null {
  return EXPORT_KEY_PATTERN.exec(idempotencyKey)?.[1] ?? null;
}

const ASSET_KEY_PATTERN = /^(visual|voice):[0-9a-f-]{36}:approval:([0-9a-f-]{36})$/;

export function approvalIdFromAssetJobKey(idempotencyKey: string): string | null {
  return ASSET_KEY_PATTERN.exec(idempotencyKey)?.[2] ?? null;
}

/** Job kế tiếp do code chọn (producer không gọi LLM ở MVP, 04-AGENT-ORCHESTRATION). */
export type NextJob = { role: AgentRole; queue: JobQueue; idempotencyKey: string };

/**
 * Tạo agent run + job `queued` trong transaction của bước trước (P3-04). Redis không biết job này
 * cho tới khi worker đối chiếu lúc khởi động hoặc producer enqueue sau commit (ADR-003: PostgreSQL là nguồn sự thật).
 * Trả thêm event `agent.status` để caller ghi cùng lô.
 */
export async function insertQueuedJob(tx: StudioTx, workflowRunId: string, next: NextJob) {
  const [agentRun] = await tx
    .insert(agentRuns)
    .values({ workflowRunId, role: next.role, status: "queued" })
    .returning();
  if (agentRun === undefined) {
    throw new Error("insert_agent_run_failed");
  }
  const [job] = await tx
    .insert(jobs)
    .values({ agentRunId: agentRun.id, queue: next.queue, idempotencyKey: next.idempotencyKey, status: "queued" })
    .returning();
  if (job === undefined) {
    throw new Error("insert_job_failed");
  }
  const event = agentStatusEvent(workflowRunId, agentRun.id, job.id, next.role, "queued");
  return { agentRun, job, event };
}

export type NewJobArtifact = {
  type: ArtifactType;
  schemaVersion: string;
  contentHash: string;
  storageKey: string;
  metadata: Record<string, unknown>;
};

/**
 * Kết thúc job thành công trong một transaction: insert artifact (version kế tiếp theo run + type),
 * dependency, job/agent `completed`, đổi run đúng `runTransition`, ghi event.
 */
export async function completeJob(
  db: StudioDb,
  input: {
    jobId: string;
    artifacts: NewJobArtifact[];
    /** Cặp [chỉ số con, chỉ số cha] trong `artifacts`. */
    dependencies?: [number, number][];
    /** Cặp [chỉ số con trong `artifacts`, id artifact cha đã có] (ví dụ script ← research). */
    parentArtifacts?: [number, string][];
    runTransition: RunTransition;
    /** Trạng thái agent sau job. `waiting_approval` chỉ cho script ở cổng script (04-AGENT-ORCHESTRATION). */
    agentStatus?: "completed" | "waiting_approval";
    /** Job kế tiếp tạo cùng transaction. */
    nextJob?: NextJob;
    /**
     * Rào phụ thuộc (P3-05): tạo `nextJob` chỉ khi mọi job có key trong `requiredJobKeys` đã `completed`
     * (kể cả job này). Run bị khóa trong transaction nên hai job xong cùng lúc vẫn chỉ tạo một job kế tiếp.
     */
    barrier?: { requiredJobKeys: string[]; nextJob: NextJob };
    /** Hash đầu vào ghi vào `agent_runs.input_hash` (P5-01). */
    inputHash?: string;
  },
) {
  return db.transaction(async (tx) => {
    const { job, agentRun } = await lockJob(tx, input.jobId);
    const run = await lockRun(tx, agentRun.workflowRunId);
    if (job.status !== "running") {
      throw new JobStateError("not_claimable", `job is ${job.status}`);
    }
    if (run.status !== input.runTransition.from) {
      throw new JobStateError("invalid_transition", `workflow run is ${run.status}`);
    }
    const inserted: (typeof artifacts.$inferSelect)[] = [];
    for (const artifact of input.artifacts) {
      const [current] = await tx
        .select({ version: max(artifacts.version) })
        .from(artifacts)
        .where(and(eq(artifacts.workflowRunId, run.id), eq(artifacts.type, artifact.type)));
      const [row] = await tx
        .insert(artifacts)
        .values({
          projectId: run.projectId,
          workflowRunId: run.id,
          type: artifact.type,
          version: (current?.version ?? 0) + 1,
          schemaVersion: artifact.schemaVersion,
          contentHash: artifact.contentHash,
          storageKey: artifact.storageKey,
          metadata: artifact.metadata,
        })
        .returning();
      if (row === undefined) {
        throw new Error("insert_artifact_failed");
      }
      inserted.push(row);
    }
    for (const [childIndex, parentIndex] of input.dependencies ?? []) {
      const child = inserted[childIndex];
      const parent = inserted[parentIndex];
      if (child === undefined || parent === undefined) {
        throw new Error("invalid_dependency_index");
      }
      await tx.insert(artifactDependencies).values({ artifactId: child.id, parentArtifactId: parent.id });
    }
    for (const [childIndex, parentArtifactId] of input.parentArtifacts ?? []) {
      const child = inserted[childIndex];
      if (child === undefined) {
        throw new Error("invalid_dependency_index");
      }
      await tx.insert(artifactDependencies).values({ artifactId: child.id, parentArtifactId });
    }
    const agentStatus = input.agentStatus ?? "completed";
    const now = new Date();
    await tx.update(jobs).set({ status: "completed", updatedAt: now }).where(eq(jobs.id, job.id));
    await tx
      .update(agentRuns)
      .set({
        status: agentStatus,
        finishedAt: now,
        ...(input.inputHash === undefined ? {} : { inputHash: input.inputHash }),
      })
      .where(eq(agentRuns.id, agentRun.id));
    // `from === to`: job xong nhưng run đứng yên (visual/voice trong `producing_assets`).
    const staysInStatus = input.runTransition.from === input.runTransition.to;
    if (!staysInStatus) {
      await tx
        .update(workflowRuns)
        .set({ status: input.runTransition.to, updatedAt: now })
        .where(eq(workflowRuns.id, run.id));
    }
    const rows: EventInsert[] = [
      {
        workflowRunId: run.id,
        agentRunId: agentRun.id,
        jobId: job.id,
        type: "job.completed",
        payload: { artifactIds: inserted.map((row) => row.id) },
      },
      agentStatusEvent(run.id, agentRun.id, job.id, agentRun.role, agentStatus),
      ...(staysInStatus ? [] : [transitionEvent(run, input.runTransition.to, "job", job.id)]),
    ];
    if (input.nextJob !== undefined) {
      rows.push((await insertQueuedJob(tx, run.id, input.nextJob)).event);
    }
    if (input.barrier !== undefined) {
      const keys = [...input.barrier.requiredJobKeys, input.barrier.nextJob.idempotencyKey];
      const related = await tx
        .select({ key: jobs.idempotencyKey, status: jobs.status })
        .from(jobs)
        .where(inArray(jobs.idempotencyKey, keys));
      const done = input.barrier.requiredJobKeys.every((key) =>
        related.some((row) => row.key === key && row.status === "completed"),
      );
      const alreadyQueued = related.some((row) => row.key === input.barrier?.nextJob.idempotencyKey);
      if (done && !alreadyQueued) {
        rows.push((await insertQueuedJob(tx, run.id, input.barrier.nextJob)).event);
      }
    }
    await publishEvents(tx, rows);
    return inserted;
  });
}

/**
 * Job thất bại hẳn (hết retry hoặc lỗi không retry): job/agent `failed`.
 * Run sang `failed` với `resume_from` chỉ khi đang ở `runTransition.from`.
 */
export async function failJob(
  db: StudioDb,
  input: {
    jobId: string;
    errorCode: string;
    errorMessage: string;
    runTransition: RunTransition;
    resumeFrom: ResumeFrom;
  },
) {
  const message = input.errorMessage.slice(0, 2000);
  await db.transaction(async (tx) => {
    const { job, agentRun } = await lockJob(tx, input.jobId);
    const run = await lockRun(tx, agentRun.workflowRunId);
    // P3-08: job đã bị hủy cùng run giữ `cancelled`; lỗi đến muộn của worker không ghi đè.
    if (job.status === "cancelled") {
      return;
    }
    const now = new Date();
    await tx.update(jobs).set({ status: "failed", updatedAt: now }).where(eq(jobs.id, job.id));
    await tx
      .update(agentRuns)
      .set({ status: "failed", finishedAt: now, errorCode: input.errorCode, errorMessage: message })
      .where(eq(agentRuns.id, agentRun.id));
    const rows: EventInsert[] = [
      {
        workflowRunId: run.id,
        agentRunId: agentRun.id,
        jobId: job.id,
        type: "job.failed",
        payload: { errorCode: input.errorCode },
      },
      agentStatusEvent(run.id, agentRun.id, job.id, agentRun.role, "failed"),
    ];
    if (run.status === input.runTransition.from) {
      await tx
        .update(workflowRuns)
        .set({
          status: input.runTransition.to,
          resumeFrom: input.resumeFrom,
          failureCode: input.errorCode,
          failureMessage: message,
          updatedAt: now,
        })
        .where(eq(workflowRuns.id, run.id));
      rows.push(transitionEvent(run, input.runTransition.to, "job_failed", job.id));
    }
    await publishEvents(tx, rows);
  });
}

/** Artifact của run theo idempotency key ghi trong `metadata.idempotencyKey`. */
export async function findArtifactByIdempotencyKey(
  db: StudioDb,
  workflowRunId: string,
  type: ArtifactType,
  idempotencyKey: string,
) {
  const [row] = await db
    .select()
    .from(artifacts)
    .where(
      and(
        eq(artifacts.workflowRunId, workflowRunId),
        eq(artifacts.type, type),
        sql`${artifacts.metadata} ->> 'idempotencyKey' = ${idempotencyKey}`,
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Artifact research mới nhất của project có cùng `metadata.inputHash` (P5-01). Artifact chỉ được
 * tạo trong `completeJob`, nên hàng tìm thấy luôn là kết quả của một job đã xong.
 */
export async function findResearchArtifactByInputHash(db: StudioDb, projectId: string, inputHash: string) {
  const [row] = await db
    .select()
    .from(artifacts)
    .where(
      and(
        eq(artifacts.projectId, projectId),
        eq(artifacts.type, "research"),
        sql`${artifacts.metadata} ->> 'inputHash' = ${inputHash}`,
      ),
    )
    .orderBy(desc(artifacts.createdAt))
    .limit(1);
  return row ?? null;
}

/** Artifact mới nhất của run theo loại (version lớn nhất). */
export async function findLatestRunArtifact(db: StudioDb, workflowRunId: string, type: ArtifactType) {
  const [row] = await db
    .select()
    .from(artifacts)
    .where(and(eq(artifacts.workflowRunId, workflowRunId), eq(artifacts.type, type)))
    .orderBy(desc(artifacts.version))
    .limit(1);
  return row ?? null;
}

/** Approval theo id, giới hạn trong run (job script đọc note của lượt `changes_requested`). */
export async function findRunApproval(db: StudioDb, workflowRunId: string, approvalId: string) {
  const [row] = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.id, approvalId), eq(approvals.workflowRunId, workflowRunId)))
    .limit(1);
  return row ?? null;
}

/** Artifact cha (qua `artifact_dependencies`) của `childId` theo loại; ví dụ render props của một preview. */
export async function findParentArtifact(db: StudioDb, childId: string, type: ArtifactType) {
  const [row] = await db
    .select({ artifact: artifacts })
    .from(artifactDependencies)
    .innerJoin(artifacts, eq(artifacts.id, artifactDependencies.parentArtifactId))
    .where(and(eq(artifactDependencies.artifactId, childId), eq(artifacts.type, type)))
    .orderBy(desc(artifacts.version))
    .limit(1);
  return row?.artifact ?? null;
}

