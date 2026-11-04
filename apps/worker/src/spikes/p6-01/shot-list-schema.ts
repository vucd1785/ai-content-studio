/**
 * Spike P6-01: schema shot list (ADR-014) và script v2 có người nói (ADR-015), ba cách mã hóa gửi Gemini.
 * Không dùng trong workflow. Contract thật làm ở P6-06.
 */
import { z } from "zod/v4";

export const CHARACTERS = ["ti", "bit", "dau"] as const;
export const SPEAKERS = ["ti", "bit", "narrator"] as const;
export const EXPRESSIONS = ["vui", "ngacnhien", "hoang", "nghingo", "dacy", "buon"] as const;
export const ACTIONS = ["idle", "talk", "wave", "point", "celebrate", "scared", "walk"] as const;
export const BACKGROUNDS = ["room_study", "flat_wall"] as const;
export const SHOT_SIZES = ["wide", "medium", "close", "high"] as const;
export const POSITIONS = ["left", "center", "right"] as const;
export const BEATS = ["cold_open", "premise", "fun", "fact", "twist"] as const;

const lineSchema = z.object({
  id: z.string().regex(/^l[0-9]{1,3}$/),
  speaker: z.enum(SPEAKERS),
  text: z.string().min(1).max(200),
  emotion: z.enum(EXPRESSIONS),
});

const actorSchema = z.object({
  character: z.enum(CHARACTERS),
  action: z.enum(ACTIONS),
  expression: z.enum(EXPRESSIONS),
  position: z.enum(POSITIONS),
});

const shotSchema = z.object({
  lineId: z.string(),
  cutOnWord: z.string().min(1),
  background: z.enum(BACKGROUNDS),
  shotSize: z.enum(SHOT_SIZES),
  focus: z.enum(CHARACTERS),
  actors: z.array(actorSchema).min(1).max(2),
  onScreenText: z.string().max(60).optional(),
});

const sceneSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  beat: z.enum(BEATS),
  lines: z.array(lineSchema).min(1).max(6),
  shots: z.array(shotSchema).min(1).max(8),
});

export const variantSchema = z.object({
  title: z.string().min(1).max(80),
  scenes: z.array(sceneSchema).min(3).max(8),
  factSource: z.string().min(1).max(300),
});
export type ShotListVariant = z.infer<typeof variantSchema>;

export const payloadSchema = z.object({ variants: z.array(variantSchema).length(2) });

const str = (description?: string) => ({ type: "string", ...(description ? { description } : {}) });
const enumOf = (values: readonly string[]) => ({ type: "string", enum: [...values] });

const lineJson = {
  type: "object",
  properties: {
    id: str("l1, l2, …, duy nhất trong cả phương án"),
    speaker: enumOf(SPEAKERS),
    text: str(),
    emotion: enumOf(EXPRESSIONS),
  },
  required: ["id", "speaker", "text", "emotion"],
};

const shotJson = {
  type: "object",
  properties: {
    lineId: str("id của câu thoại mà cú cắt neo vào"),
    cutOnWord: str("một từ có trong câu đó; cảnh cắt ngay trước từ này"),
    background: enumOf(BACKGROUNDS),
    shotSize: enumOf(SHOT_SIZES),
    focus: enumOf(CHARACTERS),
    actors: {
      type: "array",
      minItems: 1,
      maxItems: 2,
      items: {
        type: "object",
        properties: {
          character: enumOf(CHARACTERS),
          action: enumOf(ACTIONS),
          expression: enumOf(EXPRESSIONS),
          position: enumOf(POSITIONS),
        },
        required: ["character", "action", "expression", "position"],
      },
    },
    onScreenText: str(),
  },
  required: ["lineId", "cutOnWord", "background", "shotSize", "focus", "actors"],
};

function sceneJson(shotsAsString: boolean) {
  return {
    type: "object",
    properties: {
      id: str(),
      beat: enumOf(BEATS),
      lines: { type: "array", minItems: 1, maxItems: 6, items: lineJson },
      ...(shotsAsString
        ? { shotsJson: str("JSON array các shot của cảnh, đúng cấu trúc mô tả trong hướng dẫn") }
        : { shots: { type: "array", minItems: 1, maxItems: 8, items: shotJson } }),
    },
    required: ["id", "beat", "lines", shotsAsString ? "shotsJson" : "shots"],
  };
}

function variantJson(shotsAsString: boolean) {
  return {
    type: "object",
    properties: {
      title: str(),
      scenes: { type: "array", minItems: 3, maxItems: 8, items: sceneJson(shotsAsString) },
      factSource: str("nguồn của dữ kiện ở nhịp fact"),
    },
    required: ["title", "scenes", "factSource"],
  };
}

export type Encoding = "nested" | "shotsJson" | "variantJson" | "flat" | "flatShotsJson";

const actorJson = (shotJson.properties.actors as { items: Record<string, unknown> }).items;

/**
 * Tối đa hai tầng mảng-chứa-object (variants → lines/shots), như schema script đang chạy.
 * lines và shots nằm ở cấp phương án, gắn `sceneId`; hai actor là hai trường thay vì mảng.
 */
