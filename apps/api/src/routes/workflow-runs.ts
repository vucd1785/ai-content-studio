import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import {
  applyWorkflowCommand,
  approvalBodySchema,
  approvalCreatedResponseSchema,
  projectIdParamsSchema,
  type ResumeFrom,
  runIdParamsSchema,
  usageListResponseSchema,
  workflowRunControlResponseSchema,
  workflowRunDetailResponseSchema,
} from "@studio/contracts";
import {
  ApprovalError,
  cancelWorkflowRun,
  getWorkflowRunDetail,
  listUsageRecordsForRun,
  recordApproval,
  resumeWorkflowRun,
  type StudioDb,
  startWorkflowRun,
  WorkflowControlError,
  workflowRunExists,
} from "@studio/db";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  sendConflict,
  sendInvalidTransition,
  sendNotFound,
  sendValidationError,
} from "../http/errors.js";
import type { EventNotifier } from "./event-stream.js";

export type WorkflowRunRouteDeps = {
  db: StudioDb;
  /** Báo SSE cùng process sau khi transaction approval đã commit. */
  notifier?: EventNotifier;
};

export function registerWorkflowRunRoutes(app: FastifyInstance, deps: WorkflowRunRouteDeps): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/api/workflow-runs/:runId",
    {
      schema: {
        params: runIdParamsSchema,
        response: { 200: workflowRunDetailResponseSchema },
      },
    },
    async (request, reply) => {
      const detail = await getWorkflowRunDetail(deps.db, request.params.runId);
      if (detail === null) {
        return sendNotFound(reply);
      }
      return detail;
    },
  );

  // Chỉ đọc số đã lưu (P3-09). Không tính giá ở đây.
  typed.get(
    "/api/workflow-runs/:runId/usage",
    {
      schema: {
        params: runIdParamsSchema,
        response: { 200: usageListResponseSchema },
      },
    },
    async (request, reply) => {
      if (!(await workflowRunExists(deps.db, request.params.runId))) {
        return sendNotFound(reply);
      }
      return { usageRecords: await listUsageRecordsForRun(deps.db, request.params.runId) };
    },
  );

  // P3-08: cạnh tính bằng state machine; DB đổi chỉ khi run vẫn ở đúng trạng thái đã đọc. Không ghi approval.
  const controlError = (reply: FastifyReply, error: unknown) => {
    if (error instanceof WorkflowControlError) {
      if (error.code === "not_found") {
        return sendNotFound(reply);
      }
      if (error.code === "nothing_to_resume") {
        return sendConflict(reply, "Không còn job nào để chạy lại.");
      }
      if (error.code === "no_brief") {
        return sendConflict(reply, "Dự án chưa có brief nên chưa bắt đầu được.");
      }
      if (error.code === "run_active") {
        return sendConflict(reply, "Dự án đang có lượt chạy chưa kết thúc.");
      }
      return sendInvalidTransition(reply, "Trạng thái workflow không cho phép thao tác này.");
    }
    throw error;
  };

  // Quyết định 5: tạo run từ brief mới nhất cùng job research; worker queue `llm` nhận job qua đối chiếu.
  typed.post(
    "/api/projects/:projectId/workflow-runs",
    {
      schema: {
        params: projectIdParamsSchema,
        response: { 201: workflowRunControlResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const result = await startWorkflowRun(deps.db, request.params.projectId);
        deps.notifier?.notify(result.workflowRun.id);
        return reply.status(201).send({ workflowRun: result.workflowRun });
      } catch (error) {
        return controlError(reply, error);
      }
    },
  );

  typed.post(
    "/api/workflow-runs/:runId/cancel",
    { schema: { params: runIdParamsSchema, response: { 200: workflowRunControlResponseSchema } } },
    async (request, reply) => {
      const detail = await getWorkflowRunDetail(deps.db, request.params.runId);
      if (detail === null) {
        return sendNotFound(reply);
      }
      const from = detail.workflowRun.status;
      if (!applyWorkflowCommand({ status: from, resumeFrom: null }, { kind: "cancel" }).ok) {
        return sendInvalidTransition(reply, "Workflow đã kết thúc nên không hủy được.");
      }
      try {
        const result = await cancelWorkflowRun(deps.db, {
          workflowRunId: request.params.runId,
          transition: { from, to: "cancelled" },
        });
        deps.notifier?.notify(request.params.runId);
        return result;
      } catch (error) {
        return controlError(reply, error);
      }
    },
  );

  typed.post(
    "/api/workflow-runs/:runId/resume",
    { schema: { params: runIdParamsSchema, response: { 200: workflowRunControlResponseSchema } } },
    async (request, reply) => {
      const detail = await getWorkflowRunDetail(deps.db, request.params.runId);
      if (detail === null) {
        return sendNotFound(reply);
      }
      const resumeFrom = detail.workflowRun.resumeFrom as ResumeFrom | null;
      const edge = applyWorkflowCommand(
        { status: detail.workflowRun.status, resumeFrom },
        { kind: "resume" },
      );
      if (!edge.ok || resumeFrom === null) {
        return sendInvalidTransition(
          reply,
          "Chỉ resume được workflow đã lỗi và có bước để chạy lại.",
        );
      }
      try {
        const result = await resumeWorkflowRun(deps.db, {
          workflowRunId: request.params.runId,
          transition: { from: "failed", to: resumeFrom },
        });
        deps.notifier?.notify(request.params.runId);
        return { workflowRun: result.workflowRun };
      } catch (error) {
        return controlError(reply, error);
      }
    },
  );

  typed.post(
    "/api/workflow-runs/:runId/approvals",
    {
      schema: {
        params: runIdParamsSchema,
        body: approvalBodySchema,
        response: { 201: approvalCreatedResponseSchema },
      },
    },
    async (request, reply) => {
      const { gate, decision, artifactId, variantIndex, note } = request.body;
      try {
        const result = await recordApproval(deps.db, {
          workflowRunId: request.params.runId,
          gate,
          decision,
          artifactId,
          variantIndex: variantIndex ?? null,
          note: note === undefined || note === "" ? null : note,
        });
        deps.notifier?.notify(request.params.runId);
        return reply.status(201).send(result);
      } catch (error) {
        if (error instanceof ApprovalError) {
          if (error.code === "not_found") {
            return sendNotFound(reply);
          }
          if (error.code === "invalid_transition") {
            return sendInvalidTransition(reply);
          }
          if (error.code === "qa_not_passed") {
            return sendConflict(reply, "Preview chưa qua QA nên chưa duyệt được.");
          }
          if (error.code === "invalid_variant") {
            return sendValidationError(reply, "Cần chọn đúng một phương án khi duyệt kịch bản.");
          }
          return sendValidationError(reply, "Artifact không đúng loại cho cổng duyệt.");
        }
        throw error;
      }
    },
  );
}
