export {
  type CodeSnippet,
  type Diagram,
  parseScript,
  type Scene,
  type Script,
  type ScriptSource,
  safeParseScript,
  sceneSchema,
  scriptSchema,
  scriptSourceSchema,
} from "./script/schema.js";
export { MVP_VIDEO_FPS, SCENE_EDGE_PAD_MS } from "./timing/constants.js";
export {
  computeSceneTimingPlan,
  msToFrames,
  type SceneMeasuredDuration,
  type SceneTiming,
  SceneTimingError,
  type SceneTimingErrorCode,
  type SceneTimingPlan,
  sceneDurationMsFromMeasured,
} from "./timing/scene-duration.js";
