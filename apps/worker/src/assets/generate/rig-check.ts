import {
  type ActionClip,
  elbowHeadClearance,
  handHeadClearance,
  KIT_ASSETS,
  sampleAction,
} from "@studio/motion-kit";

/** Cùng ngưỡng với test `kit.test.tsx` "tay không bị đầu che" (P6-03). */
export const MIN_HAND_HEAD_CLEARANCE = 4;
const LAST_FRAME = 120;

/**
 * Luật tay của rig chung cho hành động và tư thế tự tạo (ADR-017 bổ sung 2026-11-11): với mọi nhân vật
 * kênh, frame 0–120, bàn tay cách đầu ít nhất 4 px và khuỷu tay không cắt qua đầu. Trước đây chỉ test
 * của motion kit kiểm, nên hành động lỗi vẫn vào kho. Trả mô tả lỗi để gửi lại Claude, hoặc null.
 */
export function checkRigClip(clip: ActionClip): string | null {
  const problems: string[] = [];
  for (const [skinId, skin] of Object.entries(KIT_ASSETS.character_skin)) {
    let hand: { frame: number; value: number } | null = null;
    let elbow: { frame: number; value: number } | null = null;
    for (let frame = 0; frame <= LAST_FRAME; frame++) {
      const pose = sampleAction(clip, frame);
      const h = handHeadClearance(skin, pose);
      if (h < MIN_HAND_HEAD_CLEARANCE && (hand === null || h < hand.value)) {
        hand = { frame, value: h };
      }
      const e = elbowHeadClearance(skin, pose);
      if (e < 0 && (elbow === null || e < elbow.value)) {
        elbow = { frame, value: e };
      }
    }
    if (hand !== null) {
      problems.push(
        `${skinId}: bàn tay sát hoặc chạm đầu ở frame ${hand.frame} (khoảng hở ${hand.value.toFixed(1)} px, cần ≥ ${MIN_HAND_HEAD_CLEARANCE})`,
      );
    }
    if (elbow !== null) {
      problems.push(
        `${skinId}: khuỷu tay cắt qua đầu ở frame ${elbow.frame} (${elbow.value.toFixed(1)} px)`,
      );
    }
  }
  return problems.length === 0
    ? null
    : `luật tay của rig: ${problems.join("; ")}. Hạ tay thấp hơn hoặc đưa tay xa đầu hơn (armA/armB).`;
}
