import { type FormatPack, MAX_ACTORS_BY_SHOT_SIZE, OUTRO_BEAT } from "@studio/contracts";

/** Hình cố định của cảnh mời theo dõi (ADR-026). */
export const OUTRO_ACTION = "action_follow";
export const OUTRO_ACTION_FALLBACK = "action_wave";
export const OUTRO_EXPRESSION = "expr_happy";
/** Khung kết chừa trời phía trên cho thẻ mời theo dõi; kho cũ chưa có thì đẩy máy chậm. */
export const OUTRO_CAMERA = "cam_end_card";
export const OUTRO_CAMERA_FALLBACK = "cam_push_in";

type Actor = { character: string; action: string; expression: string };
type Shot = {
  id: string;
  lineId: string;
  cutOnWord: string;
  background: string;
  shotSize: string;
  camera?: string;
  focus: string;
  actors: Actor[];
  [key: string]: unknown;
};
type Line = { id: string; speaker: string; text: string };
type Scene = { id: string; beat: string; lines: Line[]; shots: Shot[] };
type Variant = { scenes?: Scene[] };

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object";

/**
 * Code dựng hình cảnh `outro` (ADR-026), chạy trên kịch bản đã đổi về dạng lồng nhau, trước khi kiểm Zod:
 * một shot rộng có cả dàn nhân vật (theo thứ tự xuất hiện trong video), mọi người chỉ tay lên nút theo dõi, cười,
 * tông ấm, hoa giấy. LLM chỉ viết câu mời. Gói không có nhịp `outro` hoặc dữ liệu lạ thì trả nguyên.
 *
 * - Shot neo câu đầu của cảnh; câu sau (nếu có) vẫn đọc dưới cùng shot đó.
 * - Cỡ `wide`, trừ khi shot ngay trước cũng `wide` thì `high` (luật không hai shot liền cùng cỡ).
 * - Máy `cam_end_card` chừa trời cho thẻ kết; kho chưa có thì `cam_push_in`, không có nữa thì bỏ trường máy.
 * - Kho chưa có `action_follow` thì vẫy tay.
 */
export function stageOutroScenes(
  decoded: unknown,
  format: Pick<FormatPack, "beats">,
  hasAsset: (id: string) => boolean,
): unknown {
  if (!format.beats.some((b) => b.id === OUTRO_BEAT)) {
    return decoded;
  }
  if (!isObject(decoded) || !Array.isArray(decoded.variants)) {
    return decoded;
  }
  return {
    ...decoded,
    variants: decoded.variants.map((v) => (isObject(v) ? stageVariant(v as Variant, hasAsset) : v)),
  };
}

function stageVariant(variant: Variant, hasAsset: (id: string) => boolean): Variant {
  const scenes = variant.scenes;
  if (!Array.isArray(scenes) || !scenes.every(isSceneLike)) {
    return variant;
  }
  const cast: string[] = [];
  for (const scene of scenes) {
    for (const shot of scene.shots) {
      for (const actor of shot.actors) {
        if (
          isObject(actor) &&
          typeof actor.character === "string" &&
          !cast.includes(actor.character)
        ) {
          cast.push(actor.character);
        }
      }
    }
  }
  const action = hasAsset(OUTRO_ACTION) ? OUTRO_ACTION : OUTRO_ACTION_FALLBACK;
  const out: Scene[] = [];
  let prevSize: string | undefined;
  for (const scene of scenes) {
    const first = scene.shots[0];
    const line = scene.lines[0];
    if (scene.beat !== OUTRO_BEAT || first === undefined || line === undefined) {
      out.push(scene);
      prevSize = scene.shots.at(-1)?.shotSize ?? prevSize;
      continue;
    }
    const shotSize = prevSize === "wide" ? "high" : "wide";
    const max = MAX_ACTORS_BY_SHOT_SIZE[shotSize];
    const characters = [line.speaker, ...cast.filter((c) => c !== line.speaker)].slice(0, max);
    // Giữ thứ tự đứng quen thuộc của kênh (thứ tự xuất hiện), người nói chỉ để chắc có mặt.
    characters.sort((a, b) => indexOr(cast, a) - indexOr(cast, b));
    const words = line.text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
    const {
      props: _props,
      illustration: _illustration,
      camera: _camera,
      effects: _effects,
      mood: _mood,
      ...rest
    } = first;
    const shot: Shot = {
      ...rest,
      lineId: line.id,
      cutOnWord: words[0]?.replace(/[^\p{L}\p{N}]/gu, "") || first.cutOnWord,
      shotSize,
      ...(hasAsset(OUTRO_CAMERA)
        ? { camera: OUTRO_CAMERA }
        : hasAsset(OUTRO_CAMERA_FALLBACK)
          ? { camera: OUTRO_CAMERA_FALLBACK }
          : {}),
      focus: line.speaker,
      actors: characters.map((character) => ({
        character,
        action,
        expression: OUTRO_EXPRESSION,
      })),
      mood: "warm",
      effects: ["confetti"],
    };
    out.push({ ...scene, shots: [shot] });
    prevSize = shotSize;
  }
  return { ...variant, scenes: out };
}

const indexOr = (list: readonly string[], key: string) => {
  const i = list.indexOf(key);
  return i === -1 ? list.length : i;
};

function isSceneLike(scene: unknown): scene is Scene {
  return (
    isObject(scene) &&
    typeof scene.beat === "string" &&
    Array.isArray(scene.lines) &&
    Array.isArray(scene.shots) &&
    scene.shots.every((s) => isObject(s) && Array.isArray(s.actors)) &&
    scene.lines.every(
      (l) => isObject(l) && typeof l.speaker === "string" && typeof l.text === "string",
    )
  );
}
