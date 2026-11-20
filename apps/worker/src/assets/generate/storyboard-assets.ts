import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { MotionAssetKind, ScriptV2 } from "@studio/contracts";
import {
  fulfillMotionAssetRequestWithAsset,
  insertMotionAssetRequests,
  listMotionAssetRequestsForScript,
  listMotionAssets,
  type StudioDb,
  upsertMotionAssetFromManifest,
} from "@studio/db";
import type { AssetRequestInput, AssetRequestOutcome } from "./generate-assets.js";
import { listManifests, readManifest, writeManifest } from "./registry.js";
import { previewStorageKey } from "./render-check.js";
import { type AssetSubstitution, joinSceneIds, splitSceneIds } from "./substitute.js";

export type ResolveAssets = (input: {
  topic: string;
  runId: string;
  /** Agent run `visual` của job storyboard, để ghi `usage_records`. */
  agentRunId: string;
  /**
   * Kịch bản đang dựng: kịch bản viết lại trong cùng run đánh lại r1…, nên khóa yêu cầu phải kèm kịch bản để không
   * nhận lại tài sản của kịch bản cũ.
   */
  scriptArtifactId?: string;
  requests: AssetRequestInput[];
}) => Promise<AssetRequestOutcome[]>;

export type PreparedAssets = {
  substitutions: Map<1 | 2, AssetSubstitution[]>;
  /** Có tài sản mới trong kho: renderer phải bundle lại. */
  changed: boolean;
  errors: { variantIndex: 1 | 2; message: string }[];
};

/** Đồng bộ một manifest trong repo vào `motion_assets` (bản sao chỉ đọc, ADR-016). */
export async function syncAssetRow(db: StudioDb, kitSrc: string, kind: string, id: string) {
  const manifest = readManifest(kitSrc, kind, id);
  if (manifest === null) {
    return;
  }
  await upsertMotionAssetFromManifest(db, {
    assetId: manifest.id,
    kind: manifest.kind as MotionAssetKind,
    version: manifest.version,
    tags: manifest.tags,
    brandProfileId: null,
    createdBy: manifest.createdBy,
    status: manifest.status,
    sourcePath: `packages/motion-kit/src/assets/${manifest.kind}/${manifest.id}`,
    previewStorageKey: previewStorageKey(manifest.id),
    manifestHash: createHash("sha256").update(JSON.stringify(manifest)).digest("hex"),
  });
}

/**
 * Bước tài sản của job storyboard (ADR-017 mục 2): ghi yêu cầu của cả hai phương án, giải quyết yêu cầu còn
 * `open` (dùng lại hoặc tạo mới), rồi trả phép thay tài sản theo phương án. Không ném lỗi cho lỗi tạo tài sản.
 */
export async function prepareStoryboardAssets(
  db: StudioDb,
  args: {
    runId: string;
    agentRunId: string;
    scriptArtifactId: string;
    topic: string;
    variants: readonly ScriptV2[];
    kitSrc: string;
    resolveAssets?: ResolveAssets;
  },
): Promise<PreparedAssets> {
  for (const [vi, variant] of args.variants.entries()) {
    await insertMotionAssetRequests(
      db,
      {
        workflowRunId: args.runId,
        scriptArtifactId: args.scriptArtifactId,
        variantIndex: (vi + 1) as 1 | 2,
      },
      (variant.assetRequests ?? []).map((r) => ({
        sceneId: joinSceneIds(r.sceneIds),
        requestKey: r.id,
        kind: r.kind as MotionAssetKind,
        description: r.description,
        fallbackAssetId: r.fallbackAssetId,
      })),
    );
  }
  const errors: PreparedAssets["errors"] = [];
  let changed = false;
  const rows = await listMotionAssetRequestsForScript(db, args.scriptArtifactId);
  const open = rows.filter((r) => r.status === "open");
  if (open.length > 0 && args.resolveAssets !== undefined) {
    const outcomes = await args.resolveAssets({
      topic: args.topic,
      runId: args.runId,
      agentRunId: args.agentRunId,
      scriptArtifactId: args.scriptArtifactId,
      requests: open.map((r) => {
        // ADR-030: cờ ảnh thật và từ khóa tìm nằm trong kịch bản, không lưu ở bảng yêu cầu.
        const fromScript = args.variants[r.variantIndex - 1]?.assetRequests?.find(
          (q) => q.id === r.requestKey,
        );
        return {
          variantIndex: r.variantIndex as 1 | 2,
          requestId: r.requestKey,
          kind: r.kind,
          description: r.description,
          sceneIds: splitSceneIds(r.sceneId),
          fallbackAssetId: r.fallbackAssetId,
          ...(fromScript?.real === true ? { real: true } : {}),
          ...(fromScript?.searchQuery === undefined ? {} : { searchQuery: fromScript.searchQuery }),
          ...(fromScript?.person === true ? { person: true } : {}),
        };
      }),
    });
    for (const outcome of outcomes) {
      const row = open.find(
        (r) => r.variantIndex === outcome.variantIndex && r.requestKey === outcome.requestId,
      );
      if (row === undefined) {
        continue;
      }
      if (outcome.status === "fulfilled" && outcome.assetId !== null) {
        await syncAssetRow(db, args.kitSrc, outcome.kind, outcome.assetId);
        await fulfillMotionAssetRequestWithAsset(db, row.id, outcome.assetId);
        changed ||= !outcome.reused;
      } else if (outcome.error !== null) {
        errors.push({
          variantIndex: outcome.variantIndex,
          message: `tài sản ${outcome.requestId} (${outcome.kind}): ${outcome.error}; cảnh dùng ${outcome.fallbackAssetId}`,
        });
      }
    }
  }
  const after = await listMotionAssetRequestsForScript(db, args.scriptArtifactId);
  const substitutions = new Map<1 | 2, AssetSubstitution[]>();
  for (const r of after) {
    if (r.status !== "fulfilled" || r.fulfilledAssetId === null) {
      continue;
    }
    const v = r.variantIndex as 1 | 2;
    substitutions.set(v, [
      ...(substitutions.get(v) ?? []),
      {
        sceneIds: splitSceneIds(r.sceneId),
        fallbackAssetId: r.fallbackAssetId,
        assetId: r.fulfilledAssetId,
        requestId: r.requestKey,
      },
    ]);
  }
  return { substitutions, changed, errors };
}

