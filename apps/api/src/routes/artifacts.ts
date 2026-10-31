import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import {
  artifactDetailResponseSchema,
  artifactIdParamsSchema,
  MEDIA_ARTIFACT_TYPES,
} from "@studio/contracts";
import { getArtifactById, type StudioDb } from "@studio/db";
import type { FastifyInstance } from "fastify";
import { sendNotFound } from "../http/errors.js";
import { resolveStorageKey } from "../storage/resolve-storage-key.js";

export type ArtifactRouteDeps = {
  db: StudioDb;
  dataDir: string;
};

/** File artifact JSON lớn nhất route chịu đọc vào bộ nhớ. */
const MAX_ARTIFACT_JSON_BYTES = 2 * 1024 * 1024;

/** Đọc JSON theo `storage_key`; path thoát `DATA_DIR` (kể cả qua symlink), thiếu file hay JSON hỏng thì `null`. */
async function readArtifactJson(dataDir: string, storageKey: string): Promise<unknown> {
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
    return typeof key === "string" ? key : null;
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
}
