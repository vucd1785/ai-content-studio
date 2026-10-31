import { and, desc, eq, inArray } from "drizzle-orm";
import { insertQueuedJob } from "./agent-jobs.js";
import type { StudioDb } from "./db.js";
import { type EventInsert, publishEvents } from "./events.js";
import { agentRuns, briefs, jobs, projects, workflowRuns } from "./schema/index.js";
import { mapWorkflowRunRow, type StudioTx } from "./workflow.js";

/**
 * Hủy và resume run (P3-08, 04-AGENT-ORCHESTRATION mục Job và retry). Route tính cạnh bằng
 * `applyWorkflowCommand` rồi truyền `{ from, to }`; ở đây chỉ đổi khi run vẫn đúng `from` dưới khóa hàng.
 * Không hàm nào ở đây ghi `approvals`.
 */

type WorkflowRunRow = typeof workflowRuns.$inferSelect;
type WorkflowRunStatus = WorkflowRunRow["status"];
type ResumeFrom = NonNullable<WorkflowRunRow["resumeFrom"]>;
type AgentRole = (typeof agentRuns.$inferSelect)["role"];

export class WorkflowControlError extends Error {
  readonly code:
    | "not_found"
    | "invalid_transition"
    | "nothing_to_resume"
    | "no_brief"
    | "run_active";

  constructor(code: WorkflowControlError["code"], message: string) {
    super(message);
    this.name = "WorkflowControlError";
    this.code = code;
  }
}

/**
 * Job nào chạy lại khi resume tới từng bước. Render và export cùng role `video`, phân biệt bằng key.
 * Job đã `completed` không bao giờ chạy lại: ví dụ voice xong rồi thì resume không gọi lại TTS.
 */
const RESUME_JOBS: Record<
  ResumeFrom,
  { roles: AgentRole[]; matchesKey?: (key: string) => boolean }
> = {
  researching: { roles: ["research"] },
  scripting: { roles: ["script"] },
  producing_assets: { roles: ["visual", "voice"] },
  preview_rendering: { roles: ["video"], matchesKey: (key) => !key.startsWith("export:") },
  qa: { roles: ["qa"] },
  exporting: { roles: ["video"], matchesKey: (key) => key.startsWith("export:") },
};

async function lockRun(tx: StudioTx, runId: string) {
  const [run] = await tx
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.id, runId))
    .for("update")
    .limit(1);
  if (run === undefined) {
    throw new WorkflowControlError("not_found", "workflow run not found");
  }
  return run;
}

/**
 * Hủy run: run → `cancelled` (xóa `resume_from`), job `queued`/`running` và agent chưa xong → `cancelled`.
 * Worker đang giữ job sẽ không claim lại được và `completeJob` từ chối job đã hủy.
 */
export async function cancelWorkflowRun(
  db: StudioDb,
  input: { workflowRunId: string; transition: { from: WorkflowRunStatus; to: "cancelled" } },
) {
  return db.transaction(async (tx) => {
    const run = await lockRun(tx, input.workflowRunId);
    if (run.status !== input.transition.from) {
      throw new WorkflowControlError("invalid_transition", `workflow run is ${run.status}`);
    }
    const now = new Date();
    const runAgents = await tx
      .select({ id: agentRuns.id })
      .from(agentRuns)
      .where(eq(agentRuns.workflowRunId, run.id));
    const agentIds = runAgents.map((row) => row.id);
    if (agentIds.length > 0) {
      await tx
        .update(jobs)
        .set({ status: "cancelled", updatedAt: now })
        .where(
          and(inArray(jobs.agentRunId, agentIds), inArray(jobs.status, ["queued", "running"])),
        );
    }
    const cancelledAgents = await tx
      .update(agentRuns)
      .set({ status: "cancelled", finishedAt: now })
      .where(
        and(
          eq(agentRuns.workflowRunId, run.id),
          inArray(agentRuns.status, ["idle", "queued", "running", "waiting_approval"]),
        ),
      )
      .returning({ id: agentRuns.id, role: agentRuns.role });
    const [updated] = await tx
      .update(workflowRuns)
      .set({ status: "cancelled", resumeFrom: null, updatedAt: now })
      .where(eq(workflowRuns.id, run.id))
      .returning();
    if (updated === undefined) {
      throw new Error("update_workflow_run_failed");
    }
    const rows: EventInsert[] = [
      {
        workflowRunId: run.id,
        type: "workflow.transition",
        payload: { from: run.status, to: "cancelled", cause: "cancel" },
      },
      ...cancelledAgents.map(
        (agent): EventInsert => ({
          workflowRunId: run.id,
          agentRunId: agent.id,
          type: "agent.status",
          payload: { role: agent.role, status: "cancelled" },
        }),
      ),
    ];
    await publishEvents(tx, rows);
    return { workflowRun: mapWorkflowRunRow(updated) };
  });
}

/**
 * Resume run `failed` tới đúng `resume_from`: đưa job `failed` của bước đó về `queued` (giữ key và `attempt`),
 * xóa lỗi của run. Job đã xong của bước trước giữ nguyên, nên artifact của chúng được dùng lại.
 * Không có job nào để chạy lại thì từ chối, vì run sẽ đứng yên ở trạng thái làm việc.
 */
