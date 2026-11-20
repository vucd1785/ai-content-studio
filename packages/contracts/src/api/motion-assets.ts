import { z } from "zod/v4";

/** Tài sản hình động trong kho (bản sao `motion_assets`, ADR-016/017). */
export const motionAssetSchema = z.object({
  assetId: z.string(),
  kind: z.string(),
  version: z.string(),
  tags: z.array(z.string()),
  createdBy: z.enum(["director", "claude-code"]),
  status: z.enum(["candidate", "approved"]),
  /** Có ảnh xem trước dưới `DATA_DIR` thì web đọc qua `/api/motion-assets/:assetId/preview`. */
  hasPreview: z.boolean(),
});

export type MotionAsset = z.infer<typeof motionAssetSchema>;

export const motionAssetListResponseSchema = z.object({
  assets: z.array(motionAssetSchema),
});

/** Một yêu cầu tài sản của kịch bản `creative` kèm tài sản đã đáp ứng (Cổng 1, ADR-017 mục 3). */
export const runAssetRequestSchema = z.object({
  id: z.string().uuid(),
  scriptArtifactId: z.string().uuid(),
  variantIndex: z.number().int().min(1).max(2),
  requestKey: z.string(),
  kind: z.string(),
  description: z.string(),
  sceneIds: z.array(z.string()),
  fallbackAssetId: z.string(),
  status: z.enum(["open", "fulfilled", "dismissed"]),
  asset: motionAssetSchema.nullable(),
});

export type RunAssetRequest = z.infer<typeof runAssetRequestSchema>;

export const runAssetRequestListResponseSchema = z.object({
  requests: z.array(runAssetRequestSchema),
});

export const motionAssetIdParamsSchema = z.object({
  assetId: z.string().regex(/^[a-z0-9_]{1,64}$/),
});

export const motionAssetListQuerySchema = z.object({
  kind: z
    .string()
    .regex(/^[a-z_]{1,32}$/)
    .optional(),
  status: z.enum(["candidate", "approved"]).optional(),
});

/** Video (run) có dùng tài sản, theo `render_props` mới nhất của run (ADR-021). */
export const motionAssetUsageSchema = z.object({
  projectId: z.string().uuid(),
  projectName: z.string(),
  workflowRunId: z.string().uuid(),
  /** Run đã xuất video. */
  exported: z.boolean(),
});

/** `GET /api/motion-assets/usage`: id tài sản → các video dùng nó. Tài sản không có khóa là chưa dùng. */
export const motionAssetUsageResponseSchema = z.object({
  videos: z.array(motionAssetUsageSchema),
  usage: z.record(z.string(), z.array(z.number().int().nonnegative())),
});

export type MotionAssetUsageResponse = z.infer<typeof motionAssetUsageResponseSchema>;

/** Mọi id tài sản xuất hiện trong render props `StickStory`: nền, máy quay, đồ vật, minh họa, nhân vật. */
export function assetIdsInRenderProps(props: unknown): Set<string> {
  const ids = new Set<string>();
  const shots = (props as { shots?: unknown } | null)?.shots;
  if (!Array.isArray(shots)) {
    return ids;
  }
  const add = (value: unknown) => {
    if (typeof value === "string" && value !== "") {
      ids.add(value);
    }
  };
  for (const shot of shots as Record<string, unknown>[]) {
    add(shot.background);
    add(shot.camera);
    for (const prop of Array.isArray(shot.props) ? shot.props : []) add(prop);
    const items = (shot.illustration as { items?: unknown } | undefined)?.items;
    for (const item of Array.isArray(items) ? items : []) add(item);
    for (const actor of Array.isArray(shot.actors)
      ? (shot.actors as Record<string, unknown>[])
      : []) {
      add(actor.skin);
      add(actor.action);
      add(actor.expression);
    }
  }
  return ids;
}
