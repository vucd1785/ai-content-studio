/**
 * Motion kit (ADR-014, P6-05): rig 2D dùng chung, biểu cảm, lớp da nhân vật, tư thế, hành động,
 * bối cảnh và camera. Mọi thứ là SVG vẽ bằng React, hàm thuần của frame.
 */
export {
  getBackground,
  getCamera,
  getExpression,
  getMotion,
  getSkin,
  KIT_ASSETS,
  type KitAssetKind,
  listKitAssets,
} from "./assets/index.js";
export { PALETTE } from "./palette.js";
export {
  Actor,
  type ActorProps,
  actorPoseAt,
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
export type { HeadZone, Pt, SkinSpec } from "./rig/skin.js";
export { Ambience } from "./stage/ambience.js";
export {
  actorSlotX,
  CLOSE_FACE_Y,
  defaultFacing,
  effectiveSlot,
  type FocusPoint,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  framing,
  framingTransform,
  GROUP_MARGIN,
  SHOT_ZOOM,
  shotFraming,
} from "./stage/framing.js";
export { type StageActor, StageShot, type StageShotProps } from "./stage/stage-shot.js";
export type {
  AmbienceKind,
  BackgroundAsset,
  BackgroundProps,
  CameraMove,
  ShotSize,
  SlotName,
  StageLayout,
} from "./stage/types.js";
export { MOTION_KIT_VERSION } from "./version.js";
