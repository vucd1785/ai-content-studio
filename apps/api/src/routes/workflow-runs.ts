import {
  approvalBodySchema,
  approvalCreatedResponseSchema,
  runIdParamsSchema,
  usageListResponseSchema,
  workflowRunDetailResponseSchema,
} from "@studio/contracts";
import {
  ApprovalError,
  getWorkflowRunDetail,
  listUsageRecordsForRun,
  recordApproval,
  type StudioDb,
  workflowRunExists,
} from "@studio/db";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import { sendInvalidTransition, sendNotFound, sendValidationError } from "../http/errors.js";
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
