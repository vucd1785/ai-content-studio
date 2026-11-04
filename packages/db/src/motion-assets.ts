import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import type { StudioDb } from "./db.js";
import { motionAssetRequests, motionAssets } from "./schema/index.js";

/**
 * Kho tài sản và yêu cầu tài sản (ADR-016, P6-07).
 * `motion_assets` là bản sao chỉ đọc của manifest trong repo: chỉ script đồng bộ gọi `upsertMotionAssetFromManifest`.
 * Ghi các bảng này không tạo hàng `approvals` và không đổi `workflow_runs.status`.
 */

export const MOTION_ASSET_KINDS = [
  "character_skin",
  "expression",
  "pose",
  "action",
  "background",
  "prop",
  "camera",
  "sfx",
  "brand_card",
] as const;
export type MotionAssetKind = (typeof MOTION_ASSET_KINDS)[number];

export type MotionAssetRow = typeof motionAssets.$inferSelect;
export type MotionAssetRequestRow = typeof motionAssetRequests.$inferSelect;

export type MotionAssetManifestInput = {
  assetId: string;
  kind: MotionAssetKind;
  version: string;
  tags: string[];
  brandProfileId: string | null;
  createdBy: "director" | "claude-code";
  status: "candidate" | "approved";
  sourcePath: string;
  previewStorageKey: string | null;
  manifestHash: string;
};

/** Ghi một manifest. Cùng `manifest_hash` thì không đổi hàng; trả `changed` để script đồng bộ báo cáo. */
export async function upsertMotionAssetFromManifest(
  db: StudioDb,
  input: MotionAssetManifestInput,
): Promise<{ changed: boolean; row: MotionAssetRow }> {
  const values = {
    assetId: input.assetId,
    kind: input.kind,
    version: input.version,
    tags: input.tags,
    brandProfileId: input.brandProfileId,
    createdBy: input.createdBy,
    status: input.status,
    sourcePath: input.sourcePath,
    previewStorageKey: input.previewStorageKey,
    manifestHash: input.manifestHash,
  };
  const [written] = await db
    .insert(motionAssets)
    .values(values)
    .onConflictDoUpdate({
      target: motionAssets.assetId,
      set: { ...values, syncedAt: sql`now()` },
      setWhere: sql`${motionAssets.manifestHash} IS DISTINCT FROM excluded.manifest_hash`,
    })
    .returning();
  if (written !== undefined) {
    return { changed: true, row: written };
  }
  const [existing] = await db
    .select()
    .from(motionAssets)
    .where(eq(motionAssets.assetId, input.assetId))
    .limit(1);
  if (existing === undefined) {
    throw new Error("upsert_motion_asset_failed");
  }
  return { changed: false, row: existing };
}

/**
 * Tài sản dùng được cho một kênh: tài sản chung (`brand_profile_id` null) và tài sản riêng của kênh đó.
 * Prompt `standard` chỉ nhận `status = approved`.
 */
export async function listMotionAssets(
  db: StudioDb,
  filter: {
    brandProfileId?: string;
    status?: "candidate" | "approved";
    kind?: MotionAssetKind;
  } = {},
) {
  const conditions = [];
  if (filter.brandProfileId !== undefined) {
    conditions.push(
      or(
        isNull(motionAssets.brandProfileId),
        eq(motionAssets.brandProfileId, filter.brandProfileId),
      ),
    );
  }
  if (filter.status !== undefined) {
    conditions.push(eq(motionAssets.status, filter.status));
  }
  if (filter.kind !== undefined) {
    conditions.push(eq(motionAssets.kind, filter.kind));
  }
  return db
    .select()
    .from(motionAssets)
    .where(conditions.length === 0 ? undefined : and(...conditions))
    .orderBy(asc(motionAssets.kind), asc(motionAssets.assetId));
}

export type NewMotionAssetRequest = {
  sceneId: string;
  requestKey: string;
  kind: MotionAssetKind;
  description: string;
  fallbackAssetId: string;
};

/** Ghi yêu cầu của một phương án script. Job chạy lại không tạo trùng (unique theo artifact, phương án, khóa). */
export async function insertMotionAssetRequests(
  db: StudioDb,
  target: { workflowRunId: string; scriptArtifactId: string; variantIndex: 1 | 2 },
  requests: NewMotionAssetRequest[],
): Promise<number> {
  if (requests.length === 0) {
    return 0;
  }
  const inserted = await db
    .insert(motionAssetRequests)
    .values(
      requests.map((request) => ({
        workflowRunId: target.workflowRunId,
        scriptArtifactId: target.scriptArtifactId,
        variantIndex: target.variantIndex,
        sceneId: request.sceneId,
        requestKey: request.requestKey,
        kind: request.kind,
        description: request.description,
        fallbackAssetId: request.fallbackAssetId,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: motionAssetRequests.id });
  return inserted.length;
}

export async function listMotionAssetRequests(
  db: StudioDb,
  filter: { workflowRunId?: string; status?: "open" | "fulfilled" | "dismissed" } = {},
) {
  const conditions = [];
  if (filter.workflowRunId !== undefined) {
    conditions.push(eq(motionAssetRequests.workflowRunId, filter.workflowRunId));
  }
  if (filter.status !== undefined) {
    conditions.push(eq(motionAssetRequests.status, filter.status));
  }
  return db
    .select()
    .from(motionAssetRequests)
    .where(conditions.length === 0 ? undefined : and(...conditions))
    .orderBy(asc(motionAssetRequests.createdAt), asc(motionAssetRequests.requestKey));
}

export class MotionAssetRequestError extends Error {
  constructor(
    readonly code: "not_found" | "not_open" | "asset_not_approved",
    message: string,
  ) {
    super(message);
    this.name = "MotionAssetRequestError";
  }
}

/** Đóng một yêu cầu `open`: `fulfilled` chỉ khi tài sản trỏ tới đã `approved`. */
export async function resolveMotionAssetRequest(
  db: StudioDb,
  requestId: string,
  resolution: { status: "fulfilled"; assetId: string } | { status: "dismissed" },
): Promise<MotionAssetRequestRow> {
  return db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(motionAssetRequests)
      .where(eq(motionAssetRequests.id, requestId))
      .for("update")
      .limit(1);
    if (request === undefined) {
      throw new MotionAssetRequestError("not_found", "motion asset request not found");
    }
    if (request.status !== "open") {
      throw new MotionAssetRequestError("not_open", `request is ${request.status}`);
    }
    if (resolution.status === "fulfilled") {
      const [asset] = await tx
        .select({ status: motionAssets.status })
        .from(motionAssets)
        .where(eq(motionAssets.assetId, resolution.assetId))
        .limit(1);
      if (asset?.status !== "approved") {
        throw new MotionAssetRequestError("asset_not_approved", "asset must be approved");
      }
    }
    const [updated] = await tx
      .update(motionAssetRequests)
      .set({
        status: resolution.status,
        fulfilledAssetId: resolution.status === "fulfilled" ? resolution.assetId : null,
        updatedAt: new Date(),
      })
      .where(eq(motionAssetRequests.id, requestId))
      .returning();
    if (updated === undefined) {
      throw new Error("update_motion_asset_request_failed");
    }
    return updated;
  });
}