function flatVariantJson(shotsAsString: boolean) {
  const { actors: _actors, ...shotProps } = shotJson.properties;
  return {
    type: "object",
    properties: {
      title: str(),
      factSource: str("nguồn của dữ kiện ở nhịp fact"),
      scenes: {
        type: "array",
        minItems: 3,
        maxItems: 8,
        items: {
          type: "object",
          properties: { id: str(), beat: enumOf(BEATS) },
          required: ["id", "beat"],
        },
      },
      lines: {
        type: "array",
        items: {
          type: "object",
          properties: { sceneId: str(), ...lineJson.properties },
          required: ["sceneId", ...lineJson.required],
        },
      },
      ...(shotsAsString
        ? {
            shotsJson: str(
              "JSON array mọi shot của phương án, mỗi shot có sceneId và actors như mô tả trong hướng dẫn",
            ),
          }
        : {
            shots: {
              type: "array",
              items: {
                type: "object",
                properties: { sceneId: str(), ...shotProps, actor1: actorJson, actor2: actorJson },
                required: [
                  "sceneId",
                  "lineId",
                  "cutOnWord",
                  "background",
                  "shotSize",
                  "focus",
                  "actor1",
                ],
              },
            },
          }),
    },
    required: ["title", "factSource", "scenes", "lines", shotsAsString ? "shotsJson" : "shots"],
  };
}

/** JSON Schema gửi Gemini theo từng cách mã hóa. */
export function generationSchema(encoding: Encoding): Record<string, unknown> {
  if (encoding === "flat" || encoding === "flatShotsJson") {
    return {
      type: "object",
      properties: {
        variants: {
          type: "array",
          minItems: 2,
          maxItems: 2,
          items: flatVariantJson(encoding === "flatShotsJson"),
        },
      },
      required: ["variants"],
    };
  }
  const items =
    encoding === "variantJson"
      ? {
          type: "object",
          properties: { json: str("toàn bộ một phương án dạng JSON") },
          required: ["json"],
        }
      : variantJson(encoding === "shotsJson");
  return {
    type: "object",
    properties: { variants: { type: "array", minItems: 2, maxItems: 2, items } },
    required: ["variants"],
  };
}

/** Đưa response về cùng dạng rồi mới chạy Zod (như `diagramJson` của ADR-007). */
export function decodePayload(encoding: Encoding, raw: unknown): unknown {
  const root = raw as { variants?: unknown[] };
  if (!Array.isArray(root?.variants)) {
    return raw;
  }
  if (encoding === "variantJson") {
    return { variants: root.variants.map((v) => JSON.parse((v as { json: string }).json)) };
  }
  if (encoding === "flat" || encoding === "flatShotsJson") {
    return {
      variants: root.variants.map((v) => {
        const variant = v as {
          title: string;
          factSource: string;
          scenes: Array<{ id: string; beat: string }>;
          lines: Array<Record<string, unknown> & { sceneId: string }>;
          shots?: Array<
            Record<string, unknown> & { sceneId: string; actor1?: unknown; actor2?: unknown }
          >;
          shotsJson?: string;
        };
        const shots =
          encoding === "flat"
            ? (variant.shots ?? []).map(({ actor1, actor2, ...s }) => ({
                ...s,
                actors: [actor1, actor2].filter(Boolean),
              }))
            : (JSON.parse(String(variant.shotsJson)) as Array<
                Record<string, unknown> & { sceneId: string }
              >);
        return {
          title: variant.title,
          factSource: variant.factSource,
          scenes: variant.scenes.map((scene) => ({
            ...scene,
            lines: variant.lines
              .filter((l) => l.sceneId === scene.id)
              .map(({ sceneId: _s, ...l }) => l),
            shots: shots.filter((s) => s.sceneId === scene.id).map(({ sceneId: _s, ...s }) => s),
          })),
        };
      }),
    };
  }
  if (encoding === "shotsJson") {
    return {
      variants: root.variants.map((v) => {
        const variant = v as { scenes?: Array<Record<string, unknown>> };
        return {
          ...variant,
          scenes: (variant.scenes ?? []).map(({ shotsJson, ...scene }) => ({
            ...scene,
            shots: JSON.parse(String(shotsJson)),
          })),
        };
      }),
    };
  }
  return raw;
}

export type SemanticReport = {
  shots: number;
  lines: number;
  durationGuessSec: number;
  cutsPerMinute: number;
  danglingLineIds: number;
  cutWordNotInLine: number;
  sameSizeConsecutive: number;
  dauSpeaks: number;
  beatsMissing: string[];
};

/** Kiểm ngữ nghĩa mà Zod không bắt: tham chiếu câu, từ cắt, luật nhịp. Ước lượng thời lượng 2,7 từ/giây. */
export function semanticCheck(variant: ShotListVariant): SemanticReport {
  const lines = variant.scenes.flatMap((s) => s.lines);
  const byId = new Map(lines.map((l) => [l.id, l]));
  const shots = variant.scenes.flatMap((s) => s.shots);
  const words = lines.reduce((n, l) => n + l.text.split(/\s+/).filter(Boolean).length, 0);
  const durationGuessSec = words / 2.7;
  let sameSizeConsecutive = 0;
  for (let i = 1; i < shots.length; i++) {
    if (shots[i]?.shotSize === shots[i - 1]?.shotSize) sameSizeConsecutive++;
  }
  const norm = (s: string) => s.toLowerCase().replace(/[.,!?…:;"“”]/g, "");
  return {
    shots: shots.length,
    lines: lines.length,
    durationGuessSec: Math.round(durationGuessSec),
    cutsPerMinute: Math.round((shots.length / durationGuessSec) * 60),
    danglingLineIds: shots.filter((s) => !byId.has(s.lineId)).length,
    cutWordNotInLine: shots.filter((s) => {
      const line = byId.get(s.lineId);
      return !line || !norm(line.text).split(/\s+/).includes(norm(s.cutOnWord));
    }).length,
    sameSizeConsecutive,
    dauSpeaks: lines.filter((l) => (l.speaker as string) === "dau").length,
    beatsMissing: BEATS.filter((b) => !variant.scenes.some((s) => s.beat === b)),
  };
}
