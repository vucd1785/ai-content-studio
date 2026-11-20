import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import {
  artifactDetailResponseSchema,
  artifactIdParamsSchema,
  MEDIA_ARTIFACT_TYPES,
  topicFileSlug,
} from "@studio/contracts";
import { getArtifactById, getRunBriefTopic, type StudioDb } from "@studio/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod/v4";
import { sendNotFound } from "../http/errors.js";
import { resolveStorageKey } from "../storage/resolve-storage-key.js";

export type ArtifactRouteDeps = {
  db: StudioDb;
  dataDir: string;
};

/** File artifact JSON lớn nhất route chịu đọc vào bộ nhớ. */
const MAX_ARTIFACT_JSON_BYTES = 2 * 1024 * 1024;

/** Đọc JSON theo `storage_key`; path thoát `DATA_DIR` (kể cả qua symlink), thiếu file hay JSON hỏng thì `null`. */
export async function readArtifactJson(dataDir: string, storageKey: string): Promise<unknown> {
  const target = await resolveStorageKey(dataDir, storageKey);
  if (target === null) {
    return null;
  }
  try {
    if ((await stat(target)).size > MAX_ARTIFACT_JSON_BYTES) {
      return null;
    }
    return JSON.parse(await readFile(target, "utf8")) as unknown;
  } catch {
    return null;
  }
}

/** Chỉ stream các đuôi media này; file khác trong volume không ra ngoài qua route media. */
const MEDIA_CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".mp4": "video/mp4",
  ".wav": "audio/wav",
};

/**
 * File media của một artifact: `preview`/`export` là MP4 ở chính `storage_key`; `render_props` là WAV ở
 * `audio.storageKey` trong props (để player trên web có tiếng). `audio` chỉ là manifest JSON nhiều WAV nên không có.
 */
async function mediaStorageKey(
  dataDir: string,
  row: { type: string; storageKey: string },
): Promise<string | null> {
  if (row.type === "preview" || row.type === "export") {
    return row.storageKey;
  }
  if (row.type === "render_props") {
    const props = (await readArtifactJson(dataDir, row.storageKey)) as {
      audio?: { storageKey?: unknown };
    } | null;
    const key = props?.audio?.storageKey;
    if (typeof key !== "string") {
      return null;
    }
    // Worker ghi khóa audio tương đối với `render/public` (để Remotion `staticFile` đọc được), ví dụ
    // `pipeline/edu-<sha>.wav`. Khóa cũ của test tương đối với volume vẫn đọc như trước.
    const target = await resolveStorageKey(dataDir, key);
    const exists =
      target === null
        ? false
        : await stat(target).then(
            (i) => i.isFile(),
            () => false,
          );
    return exists ? key : `render/public/${key}`;
  }
  return null;
}

type ByteRange = { start: number; end: number };

/**
 * Header `Range` một khoảng (`bytes=a-b`, `bytes=a-`, `bytes=-n`). `undefined`: không có hoặc nhiều khoảng
 * (trả cả file); `null`: không thỏa được (416).
 */
