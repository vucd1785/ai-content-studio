import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import {
  apiErrorBodySchema,
  assetIdsInRenderProps,
  REDO_REGENERATABLE_KINDS,
  type RedoRequestFile,
  redoBodySchema,
  redoResponseSchema,
  redoStorageKey,
  redoTarget,
  runIdParamsSchema,
} from "@studio/contracts";
import {
  findLatestRunArtifact,
  getWorkflowRunDetail,
  listMotionAssets,
  requestRedo,
  type StudioDb,
  WorkflowControlError,
} from "@studio/db";
import type { FastifyInstance } from "fastify";
import { sendInvalidTransition, sendNotFound, sendValidationError } from "../http/errors.js";
import { readArtifactJson } from "./artifacts.js";

export type RedoRouteDeps = {
  db: StudioDb;
  dataDir: string;
  notifier?: { notify(runId: string): void };
};

type PropsView = { scenes?: { sceneId?: unknown }[] };

/**
 * Làm lại một phần ở Cổng 2 (ADR-021): kiểm yêu cầu theo `render_props` mới nhất của run, ghi file yêu cầu, rồi
 * trong một transaction đưa run về `producing_assets` (đọc lại cảnh) hoặc `preview_rendering` và tạo đúng một job.
 * Không gọi LLM ở route, không ghi approval.
 */
export function registerRedoRoutes(app: FastifyInstance, deps: RedoRouteDeps): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/api/workflow-runs/:runId/redo",
    {
      schema: {
        params: runIdParamsSchema,
        body: redoBodySchema,
        response: { 202: redoResponseSchema, 409: apiErrorBodySchema },
      },
    },
    async (request, reply) => {
      const { runId } = request.params;
      const body = request.body;
      const detail = await getWorkflowRunDetail(deps.db, runId);
      if (detail === null) {
        return sendNotFound(reply);
      }
      if (detail.workflowRun.status !== "waiting_final_approval") {
        return sendInvalidTransition(reply, "Chỉ làm lại được khi video đang chờ duyệt bản cuối.");
      }
      const propsRow = await findLatestRunArtifact(deps.db, runId, "render_props");
      const props =
        propsRow === null ? null : await readArtifactJson(deps.dataDir, propsRow.storageKey);
      if (props === null) {
        return sendNotFound(reply);
      }
      const sceneIds = ((props as PropsView).scenes ?? []).map((s) => s.sceneId);
      if ("sceneId" in body && !sceneIds.includes(body.sceneId)) {
        return sendValidationError(reply, `Video không có cảnh ${body.sceneId}.`);
      }
      if (body.kind === "background") {
        const backgrounds = await listMotionAssets(deps.db, { kind: "background" });
        if (!backgrounds.some((a) => a.assetId === body.backgroundId)) {
          return sendValidationError(reply, `Kho không có bối cảnh ${body.backgroundId}.`);
        }
      }
      if (body.kind === "regenerate_asset") {
        const asset = (await listMotionAssets(deps.db)).find((a) => a.assetId === body.assetId);
        if (
          asset === undefined ||
          !(REDO_REGENERATABLE_KINDS as readonly string[]).includes(asset.kind) ||
          !assetIdsInRenderProps(props).has(body.assetId)
        ) {
          return sendValidationError(
            reply,
            "Chỉ tạo lại được đồ vật hoặc bối cảnh đang có trong video này.",
          );
        }
      }

      const redoId = randomUUID();
      const file: RedoRequestFile = { redoId, createdAt: new Date().toISOString(), request: body };
      const target = resolve(deps.dataDir, redoStorageKey(runId, redoId));
      await mkdir(dirname(target), { recursive: true });
      const temp = `${target}.${randomUUID()}.tmp`;
      await writeFile(temp, `${JSON.stringify(file, null, 2)}\n`, { flag: "wx" });
      await rename(temp, target);
      try {
        const result = await requestRedo(deps.db, {
          workflowRunId: runId,
          redoId,
          target: redoTarget(body.kind),
        });
        deps.notifier?.notify(runId);
        return reply.status(202).send({ redoId, status: result.workflowRun.status as never });
      } catch (error) {
        // Không để file yêu cầu mồ côi: render sau sẽ áp nhầm nó.
        await rm(target, { force: true });
        if (error instanceof WorkflowControlError) {
          if (error.code === "not_found") {
            return sendNotFound(reply);
          }
          return sendInvalidTransition(reply, "Video không còn chờ duyệt bản cuối.");
        }
        throw error;
      }
    },
  );
}
