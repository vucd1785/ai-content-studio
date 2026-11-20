import { describe, expect, it } from "vitest";
import {
  buildRunSteps,
  estimateStepSeconds,
  formatDurationRange,
  MACHINE_SPEED,
  remainingUntilNextGate,
  totalMachineEstimate,
} from "./run-steps";

const NOW = Date.parse("2026-10-31T15:10:00Z");
const states = (steps: ReturnType<typeof buildRunSteps>) =>
  steps.map((step) => `${step.id}:${step.state}`);

describe("bước và ước tính lượt chạy (P2-11)", () => {
  it("ước tính lấy từ tốc độ đo của máy; giọng đọc là bước lâu nhất; cổng Director không có ước tính", () => {
    const estimate = estimateStepSeconds(30);
    // 30 s × (TTS 9 + alignment 1,2) + 5 cảnh × 10 s.
    expect(estimate.assets).toEqual([356, 712]);
    expect(estimate.scriptGate).toBeNull();
    expect(estimate.finalGate).toBeNull();
    expect(MACHINE_SPEED.ttsRealTimeFactor).toBe(9);
    const total = totalMachineEstimate(30);
    expect(total[0]).toBeGreaterThan(estimate.assets?.[0] ?? 0);
    expect(formatDurationRange(total)).toMatch(/^\d+–\d+ phút$/);
  });

  it("chưa có run: mọi bước chưa tới, không có thời gian còn lại", () => {
    const steps = buildRunSteps({
      status: null,
      resumeFrom: null,
      durationSec: 30,
      agentRuns: [],
      now: NOW,
    });
    expect(steps.every((step) => step.state === "todo")).toBe(true);
    // Chưa bắt đầu: máy sẽ chạy nghiên cứu + viết kịch bản rồi dừng ở cổng duyệt kịch bản.
    const { research, script } = estimateStepSeconds(30);
    expect(remainingUntilNextGate(steps)).toEqual([
      (research?.[0] ?? 0) + (script?.[0] ?? 0),
      (research?.[1] ?? 0) + (script?.[1] ?? 0),
    ]);
  });

  it("đang dựng giọng: bước trước xong, bước này hiện thời gian đã chạy thật, còn lại trừ phần đã chạy", () => {
    const steps = buildRunSteps({
      status: "producing_assets",
      resumeFrom: null,
      durationSec: 30,
      agentRuns: [
        { role: "visual", status: "completed", startedAt: "2026-10-31T15:00:00Z" },
        { role: "voice", status: "running", startedAt: "2026-10-31T15:05:00Z" },
      ],
      now: NOW,
    });
    expect(states(steps)).toEqual([
      "research:done",
      "script:done",
      "scriptGate:done",
      "assets:active",
      "render:todo",
      "finalGate:todo",
      "export:todo",
    ]);
    expect(steps[3]?.elapsedSec).toBe(300);
    const [assetsLow] = estimateStepSeconds(30).assets ?? [0, 0];
    const [renderLow] = estimateStepSeconds(30).render ?? [0, 0];
    expect(remainingUntilNextGate(steps)?.[0]).toBe(assetsLow - 300 + renderLow);
  });

  it("chờ duyệt kịch bản: bước cổng là 'chờ bạn', không ước tính thời gian còn lại", () => {
    const steps = buildRunSteps({
      status: "waiting_script_approval",
      resumeFrom: null,
      durationSec: 30,
      agentRuns: [],
      now: NOW,
    });
    expect(steps[2]?.state).toBe("waiting_you");
    expect(remainingUntilNextGate(steps)).toBeNull();
  });

  it("lỗi ở render: đánh dấu đúng bước theo resume_from; hủy thì dừng; xuất xong thì mọi bước xong", () => {
    const failed = buildRunSteps({
      status: "failed",
      resumeFrom: "preview_rendering",
      durationSec: 30,
      agentRuns: [],
      now: NOW,
    });
    expect(failed[4]?.state).toBe("failed");
    expect(failed[3]?.state).toBe("done");
    const cancelled = buildRunSteps({
      status: "cancelled",
      resumeFrom: null,
      durationSec: 30,
      agentRuns: [],
      now: NOW,
    });
    expect(cancelled.some((step) => step.state === "active")).toBe(false);
    const exported = buildRunSteps({
      status: "exported",
      resumeFrom: null,
      durationSec: 30,
      agentRuns: [],
      now: NOW,
    });
    expect(exported.every((step) => step.state === "done")).toBe(true);
  });

  it("định dạng: dưới một phút ghi giây, còn lại ghi khoảng phút", () => {
    expect(formatDurationRange([15, 22])).toBe("~15 giây");
    expect(formatDurationRange([180, 180])).toBe("~3 phút");
    expect(formatDurationRange([356, 712])).toBe("6–12 phút");
  });
});

