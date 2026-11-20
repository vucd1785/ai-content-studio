import { isRequestRef, type ScriptV2 } from "@studio/contracts";

/** Một yêu cầu đã đóng: trong các cảnh `sceneIds`, id `fallbackAssetId` được thay bằng `assetId`. */
export type AssetSubstitution = {
  sceneIds: readonly string[];
  fallbackAssetId: string;
  assetId: string;
  /** Id yêu cầu (`r1`); minh họa nêu thẳng id này thay vì tài sản thay thế (ADR-014 bổ sung 2026-11-12). */
  requestId?: string;
};

/** Cột `scene_id` của `motion_asset_requests` lưu danh sách cảnh cách nhau bằng dấu phẩy. */
export const joinSceneIds = (ids: readonly string[]) => ids.join(",");
export const splitSceneIds = (value: string) => value.split(",").filter((s) => s !== "");

/**
 * Thay tài sản thay thế bằng tài sản mới trong các shot của cảnh được yêu cầu (ADR-016, ADR-017).
 * Kịch bản đã lưu không đổi; mọi bước sau (storyboard, render) dùng bản đã thay.
 * `illustration.items` dạng `rN` được thay bằng tài sản của yêu cầu đó; yêu cầu chưa xong thì bỏ khỏi
 * minh họa, minh họa không còn đồ vật nào thì bỏ hẳn.
 */
export function applyAssetSubstitutions(
  script: ScriptV2,
  substitutions: readonly AssetSubstitution[],
): ScriptV2 {
  const hasRefs = script.scenes.some((scene) =>
    scene.shots.some((shot) => shot.illustration?.items.some(isRequestRef)),
  );
  if (substitutions.length === 0 && !hasRefs) {
    return script;
  }
  return {
    ...script,
    scenes: script.scenes.map((scene) => {
      const subs = substitutions.filter((s) => s.sceneIds.includes(scene.id));
      const swap = (id: string) => subs.find((s) => s.fallbackAssetId === id)?.assetId ?? id;
      const resolveItem = (id: string): string[] => {
        if (!isRequestRef(id)) {
          return [swap(id)];
        }
        const done = substitutions.find((s) => s.requestId === id);
        return done === undefined ? [] : [done.assetId];
      };
      return {
        ...scene,
        shots: scene.shots.map(({ illustration, ...shot }) => ({
          ...shot,
          background: swap(shot.background),
          ...(shot.camera === undefined ? {} : { camera: swap(shot.camera) }),
          ...(shot.props === undefined ? {} : { props: shot.props.map(swap) }),
          ...illustrationAfter(illustration, resolveItem),
          actors: shot.actors.map((a) => ({
            ...a,
            action: swap(a.action),
            expression: swap(a.expression),
          })),
        })),
      };
    }),
  };
}

function illustrationAfter(
  illustration: ScriptV2["scenes"][number]["shots"][number]["illustration"],
  resolveItem: (id: string) => string[],
) {
  if (illustration === undefined) {
    return {};
  }
  const items = [...new Set(illustration.items.flatMap(resolveItem))];
  return items.length === 0 ? {} : { illustration: { ...illustration, items } };
}
