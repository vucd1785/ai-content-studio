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
  loadRunBrandProfile,
  renderJobKeyAfterAssets,
  type StudioDb,
} from "@studio/db";
import type { z } from "zod/v4";
import { readJsonArtifact } from "../jobs/job-support.js";
import { loadApprovedAssetCatalog } from "../llm/asset-catalog.js";

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
  row: { storageKey: string; metadata: unknown },
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
  const script = content?.variants[variantIndex - 1];
  return script === undefined ? null : { script, format, brand };
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
export function renderBarrier(workflowRunId: string, approvalId: string) {
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

const RENDER_KEY_PATTERN = /^render:[0-9a-f-]{36}:approval:([0-9a-f-]{36})$/;

/** Approval id trong key job render (`renderJobKeyAfterAssets`). */
export function approvalIdFromRenderJobKey(idempotencyKey: string): string | null {
  return RENDER_KEY_PATTERN.exec(idempotencyKey)?.[1] ?? null;
}