describe("tiến độ thật và lỗi chi tiết (P3-17)", () => {
  const base = { durationSec: 30, resumeFrom: null, now: NOW };

  it("giọng đọc: phần trăm từ số bước cảnh đã xong; chỉ ra cảnh và pha đang làm", () => {
    const steps = buildRunSteps({
      ...base,
      status: "producing_assets",
      agentRuns: [
        { role: "visual", status: "completed", startedAt: "2026-10-31T15:00:00Z" },
        {
          role: "voice",
          status: "running",
          startedAt: "2026-10-31T15:05:00Z",
          progress: {
            done: 3,
            total: 10,
            unit: "scene_step",
            sceneIndex: 2,
            sceneCount: 5,
            phase: "align",
          },
        },
      ],
    });
    const assets = steps.find((step) => step.id === "assets");
    // Cảnh và pha lấy từ worker, không suy từ `done` (2026-11-11).
    expect(assets?.progress).toEqual({
      percent: 30,
      done: 3,
      total: 10,
      unit: "scene_step",
      sceneIndex: 2,
      sceneCount: 5,
      lineIndex: null,
      lineCount: null,
      phase: "align",
    });
  });

  it("render: phần trăm theo frame; agent không chạy thì không có tiến độ", () => {
    const running = buildRunSteps({
      ...base,
      status: "preview_rendering",
      agentRuns: [
        {
          role: "video",
          status: "running",
          startedAt: "2026-10-31T15:05:00Z",
          progress: { done: 450, total: 900, unit: "frame" },
        },
      ],
    });
    expect(running.find((step) => step.id === "render")?.progress?.percent).toBe(50);
    const idle = buildRunSteps({
      ...base,
      status: "preview_rendering",
      agentRuns: [
        {
          role: "video",
          status: "completed",
          startedAt: "2026-10-31T15:05:00Z",
          progress: { done: 450, total: 900, unit: "frame" },
        },
      ],
    });
    expect(idle.find((step) => step.id === "render")?.progress).toBeNull();
  });

  it("bước lỗi mang mã và chi tiết của agent lỗi; không có agent lỗi thì lấy của run", () => {
    const steps = buildRunSteps({
      ...base,
      status: "failed",
      resumeFrom: "producing_assets",
      agentRuns: [
        {
          role: "voice",
          status: "failed",
          startedAt: "2026-10-31T15:05:00Z",
          errorCode: "alignment_failed",
          errorMessage: "Scene s1: TTS align lỗi 503: ALIGNMENT_FAILED: name resolution",
        },
      ],
    });
    expect(steps.find((step) => step.id === "assets")?.error).toEqual({
      role: "voice",
      code: "alignment_failed",
      message: "Scene s1: TTS align lỗi 503: ALIGNMENT_FAILED: name resolution",
    });
    const fromRun = buildRunSteps({
      ...base,
      status: "failed",
      resumeFrom: "preview_rendering",
      agentRuns: [],
      failureCode: "render_failed",
      failureMessage: "ffmpeg exited 1",
    });
    expect(fromRun.find((step) => step.id === "render")?.error).toEqual({
      role: null,
      code: "render_failed",
      message: "ffmpeg exited 1",
    });
    expect(fromRun.filter((step) => step.error !== null)).toHaveLength(1);
  });
});
