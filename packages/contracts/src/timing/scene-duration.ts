import { MVP_VIDEO_FPS, SCENE_EDGE_PAD_MS } from "./constants.js";

export type SceneTimingErrorCode =
  | "empty_scenes"
  | "duplicate_scene_id"
  | "invalid_measured_duration"
  | "invalid_fps";

export class SceneTimingError extends Error {
  readonly code: SceneTimingErrorCode;

  constructor(code: SceneTimingErrorCode, message: string) {
    super(message);
    this.name = "SceneTimingError";
    this.code = code;
  }
}

export type SceneMeasuredDuration = {
  sceneId: string;
  /** ffprobe duration of the scene WAV in milliseconds. */
  measuredDurationMs: number;
};

export type SceneTiming = {
  sceneId: string;
  fromMs: number;
  durationMs: number;
  durationInFrames: number;
};

export type SceneTimingPlan = {
  fps: number;
  scenes: SceneTiming[];
  totalDurationMs: number;
  totalDurationInFrames: number;
};

function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new SceneTimingError(
      "invalid_measured_duration",
      `${label} must be a finite number >= 0`,
    );
  }
}

function assertValidFps(fps: number): void {
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new SceneTimingError("invalid_fps", "fps must be a finite number > 0");
  }
}

/** Converts milliseconds to frame count at the given fps (rounded to nearest frame). */
export function msToFrames(durationMs: number, fps: number = MVP_VIDEO_FPS): number {
  assertFiniteNonNegative(durationMs, "durationMs");
  assertValidFps(fps);
  return Math.round((durationMs * fps) / 1000);
}

/** Scene timeline length from ffprobe duration plus 200 ms head and tail padding. */
export function sceneDurationMsFromMeasured(measuredDurationMs: number): number {
  assertFiniteNonNegative(measuredDurationMs, "measuredDurationMs");
  return Math.round(measuredDurationMs + 2 * SCENE_EDGE_PAD_MS);
}

/**
 * Builds sequential scene boundaries and frame counts from measured WAV durations.
 * Total length uses summed measured audio plus per-scene padding — never word counts.
 */
export function computeSceneTimingPlan(
  scenes: SceneMeasuredDuration[],
  fps: number = MVP_VIDEO_FPS,
): SceneTimingPlan {
  if (scenes.length === 0) {
    throw new SceneTimingError("empty_scenes", "At least one scene is required");
  }

  assertValidFps(fps);

  const seenIds = new Set<string>();
  let cursorMs = 0;
  const timedScenes: SceneTiming[] = [];
  let totalDurationMs = 0;
  let totalDurationInFrames = 0;

  for (const scene of scenes) {
    if (seenIds.has(scene.sceneId)) {
      throw new SceneTimingError("duplicate_scene_id", `Duplicate sceneId: ${scene.sceneId}`);
    }
    seenIds.add(scene.sceneId);

    const durationMs = sceneDurationMsFromMeasured(scene.measuredDurationMs);
    const durationInFrames = msToFrames(durationMs, fps);

    timedScenes.push({
      sceneId: scene.sceneId,
      fromMs: cursorMs,
      durationMs,
      durationInFrames,
    });

    cursorMs += durationMs;
    totalDurationMs += durationMs;
    totalDurationInFrames += durationInFrames;
  }

  return {
    fps,
    scenes: timedScenes,
    totalDurationMs,
    totalDurationInFrames,
  };
}
