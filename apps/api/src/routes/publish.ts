import { randomUUID } from "node:crypto";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import {
  type ApiErrorBody,
  apiErrorBodySchema,
  brandContactSchema,
  brandContactUpdateSchema,
  publishKitRequestResponseSchema,
  runIdParamsSchema,
} from "@studio/contracts";
import {
  getDefaultBrandContact,
  requestPublishJob,
  type StudioDb,
  setDefaultBrandContact,
} from "@studio/db";
import type { FastifyInstance } from "fastify";
import { sendNotFound } from "../http/errors.js";

export type PublishRouteDeps = { db: StudioDb; notifier?: { notify(runId: string): void } };

const conflict = (message: string): ApiErrorBody => ({
  error: { code: "conflict", message, details: {} },
});

const toContact = (row: { id: string; displayName: string; copyrightContact: string | null }) => ({
  brandProfileId: row.id,
  displayName: row.displayName,
  copyrightContact: row.copyrightContact,
});

/**
 * Bộ đăng bài (ADR-018): liên hệ bản quyền của kênh (ghi cuối mô tả mọi video) và nút "Tạo lại bộ đăng bài".
 * Route không gọi LLM: chỉ tạo job `publish` trong PostgreSQL, worker đẩy vào Redis khi đối chiếu.
 */
export function registerPublishRoutes(app: FastifyInstance, deps: PublishRouteDeps): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/api/brand-profile/contact",
    { schema: { response: { 200: brandContactSchema } } },
    async (_request, reply) => {
      const row = await getDefaultBrandContact(deps.db);
      return row === null ? sendNotFound(reply) : toContact(row);
    },
  );

  typed.put(
    "/api/brand-profile/contact",
    { schema: { body: brandContactUpdateSchema, response: { 200: brandContactSchema } } },
    async (request, reply) => {
      const row = await setDefaultBrandContact(
        deps.db,
        request.body.copyrightContact,
        request.body.displayName,
      );
      return row === null ? sendNotFound(reply) : toContact(row);
    },
  );

  typed.post(
    "/api/workflow-runs/:runId/publish-kit",
    {
      schema: {
        params: runIdParamsSchema,
        response: { 202: publishKitRequestResponseSchema, 409: apiErrorBodySchema },
      },
    },
    async (request, reply) => {
      const result = await requestPublishJob(deps.db, request.params.runId, randomUUID());
      if (result === "not_found") {
        return sendNotFound(reply);
      }
      if (result === "not_exported") {
        return reply.status(409).send(conflict("Video chưa xuất xong."));
      }
      if (result === "already_running") {
        return reply.status(409).send(conflict("Bộ đăng bài đang được tạo."));
      }
      deps.notifier?.notify(request.params.runId);
      return reply.status(202).send({ status: "queued" as const });
    },
  );
}
