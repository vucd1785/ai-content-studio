import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { artifactDetailResponseSchema, artifactIdParamsSchema, MEDIA_ARTIFACT_TYPES } from "@studio/contracts";
import { getArtifactById, type StudioDb } from "@studio/db";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import { sendNotFound } from "../http/errors.js";

export type ArtifactRouteDeps = {
  db: StudioDb;
  dataDir: string;
};

/** File artifact JSON lớn nhất route chịu đọc vào bộ nhớ. */
const MAX_ARTIFACT_JSON_BYTES = 2 * 1024 * 1024;

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

/** Đọc JSON theo `storage_key`; path thoát `DATA_DIR` (kể cả qua symlink), thiếu file hay JSON hỏng thì `null`. */
async function readArtifactJson(dataDir: string, storageKey: string): Promise<unknown> {
  try {
    const target = await realpath(resolve(dataDir, storageKey));
    if (!isInside(await realpath(dataDir), target)) {
      return null;
    }
    if ((await stat(target)).size > MAX_ARTIFACT_JSON_BYTES) {
      return null;
    }
    return JSON.parse(await readFile(target, "utf8")) as unknown;
  } catch {
    return null;
  }
}

const MEDIA_TYPES: ReadonlySet<string> = new Set(MEDIA_ARTIFACT_TYPES);

export function registerArtifactRoutes(app: FastifyInstance, deps: ArtifactRouteDeps): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // Chỉ đọc (07-API-CONTRACTS). JSON artifact trả nội dung đã lưu; media chỉ metadata.
  typed.get(
    "/api/artifacts/:artifactId",
    {
      schema: {
        params: artifactIdParamsSchema,
        response: { 200: artifactDetailResponseSchema },
      },
    },
    async (request, reply) => {
      const row = await getArtifactById(deps.db, request.params.artifactId);
      if (row === null) {
        return sendNotFound(reply);
      }
      let content: unknown = null;
      if (!MEDIA_TYPES.has(row.type)) {
        content = await readArtifactJson(deps.dataDir, row.storageKey);
        if (content === null) {
          // Hàng còn nhưng file không đọc được: không đoán nội dung.
          return sendNotFound(reply);
        }
      }
      return {
        artifact: {
          id: row.id,
          projectId: row.projectId,
          workflowRunId: row.workflowRunId,
          type: row.type,
          version: row.version,
          schemaVersion: row.schemaVersion,
          contentHash: row.contentHash,
          metadata: (row.metadata ?? {}) as Record<string, unknown>,
          createdAt: row.createdAt.toISOString(),
        },
        content,
      };
    },
  );
}
