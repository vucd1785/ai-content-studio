import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import {
  apiErrorBodySchema,
  applyScriptLineEdits,
  runIdParamsSchema,
  scriptLineEditsBodySchema,
  scriptLineEditsResponseSchema,
} from "@studio/contracts";
import {
  createEditedScriptArtifact,
  getArtifactById,
  ScriptEditError,
  type StudioDb,
} from "@studio/db";
import type { FastifyInstance } from "fastify";
import {
  sendConflict,
  sendInvalidTransition,
  sendNotFound,
  sendValidationError,
} from "../http/errors.js";
import { resolveStorageKey } from "../storage/resolve-storage-key.js";

export type ScriptEditRouteDeps = {
  db: StudioDb;
  dataDir: string;
  notifier?: { notify(runId: string): void };
};

const MAX_SCRIPT_BYTES = 2 * 1024 * 1024;

type ScriptFile = {
  variants: {
    scenes: {
      lines: { id: string; text: string }[];
      shots: { id: string; lineId: string; cutOnWord: string }[];
    }[];
  }[];
};

function isScriptFile(value: unknown): value is ScriptFile {
  const v = value as ScriptFile | null;
  return (
    typeof v === "object" &&
    v !== null &&
    Array.isArray(v.variants) &&
    v.variants.every(
      (variant) =>
        Array.isArray(variant?.scenes) &&
        variant.scenes.every((s) => Array.isArray(s?.lines) && Array.isArray(s?.shots)),
    )
  );
}

/**
 * Sửa câu thoại tại Cổng 1 (ADR-020): đọc script `2` mới nhất, thay chữ các câu, ghi file mới rồi thêm artifact
 * version kế tiếp. Không gọi LLM, không ghi approval; storyboard giữ nguyên vì shot không đổi.
 */
export function registerScriptEditRoutes(app: FastifyInstance, deps: ScriptEditRouteDeps): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/api/workflow-runs/:runId/script-edits",
    {
      schema: {
        params: runIdParamsSchema,
        body: scriptLineEditsBodySchema,
        response: {
          201: scriptLineEditsResponseSchema,
          409: apiErrorBodySchema,
          422: apiErrorBodySchema,
        },
      },
    },
    async (request, reply) => {
      const { runId } = request.params;
      const { artifactId, variantIndex, edits } = request.body;
      const source = await getArtifactById(deps.db, artifactId);
      if (source === null || source.workflowRunId !== runId || source.type !== "script") {
        return sendNotFound(reply);
      }
      if (source.schemaVersion !== "2") {
        return sendValidationError(reply, "Chỉ sửa được kịch bản dạng mới (script 2).");
      }
      const path = await resolveStorageKey(deps.dataDir, source.storageKey);
      if (path === null || (await stat(path)).size > MAX_SCRIPT_BYTES) {
        return sendNotFound(reply);
      }
      const content: unknown = JSON.parse(await readFile(path, "utf8"));
      if (!isScriptFile(content) || content.variants[variantIndex - 1] === undefined) {
        return sendValidationError(reply, "Kịch bản không đúng dạng.");
      }
      const applied = applyScriptLineEdits(
        content.variants[variantIndex - 1] as ScriptFile["variants"][number],
        edits,
      );
      if (applied.unknownLineIds.length > 0) {
        return sendValidationError(
          reply,
          `Không có câu ${applied.unknownLineIds.join(", ")} trong phương án ${variantIndex}.`,
        );
      }
      const variants = content.variants.map((v, i) =>
        i === variantIndex - 1 ? applied.variant : v,
      );
      const key = `artifacts/${runId}/script-${randomUUID()}.json`;
      const bytes = Buffer.from(`${JSON.stringify({ ...content, variants }, null, 2)}\n`, "utf8");
      const target = resolve(deps.dataDir, key);
      await mkdir(dirname(target), { recursive: true });
      const temp = `${target}.${randomUUID()}.tmp`;
      await writeFile(temp, bytes, { flag: "wx" });
      await rename(temp, target);
      try {
        const row = await createEditedScriptArtifact(deps.db, {
          workflowRunId: runId,
          sourceArtifactId: source.id,
          storageKey: key,
          contentHash: createHash("sha256").update(bytes).digest("hex"),
          metadata: {
            ...(source.metadata as Record<string, unknown>),
            editedBy: "director",
            baseArtifactId: source.id,
            editedVariantIndex: variantIndex,
            editedLineIds: edits.map((e) => e.lineId),
          },
        });
        deps.notifier?.notify(runId);
        return reply.status(201).send({
          artifactId: row.id,
          version: row.version,
          retargetedShots: applied.retargeted,
        });
      } catch (error) {
        if (error instanceof ScriptEditError) {
          if (error.code === "not_found") {
            return sendNotFound(reply);
          }
          if (error.code === "invalid_transition") {
            return sendInvalidTransition(reply, "Chỉ sửa câu khi kịch bản đang chờ duyệt.");
          }
          return sendConflict(reply, "Đã có bản kịch bản mới hơn. Tải lại rồi sửa tiếp.");
        }
        throw error;
      }
    },
  );
}
