import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { StudioDb } from "./db.js";
import {
  artifacts,
  motionAssetRequests,
  motionAssets,
  projects,
  workflowRuns,
} from "./schema/index.js";
import type { StudioTx } from "./workflow.js";

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

/**
 * ADR-017 mục 2: tài sản worker vừa tạo (hoặc dùng lại) là `candidate`; yêu cầu được đóng ngay để cảnh dùng
 * tài sản mới ở storyboard. Tài sản thành `approved` khi Director duyệt phương án ở Cổng 1.
 */
export async function fulfillMotionAssetRequestWithAsset(
  db: StudioDb,
  requestId: string,
  assetId: string,
): Promise<void> {
  await db
    .update(motionAssetRequests)
    .set({ status: "fulfilled", fulfilledAssetId: assetId, updatedAt: new Date() })
    .where(and(eq(motionAssetRequests.id, requestId), eq(motionAssetRequests.status, "open")));
}

/** Yêu cầu tài sản của một artifact script (mọi phương án), theo thứ tự ghi. */
export async function listMotionAssetRequestsForScript(db: StudioDb, scriptArtifactId: string) {
  return db
    .select()
    .from(motionAssetRequests)
    .where(eq(motionAssetRequests.scriptArtifactId, scriptArtifactId))
    .orderBy(asc(motionAssetRequests.variantIndex), asc(motionAssetRequests.requestKey));
}

/**
 * Duyệt phương án ở Cổng 1 (ADR-017 mục 3): tài sản `candidate` mà phương án đó dùng thành `approved`.
 * Gọi trong cùng giao dịch với approval; trả id tài sản vừa đổi để worker cập nhật `asset.json`.
 */
export async function approveCandidateAssetsForVariant(
  db: StudioDb | StudioTx,
  target: { scriptArtifactId: string; variantIndex: number },
): Promise<string[]> {
  const requests = await db
    .select({ assetId: motionAssetRequests.fulfilledAssetId })
    .from(motionAssetRequests)
    .where(
      and(
        eq(motionAssetRequests.scriptArtifactId, target.scriptArtifactId),
        eq(motionAssetRequests.variantIndex, target.variantIndex),
        eq(motionAssetRequests.status, "fulfilled"),
      ),
    );
  const ids = [...new Set(requests.map((r) => r.assetId).filter((id): id is string => !!id))];
  if (ids.length === 0) {
    return [];
  }
  const updated = await db
    .update(motionAssets)
    .set({ status: "approved", syncedAt: sql`now()` })
    .where(and(inArray(motionAssets.assetId, ids), eq(motionAssets.status, "candidate")))
    .returning({ assetId: motionAssets.assetId });
  return updated.map((r) => r.assetId);
}

/** Chỉ cho test tích hợp: xóa yêu cầu của các run và các tài sản đã tạo trong test. */
export async function deleteMotionAssetRowsForTests(
  db: StudioDb,
  target: { workflowRunIds: string[]; assetIds: string[] },
): Promise<void> {
  if (target.workflowRunIds.length > 0) {
    await db
      .delete(motionAssetRequests)
      .where(inArray(motionAssetRequests.workflowRunId, target.workflowRunIds));
  }
  if (target.assetIds.length > 0) {
    await db.delete(motionAssets).where(inArray(motionAssets.assetId, target.assetIds));
  }
}

/**
 * `render_props` mới nhất của mỗi run kèm dự án (lọc "dùng trong video nào" ở Kho, ADR-021).
 * API đọc file props để biết tài sản nào có trong video.
 */
export async function listLatestRenderPropsByRun(db: StudioDb) {
  const rows = await db
    .select({
      workflowRunId: artifacts.workflowRunId,
      projectId: projects.id,
      projectName: projects.title,
      runStatus: workflowRuns.status,
      storageKey: artifacts.storageKey,
      version: artifacts.version,
      createdAt: artifacts.createdAt,
    })
    .from(artifacts)
    .innerJoin(workflowRuns, eq(workflowRuns.id, artifacts.workflowRunId))
    .innerJoin(projects, eq(projects.id, workflowRuns.projectId))
    .where(eq(artifacts.type, "render_props"))
    .orderBy(asc(artifacts.createdAt));
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const prev = latest.get(row.workflowRunId);
    if (prev === undefined || row.version > prev.version) {
      latest.set(row.workflowRunId, row);
    }
  }
  return [...latest.values()];
}
