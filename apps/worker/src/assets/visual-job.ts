import type { StudioDb } from "@studio/db";
import { type AssetJobResult, runAssetJob } from "./asset-job.js";

/**
 * Job visual (P3-05, P6-17). Script `2` dựng hình từ shot list ở bước render, ảnh storyboard đã có từ bước
 * `storyboarding`, nên job không tạo artifact. Job vẫn chạy để rào phụ thuộc visual + voice tạo đúng một job
 * render (P3-05); đọc phương án đã duyệt để phát hiện sớm script không còn hợp lệ.
 */
export function runVisualJob(
  db: StudioDb,
  jobId: string,
  deps: { dataDir: string },
): Promise<AssetJobResult> {
  return runAssetJob(db, jobId, "visual", deps.dataDir, async () => ({ ok: true, artifacts: [] }));
}
