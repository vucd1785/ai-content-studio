import { msToFrames, type RemotionCaption, SCENE_EDGE_PAD_MS } from "@studio/contracts";

export type SceneFramePlan = {
  sceneId: string;
  fromMs: number;
  durationMs: number;
  startFrame: number;
  durationInFrames: number;
  /** Narration begins this many ms after scene `fromMs` (leading pad). */
  audioStartMsInScene: number;
  audioStartFrameInScene: number;
};

export type RenderSceneTimingInput = {
  sceneId: string;
  fromMs: number;
  durationMs: number;
};

/** Cumulative start frames from per-scene rounded frame counts (P1-01). */
export function buildSceneFramePlan(
  scenes: RenderSceneTimingInput[],
  fps: number,
): SceneFramePlan[] {
  let startFrame = 0;
  const plans: SceneFramePlan[] = [];

  for (const scene of scenes) {
    const durationInFrames = msToFrames(scene.durationMs, fps);
    const audioStartMsInScene = SCENE_EDGE_PAD_MS;
    plans.push({
      sceneId: scene.sceneId,
      fromMs: scene.fromMs,
      durationMs: scene.durationMs,
      startFrame,
      durationInFrames,
      audioStartMsInScene,
      audioStartFrameInScene: msToFrames(audioStartMsInScene, fps),
    });
    startFrame += durationInFrames;
  }

  return plans;
}

export function totalDurationInFrames(plans: SceneFramePlan[]): number {
  return plans.reduce((sum, scene) => sum + scene.durationInFrames, 0);
}

/** Global caption ms → scene-relative ms (for Sequences). */
export function captionToSceneRelativeMs(
  caption: RemotionCaption,
  sceneFromMs: number,
): RemotionCaption {
  const startMs = caption.startMs - sceneFromMs;
  const endMs = caption.endMs - sceneFromMs;
  const timestampMs = caption.timestampMs === null ? startMs : caption.timestampMs - sceneFromMs;
  return {
    ...caption,
    startMs,
    endMs,
    timestampMs,
  };
}

/** Captions whose intervals intersect the scene timeline (global ms). */
export function captionsForScene(
  allCaptions: RemotionCaption[],
  sceneFromMs: number,
  sceneDurationMs: number,
): RemotionCaption[] {
  const sceneEndMs = sceneFromMs + sceneDurationMs;
  return allCaptions
    .filter((caption) => caption.startMs < sceneEndMs && caption.endMs > sceneFromMs)
    .map((caption) => captionToSceneRelativeMs(caption, sceneFromMs));
}

export function msToFrameInScene(relativeMs: number, fps: number): number {
  return msToFrames(relativeMs, fps);
}
