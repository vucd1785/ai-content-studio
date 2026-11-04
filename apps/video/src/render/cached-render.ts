import { join } from "node:path";
import type { RenderPurpose } from "./config";

/**
 * Đường dẫn MP4 trong cache render theo template, version và hash nội dung (P1-04). `StickStory` dùng chung;
 * template `EduVertical` đã xóa (ADR-013 bổ sung (2) 2026-11-03).
 */
export function resolveCachedMp4Path(
  cacheRoot: string,
  params: {
    templateId: string;
    templateVersion: string;
    purpose: RenderPurpose;
    contentHash: string;
  },
): string {
  const fileName = `${params.purpose}-${params.templateVersion}-${params.contentHash}.mp4`;
  return join(cacheRoot, params.templateId, fileName);
}
