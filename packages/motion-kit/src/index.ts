/**
 * Motion kit (ADR-014, P6-05): rig 2D dùng chung, biểu cảm, lớp da nhân vật, tư thế, hành động,
 * bối cảnh, camera và đồ vật (P6-19). Mọi thứ là SVG vẽ bằng React, hàm thuần của frame.
 */
export {
  getBackground,
  getCamera,
  getExpression,
  getMotion,
  getProp,
  getSkin,
  KIT_ASSETS,
  type KitAssetKind,
  listKitAssets,
  registerGeneratedAsset,
} from "./assets/index.js";
export { PALETTE } from "./palette.js";
export {
  Actor,
  type ActorProps,
  actorPoseAt,
  aliveOffset,
  blinkAt,
  mouthOpenAt,
  type SpeakingRange,
} from "./rig/actor.js";
export {
  CharacterFigure,
  type CharacterFigureProps,
  characterGeometry,
  elbowHeadClearance,
  handHeadClearance,
} from "./rig/character.js";
export { type ExpressionSpec, Face, type FaceStyle } from "./rig/face.js";
export { clamp, type EasingFn, easing, lerp, rnd, wobble } from "./rig/math.js";
export {
  type ActionClip,
  holdClip,
  type LimbAngles,
  mixPose,
  POSE_REST,
  type Pose,
  type PoseKey,
  pose,
  sampleAction,
} from "./rig/pose.js";
export { applyOutfit, OUTFIT_KINDS, type OutfitKind } from "./rig/outfit.js";
export type { HeadZone, Pt, SkinSpec } from "./rig/skin.js";
export { Ambience } from "./stage/ambience.js";
export {
  type EffectAnchor,
  Effects,
  impactShake,
  SHAKE_FRAMES,
} from "./stage/effects.js";
export { flagProp } from "./stage/flag.js";
export {
  actorSlotX,
  backgroundScale,
  CLOSE_FACE_Y,
  defaultFacing,
  END_CARD_SHARE,
  effectiveSlot,
  type FocusPoint,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  type FrameSize,
  type FramingOptions,
  framing,
  framingTransform,
  GROUP_MARGIN,
  ILLUSTRATION_SHARE,
  isLandscape,
  reserveShift,
  SHOT_ZOOM,
  scaledBounds,
  shotFraming,
  shotReserve,
  VERTICAL_FRAME,
  viewHalfExtents,
  WIDE_FRAME,
} from "./stage/framing.js";
export {
  GENERATED_BACKGROUND_STAGE,
  GENERATED_WIDE_BACKGROUND_STAGE,
  WIDE_BACKGROUND_MARGIN,
} from "./stage/generated-stage.js";
export {
  type BoardTheme,
  boardThemeFor,
  ILLUSTRATION_MAX_BOTTOM,
  ILLUSTRATION_TOP,
  Illustration,
  type IllustrationStyle,
  illustrationBox,
} from "./stage/illustration.js";
export { imageProp } from "./stage/image-prop.js";
export {
  MOODS,
  MoodGrade,
  MoodLight,
  type MoodSpec,
  PARALLAX,
  parallaxOffset,
} from "./stage/lighting.js";
export {
  layoutProps,
  MAX_OCCUPANTS_BY_SHOT_SIZE,
  PROP_SLOT_ORDER,
  type PropLayout,
} from "./stage/props.js";
export { airPath, type StageActor, StageShot, type StageShotProps } from "./stage/stage-shot.js";
export type {
  AirPropProps,
  AmbienceKind,
  BackgroundAsset,
  BackgroundProps,
  CameraMove,
  EffectKind,
  Mood,
  PropAsset,
  PropProps,
  ShotSize,
  SlotName,
  StageLayout,
} from "./stage/types.js";
export { MOTION_KIT_VERSION } from "./version.js";
