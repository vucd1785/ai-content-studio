import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import { isClaudeCodeModel, readClaudeCodeEnv } from "@studio/config/claude-code";
import { readGeminiEnv } from "@studio/config/gemini";
import {
  apiErrorBodySchema,
  applyWorkflowCommand,
  approvalBodySchema,
  approvalCreatedResponseSchema,
  isChannelNameSet,
  llmModelsResponseSchema,
  projectIdParamsSchema,
  type ResumeFrom,
  runIdParamsSchema,
  startWorkflowRunBodySchema,
  usageListResponseSchema,
  usageSummaryQuerySchema,
  usageSummaryResponseSchema,
  workflowRunControlResponseSchema,
  workflowRunDetailResponseSchema,
} from "@studio/contracts";
import {
  ApprovalError,
  cancelWorkflowRun,
  getWorkflowRunDetail,
  listUsageRecordsForRun,
  loadRunBrandProfile,
  recordApproval,
  resumeWorkflowRun,
  type StudioDb,
  startWorkflowRun,
  sumUsageBetween,
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
  /** Volume `data/`. Route sửa kịch bản `1` (P2-12) đã xóa (ADR-013 bổ sung (2)); sửa script `2` thuộc P6-11. */
  dataDir?: string;
  /** Model chọn được khi bắt đầu run (P3-12). Mặc định đọc `GEMINI_MODEL_SCRIPT` và `GEMINI_MODELS` của process. */
  llmModels?: { defaultModel: string; models: string[] };
  /** Báo SSE cùng process sau khi transaction approval đã commit. */
  notifier?: EventNotifier;
};

/**
 * Danh sách model chọn theo run (P3-12): model Gemini, cộng model Claude Code khi Director đặt
 * `CLAUDE_CODE_MODELS` (ADR-007, bổ sung 2026-11-02). Không có `GEMINI_API_KEY` mà có Claude Code thì chỉ
 * liệt kê Claude Code và mặc định là model Claude Code đầu tiên.
 */
export function llmModelsFromEnv(env: Record<string, string | undefined>): {
  defaultModel: string;
  models: string[];
} {
  const gemini = readGeminiEnv(env);
  const claudeCode = readClaudeCodeEnv(env).models;
  const geminiModels = gemini.models ?? [gemini.modelScript];
  const [firstClaudeCode] = claudeCode;
  if (gemini.apiKey === undefined && firstClaudeCode !== undefined) {
    return { defaultModel: firstClaudeCode, models: claudeCode };
  }
  return { defaultModel: gemini.modelScript, models: [...geminiModels, ...claudeCode] };
}

export function registerWorkflowRunRoutes(app: FastifyInstance, deps: WorkflowRunRouteDeps): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const llmModels = deps.llmModels ?? llmModelsFromEnv(process.env);

  // P3-12: danh sách model Director chọn khi bắt đầu run. Chỉ đọc cấu hình, không lộ key.
  typed.get(
    "/api/llm-models",
    { schema: { response: { 200: llmModelsResponseSchema } } },
    async () => llmModels,
  );

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

  // P5-04: tổng token trong khoảng thời gian (trang dự án hiện tháng này). Chỉ đọc số đã lưu.
  typed.get(
    "/api/usage/summary",
    {
      schema: {
        querystring: usageSummaryQuerySchema,
        response: { 200: usageSummaryResponseSchema },
      },
    },
    async (request) => {
      const { from, to } = request.query;
      return { from, to, ...(await sumUsageBetween(deps.db, new Date(from), new Date(to))) };
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
      // Body tùy chọn: nút web cũ gửi POST không body. Có body thì phải đúng schema (không field lạ).
      const body = startWorkflowRunBodySchema.safeParse(request.body ?? {});
      if (!body.success) {
        return sendValidationError(reply);
      }
      // Mặc định là Claude Code (không có Gemini) thì ghi rõ lên run, để worker không rơi về client Gemini.
      const llmModel =
        body.data.llmModel ??
        (isClaudeCodeModel(llmModels.defaultModel) ? llmModels.defaultModel : undefined);
      if (llmModel !== undefined && !llmModels.models.includes(llmModel)) {
        return sendValidationError(reply, "Model không nằm trong danh sách được phép.");
      }
      try {
        const result = await startWorkflowRun(deps.db, request.params.projectId, {
          ...(llmModel === undefined ? {} : { llmModel }),
          // ADR-017 mục 1: run mới mặc định `creative` (tự tạo tài sản thiếu).
          creativeMode: body.data.creativeMode ?? "creative",
          ...(body.data.aspectRatio === undefined ? {} : { aspectRatio: body.data.aspectRatio }),
        });
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
        response: { 201: approvalCreatedResponseSchema, 409: apiErrorBodySchema },
      },
    },
    async (request, reply) => {
      const { gate, decision, artifactId, variantIndex, note } = request.body;
      // ADR-021: thẻ cuối và bộ đăng bài cần tên kênh thật trước lần xuất. Kiểm ở route vì chỉ route ghi
      // approval; run lạ để `recordApproval` trả 404 như cũ.
      if (gate === "final" && decision === "approved") {
        const brand = await loadRunBrandProfile(deps.db, request.params.runId);
        if (brand !== null && !isChannelNameSet(brand.displayName)) {
          return reply.status(409).send({
            error: {
              code: "conflict",
              message: "Đặt tên kênh ở Bộ nhận diện kênh trước lần xuất đầu tiên.",
              details: { reason: "channel_name_required" },
            },
          });
        }
      }
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
