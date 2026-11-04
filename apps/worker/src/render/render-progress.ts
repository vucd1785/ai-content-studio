import { recordJobProgress, type StudioDb } from "@studio/db";
import type { RenderFrameProgress } from "./render-backend.js";

/** Ghi mỗi khi qua thêm 5% số frame, để không ghi event cho từng frame. */
const STEP_FRACTION = 0.05;

/**
 * Callback `onProgress` của render và export (P3-17): ghi frame đã render thật thành `job.progress`
 * (`unit: "frame"`). Callback của Remotion là đồng bộ nên ghi chạy nền, nối tiếp nhau; lỗi ghi chỉ log.
 */
export function renderProgressRecorder(
  db: StudioDb,
  jobId: string,
): (progress: RenderFrameProgress) => void {
  let lastWritten = -1;
  let queue: Promise<unknown> = Promise.resolve();
  return ({ renderedFrames, totalFrames }) => {
    if (totalFrames <= 0) {
      return;
    }
    const done = Math.min(renderedFrames, totalFrames);
    const step = Math.max(1, Math.floor(totalFrames * STEP_FRACTION));
    if (done !== totalFrames && lastWritten >= 0 && done - lastWritten < step) {
      return;
    }
    if (done === lastWritten) {
      return;
    }
    lastWritten = done;
    queue = queue
      .then(() => recordJobProgress(db, jobId, { done, total: totalFrames, unit: "frame" }))
      .catch((error: unknown) => {
        console.error(
          `render: không ghi được tiến độ: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
  };
}
