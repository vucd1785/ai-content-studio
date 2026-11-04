import type { ExpressionSpec } from "../rig/face.js";
import type { ActionClip } from "../rig/pose.js";
import type { SkinSpec } from "../rig/skin.js";
import type { BackgroundAsset, CameraMove } from "../stage/types.js";
import { actionCelebrate } from "./action/action_celebrate/index.js";
import { actionPanic } from "./action/action_panic/index.js";
import { actionPoint } from "./action/action_point/index.js";
import { actionTalk } from "./action/action_talk/index.js";
import { actionWalk } from "./action/action_walk/index.js";
import { actionWave } from "./action/action_wave/index.js";
import { bgClassroom } from "./background/bg_classroom/index.js";
import { bgRoom } from "./background/bg_room/index.js";
import { camPushIn } from "./camera/cam_push_in/index.js";
import { camStatic } from "./camera/cam_static/index.js";
import { skinBit } from "./character_skin/skin_bit/index.js";
import { skinDau } from "./character_skin/skin_dau/index.js";
import { skinTi } from "./character_skin/skin_ti/index.js";
import { exprDoubt } from "./expression/expr_doubt/index.js";
import { exprHappy } from "./expression/expr_happy/index.js";
import { exprPanic } from "./expression/expr_panic/index.js";
import { exprSad } from "./expression/expr_sad/index.js";
import { exprSmug } from "./expression/expr_smug/index.js";
import { exprSurprised } from "./expression/expr_surprised/index.js";
import { poseHero } from "./pose/pose_hero/index.js";
import { posePoint } from "./pose/pose_point/index.js";
import { poseStand } from "./pose/pose_stand/index.js";

/**
 * Danh mục tài sản của kit theo kind. Mỗi id có thư mục `src/assets/<kind>/<id>/` gồm code và
 * `asset.json` (ADR-016); test kiểm hai phía khớp nhau. Thêm tài sản là thêm thư mục và một dòng ở đây.
 */
export const KIT_ASSETS = {
  character_skin: { skin_ti: skinTi, skin_bit: skinBit, skin_dau: skinDau } satisfies Record<
    string,
    SkinSpec
  >,
  expression: {
    expr_happy: exprHappy,
    expr_surprised: exprSurprised,
    expr_panic: exprPanic,
    expr_doubt: exprDoubt,
    expr_smug: exprSmug,
    expr_sad: exprSad,
  } satisfies Record<string, ExpressionSpec>,
  pose: { pose_stand: poseStand, pose_hero: poseHero, pose_point: posePoint } satisfies Record<
    string,
    ActionClip
  >,
  action: {
    action_wave: actionWave,
    action_point: actionPoint,
    action_celebrate: actionCelebrate,
    action_panic: actionPanic,
    action_walk: actionWalk,
    action_talk: actionTalk,
  } satisfies Record<string, ActionClip>,
  background: { bg_room: bgRoom, bg_classroom: bgClassroom } satisfies Record<
    string,
    BackgroundAsset
  >,
  camera: { cam_static: camStatic, cam_push_in: camPushIn } satisfies Record<string, CameraMove>,
} as const;

export type KitAssetKind = keyof typeof KIT_ASSETS;

/** Mọi cặp (kind, id) có trong kit. */
export function listKitAssets(): { kind: KitAssetKind; id: string }[] {
  return (Object.keys(KIT_ASSETS) as KitAssetKind[]).flatMap((kind) =>
    Object.keys(KIT_ASSETS[kind]).map((id) => ({ kind, id })),
  );
}

function lookup<T>(kind: string, table: Record<string, T>, id: string): T {
  const found = Object.hasOwn(table, id) ? table[id] : undefined;
  if (found === undefined) {
    throw new Error(`motion-kit: không có tài sản ${kind} "${id}"`);
  }
  return found;
}

export const getSkin = (id: string): SkinSpec =>
  lookup("character_skin", KIT_ASSETS.character_skin, id);
export const getExpression = (id: string): ExpressionSpec =>
  lookup("expression", KIT_ASSETS.expression, id);
/** Shot list cho `action` là id kind `action` hoặc `pose`; cả hai đều là `ActionClip`. */
export const getMotion = (id: string): ActionClip =>
  Object.hasOwn(KIT_ASSETS.pose, id)
    ? lookup("pose", KIT_ASSETS.pose, id)
    : lookup("action", KIT_ASSETS.action, id);
export const getBackground = (id: string): BackgroundAsset =>
  lookup("background", KIT_ASSETS.background, id);
export const getCamera = (id: string): CameraMove => lookup("camera", KIT_ASSETS.camera, id);
