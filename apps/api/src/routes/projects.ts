import {
  briefWriteBodySchema,
  briefSchema,
  projectCreateBodySchema,
  projectDetailResponseSchema,
  projectIdParamsSchema,
  projectListResponseSchema,
  projectPatchBodySchema,
  projectSchema,
  referenceIdParamsSchema,
  referenceJsonBodySchema,
  referenceResponseSchema,
} from "@studio/contracts";
import type { StudioDb } from "@studio/db";
import {
  countBriefsForProject,
  createProject,
  deleteReference,
  getLatestBrief,
  getLatestWorkflowRun,
  getProjectById,
  insertBrief,
  insertReferenceFile,
  insertReferenceUrl,
  listProjects,
  listReferences,
  updateProjectTitle,
} from "@studio/db";
import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import {
  isPostgresCheckViolation,
  sendNotFound,
  sendPayloadTooLarge,
  sendValidationError,
} from "../http/errors.js";
import { MAX_UPLOAD_BYTES } from "../storage/constants.js";
import {
  consumeStreamWithLimit,
  extensionFromFilename,
  removeUploadFile,
  StorageValidationError,
  writeUploadFile,
} from "../storage/upload.js";

export type ProjectRouteDeps = {
  db: StudioDb;
  dataDir: string;
};

export async function registerProjectRoutes(
  app: FastifyInstance,
  deps: ProjectRouteDeps,
): Promise<void> {
  await app.register(multipart, {
    limits: {
      fileSize: MAX_UPLOAD_BYTES,
      files: 1,
      parts: 8,
    },
  });

  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/api/projects",
    {
      schema: {
        response: {
          200: projectListResponseSchema,
        },
      },
    },
    async () => {
      const projectsList = await listProjects(deps.db);
      return { projects: projectsList };
    },
  );

  typed.post(
    "/api/projects",
    {
      schema: {
        body: projectCreateBodySchema,
        response: {
          201: projectSchema,
        },
      },
    },
    async (request, reply) => {
      const project = await createProject(deps.db, request.body.title);
      return reply.status(201).send(project);
    },
  );

  typed.get(
    "/api/projects/:projectId",
    {
      schema: {
        params: projectIdParamsSchema,
        response: {
          200: projectDetailResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const project = await getProjectById(deps.db, projectId);
      if (project === null) {
        return sendNotFound(reply);
      }
      const brief = await getLatestBrief(deps.db, projectId);
      const workflowRun = await getLatestWorkflowRun(deps.db, projectId);
      const refs = await listReferences(deps.db, projectId);
      return {
        project,
        brief,
        workflowRun,
        references: refs,
      };
    },
  );

  typed.patch(
    "/api/projects/:projectId",
    {
      schema: {
        params: projectIdParamsSchema,
        body: projectPatchBodySchema,
        response: {
          200: projectSchema,
        },
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const updated = await updateProjectTitle(deps.db, projectId, request.body.title);
      if (updated === null) {
        return sendNotFound(reply);
      }
      return updated;
    },
  );

  typed.put(
    "/api/projects/:projectId/brief",
    {
      schema: {
        params: projectIdParamsSchema,
        body: briefWriteBodySchema,
        response: {
          201: briefSchema,
        },
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const project = await getProjectById(deps.db, projectId);
      if (project === null) {
        return sendNotFound(reply);
      }
      try {
        const brief = await insertBrief(deps.db, projectId, request.body);
        return reply.status(201).send(brief);
      } catch (error) {
        if (isPostgresCheckViolation(error)) {
          return sendValidationError(reply);
        }
        throw error;
      }
    },
  );

  typed.post(
    "/api/projects/:projectId/references",
    {
      schema: {
        params: projectIdParamsSchema,
        response: {
          201: referenceResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const project = await getProjectById(deps.db, projectId);
      if (project === null) {
        return sendNotFound(reply);
      }

      const contentType = request.headers["content-type"] ?? "";
      if (contentType.includes("application/json")) {
        const parsed = referenceJsonBodySchema.safeParse(request.body);
        if (!parsed.success) {
          return sendValidationError(reply);
        }
        const created = await insertReferenceUrl(deps.db, {
          projectId,
          url: parsed.data.url,
          title: parsed.data.title ?? null,
        });
        return reply.status(201).send(created);
      }

      if (!contentType.includes("multipart/form-data")) {
        return sendValidationError(reply);
      }

      let storageKey: string | undefined;
      try {
        const filePart = await request.file();
        if (filePart === undefined) {
          return sendValidationError(reply);
        }
        const ext = extensionFromFilename(filePart.filename);
        if (ext === null) {
          filePart.file.resume();
          return sendValidationError(reply, "Loại tệp không được hỗ trợ.");
        }
        const buffer = await consumeStreamWithLimit(filePart.file, MAX_UPLOAD_BYTES);
        if (filePart.file.truncated || buffer.length > MAX_UPLOAD_BYTES) {
          return sendPayloadTooLarge(reply);
        }
        const stored = await writeUploadFile(deps.dataDir, buffer, ext);
        storageKey = stored.storageKey;
        const created = await insertReferenceFile(deps.db, {
          projectId,
          storageKey: stored.storageKey,
          title: displayTitleFromFilename(filePart.filename),
          mediaType: stored.mediaType,
          byteSize: stored.byteSize,
          contentHash: stored.contentHash,
        });
        return reply.status(201).send(created);
      } catch (error) {
        if (storageKey !== undefined) {
          await removeUploadFile(deps.dataDir, storageKey);
        }
        if (error instanceof StorageValidationError) {
          if (error.code === "upload_too_large") {
            return sendPayloadTooLarge(reply);
          }
          return sendValidationError(reply);
        }
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE"
        ) {
          return sendPayloadTooLarge(reply);
        }
        throw error;
      }
    },
  );

  typed.delete(
    "/api/projects/:projectId/references/:referenceId",
    {
      schema: {
        params: referenceIdParamsSchema,
      },
    },
    async (request, reply) => {
      const { projectId, referenceId } = request.params;
      const project = await getProjectById(deps.db, projectId);
      if (project === null) {
        return sendNotFound(reply);
      }
      const deleted = await deleteReference(deps.db, projectId, referenceId);
      if (!deleted) {
        return sendNotFound(reply);
      }
      return reply.status(204).send();
    },
  );
}

/** Tên hiển thị từ filename client: bỏ thư mục, ký tự điều khiển, cắt 200 ký tự. Không dùng làm path. */
function displayTitleFromFilename(filename: string): string | null {
  const base = filename.split(/[/\\]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200);
  return cleaned === "" ? null : cleaned;
}
