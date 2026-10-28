import { describe, expect, it } from "vitest";
import { MVP_VIDEO_FPS, SCENE_EDGE_PAD_MS } from "./constants.js";
import {
  computeSceneTimingPlan,
  msToFrames,
  SceneTimingError,
  sceneDurationMsFromMeasured,
} from "./scene-duration.js";

describe("sceneDurationMsFromMeasured", () => {
  it("cộng 200 ms mỗi đầu so với duration ffprobe giả lập", () => {
    expect(sceneDurationMsFromMeasured(44000)).toBe(44000 + 2 * SCENE_EDGE_PAD_MS);
    expect(sceneDurationMsFromMeasured(10560)).toBe(10560 + 2 * SCENE_EDGE_PAD_MS);
  });

  it("từ chối duration âm hoặc không hữu hạn", () => {
    expect(() => sceneDurationMsFromMeasured(-1)).toThrow(SceneTimingError);
    expect(() => sceneDurationMsFromMeasured(Number.NaN)).toThrow(SceneTimingError);
    expect(() => sceneDurationMsFromMeasured(Number.POSITIVE_INFINITY)).toThrow(SceneTimingError);
  });
});

describe("msToFrames", () => {
  it("đổi ms sang frame 30 fps (làm tròn gần nhất)", () => {
    expect(msToFrames(1000, MVP_VIDEO_FPS)).toBe(30);
    expect(msToFrames(44800, MVP_VIDEO_FPS)).toBe(1344);
  });

  it("từ chối fps không hợp lệ", () => {
    expect(() => msToFrames(1000, 0)).toThrow(SceneTimingError);
  });
});

describe("computeSceneTimingPlan", () => {
  it("tính fromMs và tổng duration từ ffprobe giả lập, không dùng số từ", () => {
    const measured = [
      { sceneId: "intro-title", measuredDurationMs: 8000 },
      { sceneId: "explain-1", measuredDurationMs: 12000 },
      { sceneId: "cta", measuredDurationMs: 5000 },
    ];

    const plan = computeSceneTimingPlan(measured);

    expect(plan.fps).toBe(MVP_VIDEO_FPS);
    expect(plan.scenes).toHaveLength(3);

    const durations = plan.scenes.map((s) => s.durationMs);
    expect(durations[0]).toBe(8000 + 2 * SCENE_EDGE_PAD_MS);
    expect(durations[1]).toBe(12000 + 2 * SCENE_EDGE_PAD_MS);
    expect(durations[2]).toBe(5000 + 2 * SCENE_EDGE_PAD_MS);

    expect(plan.scenes[0]?.fromMs).toBe(0);
    expect(plan.scenes[1]?.fromMs).toBe(durations[0]);
    expect(plan.scenes[2]?.fromMs).toBe(durations[0] + durations[1]);

    expect(plan.totalDurationMs).toBe(durations[0] + durations[1] + durations[2]);

    const sumFrames = plan.scenes.reduce((acc, s) => acc + s.durationInFrames, 0);
    expect(plan.totalDurationInFrames).toBe(sumFrames);
    expect(plan.totalDurationInFrames).toBe(
      plan.scenes.reduce((acc, s) => acc + msToFrames(s.durationMs), 0),
    );
  });

  it("cùng measured duration cho narration khác độ dài vẫn cho cùng frame", () => {
    const shortWords = computeSceneTimingPlan([{ sceneId: "a", measuredDurationMs: 10000 }]);
    const longWords = computeSceneTimingPlan([{ sceneId: "a", measuredDurationMs: 10000 }]);
    expect(shortWords.totalDurationInFrames).toBe(longWords.totalDurationInFrames);
    expect(shortWords.totalDurationMs).toBe(longWords.totalDurationMs);
  });

  it("kết quả xác định với input giống nhau", () => {
    const input = [{ sceneId: "s1", measuredDurationMs: 3333 }];
    expect(computeSceneTimingPlan(input)).toEqual(computeSceneTimingPlan(input));
  });

  it("từ chối mảng rỗng và sceneId trùng", () => {
    expect(() => computeSceneTimingPlan([])).toThrow(SceneTimingError);
    expect(() =>
      computeSceneTimingPlan([
        { sceneId: "dup", measuredDurationMs: 1000 },
        { sceneId: "dup", measuredDurationMs: 2000 },
      ]),
    ).toThrow(SceneTimingError);
  });

  it("mô phỏng mẫu cổng P0-04 (44000 ms ffprobe)", () => {
    const plan = computeSceneTimingPlan([{ sceneId: "gate-sample", measuredDurationMs: 44000 }]);
    expect(plan.totalDurationMs).toBe(44400);
    expect(plan.totalDurationInFrames).toBe(msToFrames(44400));
    expect(plan.scenes[0]?.durationInFrames).toBe(1332);
  });
});
