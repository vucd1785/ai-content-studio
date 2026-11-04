import type { StudioDb } from "@studio/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

const recorded: Array<{ jobId: string; payload: Record<string, unknown> }> = [];

vi.mock("@studio/db", () => ({
  recordJobProgress: async (_db: unknown, jobId: string, payload: Record<string, unknown>) => {
    recorded.push({ jobId, payload });
    return true;
  },
}));

const { renderProgressRecorder } = await import("./render-progress.js");

/** Chờ hàng ghi nền của recorder chạy hết (toàn microtask, nên một macrotask là đủ). */
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("renderProgressRecorder (P3-17)", () => {
  beforeEach(() => {
    recorded.length = 0;
  });

  it("ghi frame thật theo bước 5%, đủ frame cuối, không ghi trùng", async () => {
    const onProgress = renderProgressRecorder({} as StudioDb, "job-1");
    for (let frame = 0; frame <= 200; frame++) {
      onProgress({ renderedFrames: frame, totalFrames: 200 });
    }
    onProgress({ renderedFrames: 200, totalFrames: 200 });
    await flush();
    const done = recorded.map((row) => row.payload.done);
    expect(done).toEqual(Array.from({ length: 21 }, (_, i) => i * 10));
    expect(recorded.every((row) => row.jobId === "job-1")).toBe(true);
    expect(recorded.at(-1)?.payload).toEqual({ done: 200, total: 200, unit: "frame" });
  });

  it("bỏ qua khi chưa biết tổng frame; frame vượt tổng bị chặn về tổng", async () => {
    const onProgress = renderProgressRecorder({} as StudioDb, "job-2");
    onProgress({ renderedFrames: 5, totalFrames: 0 });
    onProgress({ renderedFrames: 120, totalFrames: 100 });
    await flush();
    expect(recorded.map((row) => row.payload)).toEqual([{ done: 100, total: 100, unit: "frame" }]);
  });
});