export async function resumeWorkflowRun(
  db: StudioDb,
  input: { workflowRunId: string; transition: { from: "failed"; to: ResumeFrom } },
) {
  return db.transaction(async (tx) => {
    const run = await lockRun(tx, input.workflowRunId);
    if (run.status !== "failed" || run.resumeFrom !== input.transition.to) {
      throw new WorkflowControlError("invalid_transition", `workflow run is ${run.status}`);
    }
    const stage = RESUME_JOBS[input.transition.to];
    const failed = await tx
      .select({
        jobId: jobs.id,
        key: jobs.idempotencyKey,
        agentRunId: agentRuns.id,
        role: agentRuns.role,
      })
      .from(jobs)
      .innerJoin(agentRuns, eq(agentRuns.id, jobs.agentRunId))
      .where(
        and(
          eq(agentRuns.workflowRunId, run.id),
          eq(jobs.status, "failed"),
          inArray(agentRuns.role, stage.roles),
        ),
      );
    const retry = failed.filter((row) => stage.matchesKey?.(row.key) ?? true);
    if (retry.length === 0) {
      throw new WorkflowControlError("nothing_to_resume", "no failed job for resume_from");
    }
    const now = new Date();
    await tx
      .update(jobs)
      .set({ status: "queued", updatedAt: now })
      .where(
        inArray(
          jobs.id,
          retry.map((row) => row.jobId),
        ),
      );
    await tx
      .update(agentRuns)
      .set({ status: "queued", finishedAt: null, errorCode: null, errorMessage: null })
      .where(
        inArray(
          agentRuns.id,
          retry.map((row) => row.agentRunId),
        ),
      );
    const [updated] = await tx
      .update(workflowRuns)
      .set({
        status: input.transition.to,
        resumeFrom: null,
        failureCode: null,
        failureMessage: null,
        updatedAt: now,
      })
      .where(eq(workflowRuns.id, run.id))
      .returning();
    if (updated === undefined) {
      throw new Error("update_workflow_run_failed");
    }
    const rows: EventInsert[] = [
      {
        workflowRunId: run.id,
        type: "workflow.transition",
        payload: { from: "failed", to: input.transition.to, cause: "resume" },
      },
      ...retry.map(
        (row): EventInsert => ({
          workflowRunId: run.id,
          agentRunId: row.agentRunId,
          jobId: row.jobId,
          type: "agent.status",
          payload: { role: row.role, status: "queued" },
        }),
      ),
    ];
    await publishEvents(tx, rows);
    return {
      workflowRun: mapWorkflowRunRow(updated),
      requeuedJobIds: retry.map((row) => row.jobId),
    };
  });
}

/** Trạng thái coi là đã dừng: được tạo run mới cho project (`failed` vẫn resume được nếu Director muốn). */
const STOPPED_STATUSES: ReadonlySet<WorkflowRunStatus> = new Set([
  "exported",
  "cancelled",
  "failed",
]);

/** Key job research của một run: mỗi run đúng một job research đầu tiên. */
export function researchJobKeyForRun(workflowRunId: string): string {
  return `research:${workflowRunId}`;
}

/**
 * Tạo run từ brief mới nhất (07-API-CONTRACTS, quyết định 5): run `idea_submitted` cùng job research
 * (queue `llm`) trong một transaction. Redis biết job khi worker đối chiếu (ADR-003).
 * Từ chối khi project chưa có brief, hoặc run mới nhất còn đang chạy hay chờ duyệt.
 */
export async function startWorkflowRun(db: StudioDb, projectId: string) {
  return db.transaction(async (tx) => {
    // Khóa hàng project: hai request cùng lúc không tạo hai run.
    const [project] = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .for("update")
      .limit(1);
    if (project === undefined) {
      throw new WorkflowControlError("not_found", "project not found");
    }
    const [brief] = await tx
      .select({ id: briefs.id })
      .from(briefs)
      .where(eq(briefs.projectId, projectId))
      .orderBy(desc(briefs.createdAt))
      .limit(1);
    if (brief === undefined) {
      throw new WorkflowControlError("no_brief", "project has no brief");
    }
    const [latest] = await tx
      .select({ status: workflowRuns.status })
      .from(workflowRuns)
      .where(eq(workflowRuns.projectId, projectId))
      .orderBy(desc(workflowRuns.createdAt))
      .limit(1);
    if (latest !== undefined && !STOPPED_STATUSES.has(latest.status)) {
      throw new WorkflowControlError("run_active", `latest run is ${latest.status}`);
    }
    const [run] = await tx
      .insert(workflowRuns)
      .values({ projectId, briefId: brief.id, status: "idea_submitted" })
      .returning();
    if (run === undefined) {
      throw new Error("insert_workflow_run_failed");
    }
    const created = await insertQueuedJob(tx, run.id, {
      role: "research",
      queue: "llm",
      idempotencyKey: researchJobKeyForRun(run.id),
    });
    await publishEvents(tx, [created.event]);
    return { workflowRun: mapWorkflowRunRow(run), researchJobId: created.job.id };
  });
}
