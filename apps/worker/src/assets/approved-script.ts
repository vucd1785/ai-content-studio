import { join } from "node:path";
import {
  type FormatPack,
  getFormatPack,
  type ScriptV2,
  scriptV2ArtifactSchema,
} from "@studio/contracts";
import {
  type AssetRole,
  approvalIdFromAssetJobKey,
  assetJobKeyAfterScriptApproval,
  findRunApproval,
  getArtifactById,
  type JobContext,
  listMotionAssetRequestsForScript,
  loadRunBrandProfile,
  redoIdFromJobKey,
  redoJobKey,
  renderJobKeyAfterAssets,
  type StudioDb,
} from "@studio/db";
import type { z } from "zod/v4";
import { resolveRepoRoot } from "../cli/paths.js";
import { readJsonArtifact } from "../jobs/job-support.js";
import { loadApprovedAssetCatalog } from "../llm/asset-catalog.js";
import { syncApprovedManifests } from "./generate/storyboard-assets.js";
import { applyAssetSubstitutions, splitSceneIds } from "./generate/substitute.js";

/** Kênh của run như `loadRunBrandProfile` trả về. */
export type RunBrand = NonNullable<Awaited<ReturnType<typeof loadRunBrandProfile>>>;

/**
 * Phương án script `2` đã duyệt mà job visual/voice làm việc trên đó (P3-05, P6-17). Approval id lấy từ key
 * của job; artifact script và `variantIndex` lấy từ approval đó (quyết định 6), không đoán phương án.
 */
export type ApprovedScript = {
  approvalId: string;
  scriptArtifactId: string;
  variantIndex: 1 | 2;
  script: ScriptV2;
  format: FormatPack;
  brand: RunBrand;
};

/**
 * Đọc một phương án script `2` đã lưu và kiểm lại bằng contracts với kênh, gói, kho tài sản hiện tại.
 * `null` nếu không đọc được hoặc không còn hợp lệ (ví dụ tài sản bị bỏ khỏi kho).
 */
export async function loadScriptV2Variant(
  db: StudioDb,
  dataDir: string,
  runId: string,
  row: { id: string; storageKey: string; metadata: unknown },
  variantIndex: 1 | 2,
): Promise<{ script: ScriptV2; format: FormatPack; brand: RunBrand } | null> {
  const meta = (row.metadata ?? {}) as {
    formatId?: unknown;
    formatVersion?: unknown;
    creativeMode?: unknown;
  };
  const format = getFormatPack(String(meta.formatId), Number(meta.formatVersion));
  const brand = await loadRunBrandProfile(db, runId);
  if (format === undefined || brand === null) {
    return null;
  }
  const schema = scriptV2ArtifactSchema({
    cast: brand.characters.map((c) => ({ characterKey: c.characterKey, speaks: c.speaks })),
    assetCatalog: loadApprovedAssetCatalog(brand.slug).map((a) => ({ id: a.id, kind: a.kind })),
    format,
    mode: meta.creativeMode === "creative" ? "creative" : "standard",
  });
  const content = await readJsonArtifact(
    dataDir,
    row.storageKey,
    schema as z.ZodType<{ variants: ScriptV2[] }>,
  );
  const saved = content?.variants[variantIndex - 1];
  if (saved === undefined) {
    return null;
  }
  // ADR-016/017: cảnh có yêu cầu tài sản đã đóng dùng tài sản mới thay cho tài sản thay thế.
  const fulfilled = (await listMotionAssetRequestsForScript(db, row.id)).filter(
    (r) => r.variantIndex === variantIndex && r.status === "fulfilled" && r.fulfilledAssetId,
  );
  const script = applyAssetSubstitutions(
    saved,
    fulfilled.map((r) => ({
      sceneIds: splitSceneIds(r.sceneId),
      fallbackAssetId: r.fallbackAssetId,
      assetId: r.fulfilledAssetId as string,
      requestId: r.requestKey,
    })),
  );
  return { script, format, brand };
}

export type ApprovedScriptResult =
  | { ok: true; value: ApprovedScript }
  | { ok: false; errorCode: string };

export async function loadApprovedScript(
  db: StudioDb,
  context: JobContext,
  dataDir: string,
): Promise<ApprovedScriptResult> {
  const approvalId = approvalIdFromAssetJobKey(context.job.idempotencyKey);
  const approval =
    approvalId === null ? null : await findRunApproval(db, context.workflowRun.id, approvalId);
  if (
    approvalId === null ||
    approval === null ||
    approval.gate !== "script" ||
    approval.decision !== "approved" ||
    (approval.variantIndex !== 1 && approval.variantIndex !== 2)
  ) {
    return { ok: false, errorCode: "approval_missing" };
  }
  const row = await getArtifactById(db, approval.artifactId);
  // Chỉ còn script `2` (ADR-013 bổ sung (2)); artifact khác coi như không đọc được.
  const v2 =
    row === null || row.schemaVersion !== "2"
      ? null
      : await loadScriptV2Variant(db, dataDir, context.workflowRun.id, row, approval.variantIndex);
  if (row === null || v2 === null) {
    return { ok: false, errorCode: "script_missing" };
  }
  // ADR-017 mục 3: tài sản được duyệt cùng phương án ở Cổng 1 ghi lại `approved` vào asset.json.
  const synced = await syncApprovedManifests(
    db,
    join(resolveRepoRoot(import.meta.url), "packages", "motion-kit", "src"),
    { scriptArtifactId: row.id, variantIndex: approval.variantIndex },
  );
  if (synced.length > 0) {
    console.log(`tài sản đã duyệt cùng kịch bản: ${synced.join(", ")}`);
  }
  return {
    ok: true,
    value: {
      approvalId,
      scriptArtifactId: row.id,
      variantIndex: approval.variantIndex,
      ...v2,
    },
  };
}

/** Rào phụ thuộc: render chỉ được tạo khi visual và voice của cùng approval đều xong. */
export function renderBarrier(workflowRunId: string, approvalId: string, jobKey?: string) {
  // Đọc lại một cảnh (ADR-021): chỉ có job voice; xong là tạo job render cùng `redoId`.
  const redoId = jobKey === undefined ? null : redoIdFromJobKey(jobKey);
  if (jobKey !== undefined && redoId !== null) {
    return {
      requiredJobKeys: [jobKey],
      nextJob: {
        role: "video" as const,
        queue: "render" as const,
        idempotencyKey: redoJobKey("render", workflowRunId, approvalId, redoId),
      },
    };
  }
  const roles: AssetRole[] = ["visual", "voice"];
  return {
    requiredJobKeys: roles.map((role) =>
      assetJobKeyAfterScriptApproval(role, workflowRunId, approvalId),
    ),
    nextJob: {
      role: "video" as const,
      queue: "render" as const,
      idempotencyKey: renderJobKeyAfterAssets(workflowRunId, approvalId),
    },
  };
}

const RENDER_KEY_PATTERN =
  /^render:[0-9a-f-]{36}:approval:([0-9a-f-]{36})(?::redo:[0-9a-f-]{36})?$/;

/** Approval id trong key job render (`renderJobKeyAfterAssets`). */
export function approvalIdFromRenderJobKey(idempotencyKey: string): string | null {
  return RENDER_KEY_PATTERN.exec(idempotencyKey)?.[1] ?? null;
}
