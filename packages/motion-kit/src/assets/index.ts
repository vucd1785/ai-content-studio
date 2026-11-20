import type { ExpressionSpec } from "../rig/face.js";
import type { ActionClip } from "../rig/pose.js";
import type { SkinSpec } from "../rig/skin.js";
import type { BackgroundAsset, CameraMove, PropAsset } from "../stage/types.js";
import { actionCelebrate } from "./action/action_celebrate/index.js";
import { actionFollow } from "./action/action_follow/index.js";
import { actionListen } from "./action/action_listen/index.js";
import { actionLookUp } from "./action/action_look_up/index.js";
import { actionPanic } from "./action/action_panic/index.js";
import { actionPoint } from "./action/action_point/index.js";
import { actionPresent } from "./action/action_present/index.js";
import { actionRun } from "./action/action_run/index.js";
import { actionShrug } from "./action/action_shrug/index.js";
import { actionTalk } from "./action/action_talk/index.js";
import { actionThink } from "./action/action_think/index.js";
import { actionWalk } from "./action/action_walk/index.js";
import { actionWave } from "./action/action_wave/index.js";
import { bgClassroom } from "./background/bg_classroom/index.js";
import { bgMeadow } from "./background/bg_meadow/index.js";
import { bgRoom } from "./background/bg_room/index.js";
import { camBump } from "./camera/cam_bump/index.js";
import { camDutch } from "./camera/cam_dutch/index.js";
import { camEndCard } from "./camera/cam_end_card/index.js";
import { camLowAngle } from "./camera/cam_low_angle/index.js";
import { camPan } from "./camera/cam_pan/index.js";
import { camPullOut } from "./camera/cam_pull_out/index.js";
import { camPushIn } from "./camera/cam_push_in/index.js";
import { camStatic } from "./camera/cam_static/index.js";
import { camWhip } from "./camera/cam_whip/index.js";
import { skinBit } from "./character_skin/skin_bit/index.js";
import { skinDau } from "./character_skin/skin_dau/index.js";
import { skinTi } from "./character_skin/skin_ti/index.js";
import { exprDoubt } from "./expression/expr_doubt/index.js";
import { exprHappy } from "./expression/expr_happy/index.js";
import { exprPanic } from "./expression/expr_panic/index.js";
import { exprSad } from "./expression/expr_sad/index.js";
import { exprSmug } from "./expression/expr_smug/index.js";
import { exprSurprised } from "./expression/expr_surprised/index.js";
import { FLAG_ASSETS } from "./flags.generated.js";
import { GENERATED_ASSETS } from "./generated.js";
import { poseHero } from "./pose/pose_hero/index.js";
import { posePoint } from "./pose/pose_point/index.js";
import { poseStand } from "./pose/pose_stand/index.js";
import { propLaptop } from "./prop/prop_laptop/index.js";
import { propLoadMeter } from "./prop/prop_load_meter/index.js";
import { propPackets } from "./prop/prop_packets/index.js";
import { propQueueCrowd } from "./prop/prop_queue_crowd/index.js";
import { propRouterInfected } from "./prop/prop_router_infected/index.js";
import { propServer } from "./prop/prop_server/index.js";
import { propServerOverload } from "./prop/prop_server_overload/index.js";
import { propShield } from "./prop/prop_shield/index.js";

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
  pose: {
    pose_stand: poseStand,
    pose_hero: poseHero,
    pose_point: posePoint,
    ...GENERATED_ASSETS.pose,
  } satisfies Record<string, ActionClip>,
  action: {
    action_wave: actionWave,
    action_point: actionPoint,
    action_celebrate: actionCelebrate,
    action_panic: actionPanic,
    action_walk: actionWalk,
    action_talk: actionTalk,
    action_run: actionRun,
    action_think: actionThink,
    action_listen: actionListen,
    action_shrug: actionShrug,
    action_present: actionPresent,
    action_look_up: actionLookUp,
    // ADR-026: cảnh kết mời theo dõi.
    action_follow: actionFollow,
    // ADR-017: hành động worker tự tạo.
    ...GENERATED_ASSETS.action,
  } satisfies Record<string, ActionClip>,
  background: {
    bg_room: bgRoom,
    bg_classroom: bgClassroom,
    bg_meadow: bgMeadow,
    ...GENERATED_ASSETS.background,
  } satisfies Record<string, BackgroundAsset>,
  camera: {
    cam_static: camStatic,
    cam_push_in: camPushIn,
    cam_pull_out: camPullOut,
    cam_pan: camPan,
    cam_bump: camBump,
    // ADR-026: khung kết mời theo dõi.
    cam_end_card: camEndCard,
    cam_low_angle: camLowAngle,
    cam_dutch: camDutch,
    cam_whip: camWhip,
  } satisfies Record<string, CameraMove>,
  /** Đồ vật (P6-19): `floor` chiếm một vị trí đứng, `air` bay trong khung. */
  prop: {
    prop_server: propServer,
    prop_server_overload: propServerOverload,
    prop_laptop: propLaptop,
    prop_router_infected: propRouterInfected,
    prop_shield: propShield,
    prop_load_meter: propLoadMeter,
    prop_queue_crowd: propQueueCrowd,
    prop_packets: propPackets,
    // ADR-029: cờ quốc gia từ nguồn có sẵn (flag-icons, MIT).
    ...FLAG_ASSETS,
    // ADR-017: tài sản worker tự tạo, `candidate` tới khi được duyệt ở Cổng 1.
    ...GENERATED_ASSETS.prop,
  } satisfies Record<string, PropAsset>,
} as const;

export type KitAssetKind = keyof typeof KIT_ASSETS;

/**
 * Đăng ký tài sản worker vừa tạo vào danh mục đang chạy (ADR-017), để tiến trình đang sống không phải khởi
 * động lại. Bundle Remotion mới đọc tài sản qua `generated.ts`; hàm này chỉ cho code chạy trong Node.
 */
export function registerGeneratedAsset(
  kind: "prop" | "background" | "action" | "pose",
  id: string,
  asset: PropAsset | BackgroundAsset | ActionClip,
): void {
  (KIT_ASSETS[kind] as Record<string, PropAsset | BackgroundAsset | ActionClip>)[id] = asset;
}

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
export const getProp = (id: string): PropAsset => lookup("prop", KIT_ASSETS.prop, id);
