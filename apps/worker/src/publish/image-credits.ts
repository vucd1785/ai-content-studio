import { listManifests } from "../assets/generate/registry.js";

/**
 * Dòng ghi công của ảnh thật trong video (ADR-030): tài sản có trong `render_props` (đồ vật của shot và món của
 * minh họa) mà giấy phép có `attribution` (ảnh Wikimedia Commons CC BY, CC BY-SA…). Không trùng, theo thứ tự xuất
 * hiện trong video.
 */
export function imageCreditsFor(
  shots: readonly {
    props?: readonly string[] | undefined;
    illustration?: { items: readonly string[] } | undefined;
  }[],
  kitSrc: string,
): string[] {
  const used: string[] = [];
  for (const shot of shots) {
    for (const id of [...(shot.props ?? []), ...(shot.illustration?.items ?? [])]) {
      if (!used.includes(id)) {
        used.push(id);
      }
    }
  }
  if (used.length === 0) {
    return [];
  }
  const manifests = new Map(listManifests(kitSrc).map((m) => [m.id, m]));
  const credits: string[] = [];
  for (const id of used) {
    for (const license of manifests.get(id)?.licenses ?? []) {
      if (
        typeof license === "object" &&
        license.attribution &&
        !credits.includes(license.attribution)
      ) {
        credits.push(license.attribution);
      }
    }
  }
  return credits;
}
