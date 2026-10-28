export {
  assertAlignmentReadyForCaptions,
  buildCaptionsFromSceneAlignments,
  CaptionMappingError,
  type CaptionMappingErrorCode,
  mapSceneAlignmentToCaptions,
  type SceneAlignmentForCaptions,
} from "./captions/map-alignment-to-captions.js";
export { type RemotionCaption, remotionCaptionSchema } from "./captions/types.js";
export {
  type AlignmentValidation,
  type AlignmentWord,
  type AlignRequest,
  type AlignResponse,
  alignmentEngineSchema,
  alignmentGateSchema,
  alignmentValidationSchema,
  alignmentWordSchema,
  alignRequestSchema,
  alignResponseSchema,
  type SynthesizeRequest,
  type SynthesizeResponse,
  revalidateGateRequestSchema,
  type RevalidateGateRequest,
  synthesizeRequestSchema,
  synthesizeResponseSchema,
  ttsErrorBodySchema,
} from "./media/tts.js";
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
