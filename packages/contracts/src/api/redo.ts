import { z } from "zod/v4";
import type { RedoTarget } from "../workflow/state-machine.js";

/**
 * Làm lại một phần ở Cổng 2 (ADR-021): Director sửa đúng một chỗ của bản preview, không viết lại kịch bản.
 * - `revoice`: đọc lại mọi câu của một cảnh (TTS lấy mẫu lại, bỏ cache của các câu đó);
 * - `background`: đổi bối cảnh của một cảnh sang tài sản `background` có trong kho;
 * - `regenerate_asset`: Claude Code tạo lại một hình (`prop`, `background`) theo ghi chú, thay trong cả video;
 * - `rerender`: dựng lại props từ dữ liệu hiện tại (ví dụ sau khi đặt tên kênh) mà không đổi gì khác.
 * Route không ghi approval; video mới lại qua QA rồi về Cổng 2.
 */
const sceneIdSchema = z.string().regex(/^[a-z0-9-]{1,40}$/);
const assetIdSchema = z.string().regex(/^[a-z0-9_]{1,64}$/);

export const redoBodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("revoice"), sceneId: sceneIdSchema }).strict(),
  z
    .object({ kind: z.literal("background"), sceneId: sceneIdSchema, backgroundId: assetIdSchema })
    .strict(),
  z
    .object({
      kind: z.literal("regenerate_asset"),
      assetId: assetIdSchema,
      note: z.string().trim().min(1).max(500),
    })
    .strict(),
  z.object({ kind: z.literal("rerender") }).strict(),
]);
export type RedoBody = z.infer<typeof redoBodySchema>;
export type RedoKind = RedoBody["kind"];

/** Loại tài sản Claude Code tạo lại được ở Cổng 2 (hình tĩnh; hành động, tư thế cần duyệt rig ở Cổng 1). */
export const REDO_REGENERATABLE_KINDS = ["prop", "background"] as const;

/** Trạng thái run sau khi nhận yêu cầu: chỉ đọc lại cần job voice. */
export function redoTarget(kind: RedoKind): RedoTarget {
  return kind === "revoice" ? "producing_assets" : "preview_rendering";
}

/** File yêu cầu ghi ở `artifacts/<run>/redo/<redoId>.json` (worker đọc theo `redoId` trong key job). */
export const redoRequestFileSchema = z
  .object({
    redoId: z.uuid(),
    createdAt: z.string(),
    request: redoBodySchema,
  })
  .strict();
export type RedoRequestFile = z.infer<typeof redoRequestFileSchema>;

/** Kết quả tạo lại hình, ghi cạnh file yêu cầu (`<redoId>.result.json`) để render lại không gọi Claude lần nữa. */
export const redoResultFileSchema = z
  .object({
    redoId: z.uuid(),
    oldAssetId: assetIdSchema,
    newAssetId: assetIdSchema.nullable(),
    error: z.string().nullable(),
  })
  .strict();
export type RedoResultFile = z.infer<typeof redoResultFileSchema>;

export const redoStorageKey = (workflowRunId: string, redoId: string) =>
  `artifacts/${workflowRunId}/redo/${redoId}.json`;
export const redoResultStorageKey = (workflowRunId: string, redoId: string) =>
  `artifacts/${workflowRunId}/redo/${redoId}.result.json`;

export const redoResponseSchema = z
  .object({
    redoId: z.uuid(),
    status: z.enum(["producing_assets", "preview_rendering"]),
  })
  .strict();
export type RedoResponse = z.infer<typeof redoResponseSchema>;
