import { vi } from "@/i18n/vi";

/**
 * Cách hiện trạng thái run trên trang dự án và danh sách (P2-11, 06 mục Nguyên tắc): việc chờ Director màu vàng,
 * máy đang chạy màu nhấn, xong màu xanh lá, lỗi màu đỏ.
 */
export type RunTone = "waiting" | "working" | "done" | "failed" | "idle";

const WAITING = new Set(["waiting_script_approval", "waiting_final_approval"]);
const WORKING = new Set([
  "idea_submitted",
  "researching",
  "research_ready",
  "scripting",
  "storyboarding",
  "producing_assets",
  "preview_rendering",
  "qa",
  "exporting",
]);

/** Máy đang chạy: web đọc lại run và dự án định kỳ để thấy bước kế tiếp mà không cần đổi tab. */
export function isWorkingStatus(status: string | null | undefined): boolean {
  return status !== null && status !== undefined && WORKING.has(status);
}

export function runTone(status: string | null): RunTone {
  if (status === null || status === "cancelled") {
    return "idle";
  }
  if (WAITING.has(status)) {
    return "waiting";
  }
  if (WORKING.has(status)) {
    return "working";
  }
  return status === "exported" ? "done" : status === "failed" ? "failed" : "idle";
}

export function runStatusLabel(status: string | null): string {
  if (status === null) {
    return vi.home.notStarted;
  }
  return (vi.runControl.statuses as Record<string, string>)[status] ?? status;
}

/** Lớp màu chấm và chữ theo tone (Tailwind, token ở index.css). */
export const TONE_DOT: Record<RunTone, string> = {
  waiting: "bg-warning",
  working: "bg-info",
  done: "bg-success",
  failed: "bg-destructive",
  idle: "border border-muted-foreground bg-transparent",
};

export const TONE_TEXT: Record<RunTone, string> = {
  waiting: "text-warning",
  working: "text-info",
  done: "text-success",
  failed: "text-destructive",
  idle: "text-muted-foreground",
};