export function parseByteRange(
  header: string | undefined,
  size: number,
): ByteRange | null | undefined {
  if (header === undefined) {
    return undefined;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (match === null) {
    return header.includes(",") ? undefined : null;
  }
  const [, from = "", to = ""] = match;
  if (from === "" && to === "") {
    return null;
  }
  if (from === "") {
    const suffix = Number(to);
    return suffix === 0 || size === 0 ? null : { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(from);
  const end = to === "" ? size - 1 : Math.min(Number(to), size - 1);
  return start >= size || end < start ? null : { start, end };
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

  // Chỉ đọc (07-API-CONTRACTS). Stream file sau khi resolve `storage_key` trong volume; hỗ trợ Range để tua video.
  typed.get(
    "/api/artifacts/:artifactId/media",
    { schema: { params: artifactIdParamsSchema } },
    async (request, reply) => {
      const row = await getArtifactById(deps.db, request.params.artifactId);
      const key = row === null ? null : await mediaStorageKey(deps.dataDir, row);
      const contentType =
        key === null ? undefined : MEDIA_CONTENT_TYPES[extname(key).toLowerCase()];
      const target =
        key === null || contentType === undefined
          ? null
          : await resolveStorageKey(deps.dataDir, key);
      const info = target === null ? null : await stat(target).catch(() => null);
      if (target === null || info === null || !info.isFile() || contentType === undefined) {
        return sendNotFound(reply);
      }
      const size = info.size;
      const range = parseByteRange(request.headers.range, size);
      // Video tải về mang tên chủ đề của brief, không dấu (Director 2026-11-12): vi-sao-dom-dom-phat-sang.mp4.
      // `inline` để thẻ <video> vẫn phát; link có thuộc tính `download` lấy tên từ đây.
      if (row !== null && (row.type === "export" || row.type === "preview")) {
        const topic = await getRunBriefTopic(deps.db, row.workflowRunId);
        const base = topicFileSlug(topic ?? "", "video");
        const name = row.type === "preview" ? `${base}-ban-xem-truoc` : base;
        reply.header("content-disposition", `inline; filename="${name}${extname(key ?? "")}"`);
      }
      reply
        .header("content-type", contentType)
        .header("accept-ranges", "bytes")
        .header("cache-control", "private, no-cache")
        .header("x-content-type-options", "nosniff");
      if (range === null) {
        return reply.status(416).header("content-range", `bytes */${size}`).send();
      }
      if (range === undefined) {
        return reply.header("content-length", size).send(createReadStream(target));
      }
      return reply
        .status(206)
        .header("content-range", `bytes ${range.start}-${range.end}/${size}`)
        .header("content-length", range.end - range.start + 1)
        .send(createReadStream(target, { start: range.start, end: range.end }));
    },
  );

  // Ảnh bìa của bản xuất (ADR-021): chỉ file JPEG ghi trong metadata `thumbnailKey` của artifact `export`,
  // nằm trong thư mục artifact của đúng run. Không nhận đường dẫn từ client.
  typed.get(
    "/api/artifacts/:artifactId/thumbnail",
    { schema: { params: artifactIdParamsSchema } },
    async (request, reply) => {
      const row = await getArtifactById(deps.db, request.params.artifactId);
      const key =
        row === null || row.type !== "export"
          ? null
          : (row.metadata as { thumbnailKey?: unknown } | null)?.thumbnailKey;
      if (
        row === null ||
        typeof key !== "string" ||
        !key.startsWith(`artifacts/${row.workflowRunId}/thumbnail-`) ||
        extname(key) !== ".jpg"
      ) {
        return sendNotFound(reply);
      }
      const target = await resolveStorageKey(deps.dataDir, key);
      const info = target === null ? null : await stat(target).catch(() => null);
      if (target === null || info === null || !info.isFile()) {
        return sendNotFound(reply);
      }
      // Ảnh bìa tải về mang tên chủ đề như video (ADR-027): vi-sao-dom-dom-phat-sang-anh-bia.jpg.
      const topic = await getRunBriefTopic(deps.db, row.workflowRunId);
      const name = `${topicFileSlug(topic ?? "", "video")}-anh-bia.jpg`;
      return reply
        .header("content-type", "image/jpeg")
        .header("content-disposition", `inline; filename="${name}"`)
        .header("content-length", info.size)
        .header("cache-control", "private, no-cache")
        .header("x-content-type-options", "nosniff")
        .send(createReadStream(target));
    },
  );

  // Ảnh storyboard (P6-10, P6-17): chỉ file PNG có tên trong artifact `storyboard` schema `2`, nằm trong
  // thư mục storyboard của đúng run. Không nhận đường dẫn từ client.
  typed.get(
    "/api/artifacts/:artifactId/stills/:variantIndex/:sceneId",
    {
      schema: {
        params: artifactIdParamsSchema.extend({
          variantIndex: z.coerce.number().int().min(1).max(2),
          sceneId: z.string().regex(/^[a-z0-9-]{1,40}$/),
        }),
        // Ảnh thêm của một shot khác trong cảnh (bổ sung 2026-11-12); thiếu là ảnh chính.
        querystring: z.object({
          shot: z
            .string()
            .regex(/^s[0-9]{1,3}[a-z]?$/)
            .optional(),
        }),
      },
    },
    async (request, reply) => {
      const { artifactId, variantIndex, sceneId } = request.params;
      const shotId = request.query.shot;
      const row = await getArtifactById(deps.db, artifactId);
      if (row === null || row.type !== "storyboard" || row.schemaVersion !== "2") {
        return sendNotFound(reply);
      }
      const board = (await readArtifactJson(deps.dataDir, row.storageKey)) as {
        variants?: {
          variantIndex?: unknown;
          scenes?: {
            sceneId?: unknown;
            stillKey?: unknown;
            extraStills?: { shotId?: unknown; stillKey?: unknown }[];
          }[];
        }[];
      } | null;
      const scene = board?.variants
        ?.find((variant) => variant.variantIndex === variantIndex)
        ?.scenes?.find((item) => item.sceneId === sceneId);
      const key =
        shotId === undefined
          ? scene?.stillKey
          : (Array.isArray(scene?.extraStills) ? scene.extraStills : []).find(
              (e) => e.shotId === shotId,
            )?.stillKey;
      const prefix = `artifacts/${row.workflowRunId}/storyboard/`;
      if (typeof key !== "string" || !key.startsWith(prefix) || extname(key) !== ".png") {
        return sendNotFound(reply);
      }
      const target = await resolveStorageKey(deps.dataDir, key);
      const info = target === null ? null : await stat(target).catch(() => null);
      if (target === null || info === null || !info.isFile()) {
        return sendNotFound(reply);
      }
      return reply
        .header("content-type", "image/png")
        .header("content-length", info.size)
        .header("cache-control", "private, no-cache")
        .header("x-content-type-options", "nosniff")
        .send(createReadStream(target));
    },
  );
}
