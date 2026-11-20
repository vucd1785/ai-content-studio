import type { PropAsset, ShotSize, SlotName } from "./types.js";

/**
 * Số chỗ đứng tối đa (người cộng đồ vật `floor`) theo cỡ khung, cùng luật với `MAX_ACTORS_BY_SHOT_SIZE`
 * của contracts (bổ sung ADR-013 2026-11-03). Cỡ cận không vẽ đồ vật: khung chỉ nhìn mặt người được lấy nét.
 */
export const MAX_OCCUPANTS_BY_SHOT_SIZE: Record<ShotSize, number> = {
  wide: 3,
  high: 3,
  medium: 2,
  close: 0,
};

/** Đồ vật `floor` lấy vị trí còn trống theo thứ tự này: giữa trước, rồi hai bên. */
export const PROP_SLOT_ORDER: readonly SlotName[] = ["center", "right", "left"];

export type PropLayout = {
  floor: { id: string; slot: SlotName }[];
  /** Tối đa một đồ vật `air`. */
  air: string[];
  /** Đồ vật bị bỏ vì hết chỗ, cỡ cận, trùng id hoặc quá một `air`. */
  dropped: string[];
};

/**
 * Đặt đồ vật của một shot (P6-19). `StageShot` và kiểm storyboard của worker dùng chung hàm này nên ảnh
 * tĩnh, video và cảnh báo của builder luôn khớp nhau.
 */
export function layoutProps(
  propIds: readonly string[],
  actorSlots: readonly SlotName[],
  shotSize: ShotSize,
  getProp: (id: string) => PropAsset,
): PropLayout {
  const out: PropLayout = { floor: [], air: [], dropped: [] };
  const seen = new Set<string>();
  const free = PROP_SLOT_ORDER.filter((s) => !actorSlots.includes(s));
  const room = Math.max(0, MAX_OCCUPANTS_BY_SHOT_SIZE[shotSize] - actorSlots.length);
  for (const id of propIds) {
    if (seen.has(id) || shotSize === "close") {
      out.dropped.push(id);
      continue;
    }
    seen.add(id);
    const prop = getProp(id);
    if (prop.placement === "air") {
      (out.air.length === 0 ? out.air : out.dropped).push(id);
      continue;
    }
    const slot = free[out.floor.length];
    if (out.floor.length >= room || slot === undefined) {
      out.dropped.push(id);
      continue;
    }
    out.floor.push({ id, slot });
  }
  return out;
}
