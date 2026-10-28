/** Local H.264 render profile for Remotion `renderMedia()`. */
export const RENDER_CODEC = "h264" as const;

/** Faster preview; higher CRF number = lower quality / smaller file. */
export const PREVIEW_CRF = 28;

/** Final export; lower CRF than preview per docs/05-VIDEO-PIPELINE.md. */
export const EXPORT_CRF = 18;

export type RenderPurpose = "preview" | "export";

export function crfForPurpose(purpose: RenderPurpose): number {
  return purpose === "preview" ? PREVIEW_CRF : EXPORT_CRF;
}