/**
 * Sau Cổng 1 (ADR-017 mục 3): route approval đã đổi `motion_assets` sang `approved` trong DB; worker ghi lại
 * trạng thái đó vào `asset.json` để prompt các run sau thấy tài sản. Trả id đã cập nhật.
 */
export async function syncApprovedManifests(
  db: StudioDb,
  kitSrc: string,
  target: { scriptArtifactId: string; variantIndex: 1 | 2 },
): Promise<string[]> {
  const requests = (await listMotionAssetRequestsForScript(db, target.scriptArtifactId)).filter(
    (r) => r.variantIndex === target.variantIndex && r.fulfilledAssetId !== null,
  );
  if (requests.length === 0) {
    return [];
  }
  const approved = new Set(
    (await listMotionAssets(db, { status: "approved" })).map((row) => row.assetId),
  );
  const updated: string[] = [];
  for (const r of requests) {
    const id = r.fulfilledAssetId as string;
    const manifest = readManifest(kitSrc, r.kind, id);
    if (manifest !== null && manifest.status === "candidate" && approved.has(id)) {
      writeManifest(kitSrc, { ...manifest, status: "approved" });
      updated.push(id);
    }
  }
  return updated;
}

/**
 * Đồng bộ mọi `asset.json` trong kho vào `motion_assets` (ADR-016 "script đồng bộ"); worker gọi khi khởi động.
 * Màn "Kho hình động" đọc bảng này. Trả số hàng đổi.
 */
export async function syncAllAssetRows(
  db: StudioDb,
  kitSrc: string,
  dataDir?: string,
): Promise<number> {
  let changed = 0;
  for (const manifest of listManifests(kitSrc)) {
    // Có file ảnh (tài sản tự tạo, hoặc `pnpm previews` đã vẽ) thì web hiện ảnh.
    const hasPreview =
      dataDir === undefined
        ? manifest.requestKey !== null
        : existsSync(join(dataDir, previewStorageKey(manifest.id)));
    const result = await upsertMotionAssetFromManifest(db, {
      assetId: manifest.id,
      kind: manifest.kind as MotionAssetKind,
      version: manifest.version,
      tags: manifest.tags,
      brandProfileId: null,
      createdBy: manifest.createdBy,
      status: manifest.status,
      sourcePath: `packages/motion-kit/src/assets/${manifest.kind}/${manifest.id}`,
      previewStorageKey: hasPreview ? previewStorageKey(manifest.id) : null,
      // Ảnh xem trước đổi cũng phải ghi lại hàng, nên băm cả manifest lẫn trạng thái ảnh.
      manifestHash: createHash("sha256")
        .update(JSON.stringify({ manifest, hasPreview }))
        .digest("hex"),
    });
    changed += result.changed ? 1 : 0;
  }
  return changed;
}
