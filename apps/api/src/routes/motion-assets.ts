import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import {
  assetIdsInRenderProps,
  type MotionAsset,
  motionAssetIdParamsSchema,
  motionAssetListQuerySchema,
  motionAssetListResponseSchema,
  motionAssetUsageResponseSchema,
  runAssetRequestListResponseSchema,
  runIdParamsSchema,
} from "@studio/contracts";
import {
  listLatestRenderPropsByRun,
  listMotionAssetRequests,
  listMotionAssets,
  type MotionAssetKind,
  type MotionAssetRow,
  type StudioDb,
} from "@studio/db";
import type { FastifyInstance } from "fastify";
import { sendNotFound } from "../http/errors.js";
import { resolveStorageKey } from "../storage/resolve-storage-key.js";
import { readArtifactJson } from "./artifacts.js";

export type MotionAssetRouteDeps = { db: StudioDb; dataDir: string };

const toAsset = (row: MotionAssetRow): MotionAsset => ({
  assetId: row.assetId,
  kind: row.kind,
  version: row.version,
  tags: row.tags as string[],
  createdBy: row.createdBy as MotionAsset["createdBy"],
  status: row.status as MotionAsset["status"],
  hasPreview: row.previewStorageKey !== null,
});

/**
 * Kho hình động chỉ đọc (ADR-016/017): danh sách tài sản, yêu cầu tài sản của một run cho Cổng 1, ảnh xem trước.
 * Không route nào ở đây đổi trạng thái tài sản; duyệt tài sản đi cùng approval Cổng 1.
 */
export function registerMotionAssetRoutes(app: FastifyInstance, deps: MotionAssetRouteDeps): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/api/motion-assets",
    {
      schema: {
        querystring: motionAssetListQuerySchema,
        response: { 200: motionAssetListResponseSchema },
      },
    },
    async (request) => {
      const rows = await listMotionAssets(deps.db, {
        ...(request.query.kind === undefined
          ? {}
          : { kind: request.query.kind as MotionAssetKind }),
        ...(request.query.status === undefined ? {} : { status: request.query.status }),
      });
      return { assets: rows.map(toAsset) };
    },
  );

  // Lọc "dùng trong video nào" (ADR-021): đọc `render_props` mới nhất của mỗi run. Chỉ đọc.
  typed.get(
    "/api/motion-assets/usage",
    { schema: { response: { 200: motionAssetUsageResponseSchema } } },
    async () => {
      const rows = await listLatestRenderPropsByRun(deps.db);
      const videos: {
        projectId: string;
        projectName: string;
        workflowRunId: string;
        exported: boolean;
      }[] = [];
      const usage: Record<string, number[]> = {};
      for (const row of rows) {
        const props = await readArtifactJson(deps.dataDir, row.storageKey);
        const ids = assetIdsInRenderProps(props);
        if (ids.size === 0) {
          continue;
        }
        const index = videos.length;
        videos.push({
          projectId: row.projectId,
          projectName: row.projectName,
          workflowRunId: row.workflowRunId,
          exported: row.runStatus === "exported",
        });
        for (const id of ids) {
          usage[id] = [...(usage[id] ?? []), index];
        }
      }
      return { videos, usage };
    },
  );

  typed.get(
    "/api/workflow-runs/:runId/asset-requests",
    {
      schema: {
        params: runIdParamsSchema,
        response: { 200: runAssetRequestListResponseSchema },
      },
    },
    async (request) => {
      const rows = await listMotionAssetRequests(deps.db, { workflowRunId: request.params.runId });
      const assets = new Map(
        (await listMotionAssets(deps.db)).map((row) => [row.assetId, toAsset(row)]),
      );
      return {
        requests: rows.map((r) => ({
          id: r.id,
          scriptArtifactId: r.scriptArtifactId,
          variantIndex: r.variantIndex,
          requestKey: r.requestKey,
          kind: r.kind,
          description: r.description,
          sceneIds: r.sceneId.split(",").filter((s) => s !== ""),
          fallbackAssetId: r.fallbackAssetId,
          status: r.status as "open" | "fulfilled" | "dismissed",
          asset: r.fulfilledAssetId === null ? null : (assets.get(r.fulfilledAssetId) ?? null),
        })),
      };
    },
  );

  typed.get(
    "/api/motion-assets/:assetId/preview",
    { schema: { params: motionAssetIdParamsSchema } },
    async (request, reply) => {
      const [row] = (await listMotionAssets(deps.db)).filter(
        (a) => a.assetId === request.params.assetId,
      );
      const key = row?.previewStorageKey;
      if (typeof key !== "string" || !key.startsWith("motion-assets/") || !key.endsWith(".png")) {
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
