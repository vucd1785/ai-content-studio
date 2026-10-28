import { MVP_VIDEO_FPS, msToFrames, SCENE_EDGE_PAD_MS } from "@studio/contracts";
import { describe, expect, it } from "vitest";
import {
  buildSceneFramePlan,
  captionsForScene,
  captionToSceneRelativeMs,
  totalDurationInFrames,
} from "./scene-frame-plan";

describe("buildSceneFramePlan", () => {
  it("sceneStartFrame[0] = 0 và cộng dồn durationInFrames từng cảnh", () => {
    const scenes = [
      { sceneId: "a", fromMs: 0, durationMs: 1300 },
      { sceneId: "b", fromMs: 1300, durationMs: 1400 },
      { sceneId: "c", fromMs: 2700, durationMs: 1300 },
    ];
    const plan = buildSceneFramePlan(scenes, MVP_VIDEO_FPS);
    expect(plan[0]?.startFrame).toBe(0);
    expect(plan[1]?.startFrame).toBe(plan[0]?.durationInFrames);
    expect(plan[2]?.startFrame).toBe(
      (plan[0]?.durationInFrames ?? 0) + (plan[1]?.durationInFrames ?? 0),
    );
    expect(totalDurationInFrames(plan)).toBe(
      plan.reduce((sum, scene) => sum + scene.durationInFrames, 0),
    );
  });

  it("làm tròn frame từng cảnh khác msToFrames trên tổng ms", () => {
    const scenes = [
      { sceneId: "x", fromMs: 0, durationMs: 217 },
      { sceneId: "y", fromMs: 217, durationMs: 217 },
    ];
    const plan = buildSceneFramePlan(scenes, MVP_VIDEO_FPS);
    const sumSceneFrames = totalDurationInFrames(plan);
    const totalMs = 434;
    expect(sumSceneFrames).toBe(
      msToFrames(scenes[0]?.durationMs ?? 0) + msToFrames(scenes[1]?.durationMs ?? 0),
    );
    expect(sumSceneFrames).not.toBe(msToFrames(totalMs));
  });

  it("audio offset 200 ms = 6 frame tại 30 fps", () => {
    const plan = buildSceneFramePlan(
      [{ sceneId: "s", fromMs: 0, durationMs: 1400 }],
      MVP_VIDEO_FPS,
    );
    expect(plan[0]?.audioStartMsInScene).toBe(SCENE_EDGE_PAD_MS);
    expect(plan[0]?.audioStartFrameInScene).toBe(6);
  });
});

describe("captionsForScene", () => {
  it("chuyển caption global sang scene-relative ms", () => {
    const sceneFromMs = 1300;
    const sceneDurationMs = 1400;
    const globalCaptions = [
      {
        text: "Redis",
        startMs: sceneFromMs + SCENE_EDGE_PAD_MS,
        endMs: sceneFromMs + SCENE_EDGE_PAD_MS + 200,
        timestampMs: sceneFromMs + SCENE_EDGE_PAD_MS,
        confidence: null,
      },
    ];
    const relative = captionsForScene(globalCaptions, sceneFromMs, sceneDurationMs);
    expect(relative[0]?.startMs).toBe(SCENE_EDGE_PAD_MS);
    expect(captionToSceneRelativeMs(globalCaptions[0] as never, sceneFromMs).startMs).toBe(
      SCENE_EDGE_PAD_MS,
    );
  });

  it("giữ khoảng pause giữa các token", () => {
    const sceneFromMs = 0;
    const captions = captionsForScene(
      [
        {
          text: "một",
          startMs: 200,
          endMs: 400,
          timestampMs: 200,
          confidence: null,
        },
        {
          text: " hai",
          startMs: 700,
          endMs: 900,
          timestampMs: 700,
          confidence: null,
        },
      ],
      sceneFromMs,
      1400,
    );
    expect(captions[0]?.endMs).toBeDefined();
    expect(captions[1]?.startMs).toBeDefined();
    expect((captions[1]?.startMs ?? 0) - (captions[0]?.endMs ?? 0)).toBe(300);
  });
});
