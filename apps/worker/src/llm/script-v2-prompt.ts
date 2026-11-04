import {
  AMBIENCE_KINDS,
  type CastMember,
  type CatalogAsset,
  type CreativeMode,
  type FormatPack,
  MAX_ACTORS_BY_SHOT_SIZE,
  NARRATOR,
  REQUESTABLE_ASSET_KINDS,
  SHOT_SIZES,
  shotsNeededForDuration,
} from "@studio/contracts";
import type { BriefInput } from "./types.js";

/**
 * Prompt và schema sinh của script `2` (P6-10; 04 mục Job và retry; 05 mục Script JSON v2).
 * Gửi LLM dạng `flat` của spike P6-01: `lines[]`, `shots[]` cùng cấp trong một phương án, gắn `sceneId`;
 * nhân vật của shot là `actor1`, `actor2`, `actor3` (bổ sung ADR-013 2026-11-03: người thứ ba chỉ ở cỡ `wide`, `high`). Adapter đổi về dạng lồng nhau rồi mới chạy Zod.
 */

/** Nhân vật của kênh như prompt cần: tên, tính cách, có nói không, câu cửa miệng. */
export type CastProfile = CastMember & {
  displayName: string;
  role: string;
  personality: string;
  catchphrases: string[];
};

export type CatalogEntry = CatalogAsset & { description: string; tags: string[] };

export type ScriptV2GenerationInput = {
  brief: Omit<BriefInput, "durationSec"> & { durationSec: number };
  format: FormatPack;
  cast: readonly CastProfile[];
  /** Tài sản được phép dùng: `approved` của kho, chung hoặc của kênh. */
  assetCatalog: readonly CatalogEntry[];
  mode: CreativeMode;
  /** Quy tắc giọng điệu của kênh (`brand_profiles.tone_rules`). */
  toneRules: string;
  researchSummary?: string;
  /** Nguồn research đánh id để nhịp cần nguồn trỏ vào. */
  researchSources?: readonly { id: string; title: string; url?: string }[];
  directorNote?: string;
};

const SYSTEM_INSTRUCTION = [
  "You write Vietnamese short-form animated video scripts for a channel with recurring cartoon characters.",
  "Return JSON only, no markdown fences. Produce exactly two distinct variants in field variants.",
  "Each variant is a dialogue between the channel characters, cut into scenes that follow the format beats in order.",
  "Lines and shots are flat arrays at variant level, each tagged with sceneId. Every scene needs at least one line and one shot.",
  "Use only the asset ids, character keys and enums given in the schema. Never invent ids.",
  "The video is animation only: no on-screen text, no code boxes, no diagrams. Show ideas with actions, expressions, props and backgrounds.",
  "Do not use Google Search or external tools.",
].join(" ");

export function scriptV2SystemInstruction(): string {
  return SYSTEM_INSTRUCTION;
}

function catalogLines(catalog: readonly CatalogEntry[]): string[] {
  const kinds = [...new Set(catalog.map((a) => a.kind))];
  return kinds.flatMap((kind) => [
    `${kind}:`,
    ...catalog
      .filter((a) => a.kind === kind)
      .map(
        (a) => `  - ${a.id}: ${a.description}${a.tags.length > 0 ? ` [${a.tags.join(", ")}]` : ""}`,
      ),
  ]);
}

/** Prompt người dùng: brief, gói thể loại, dàn nhân vật, giọng điệu kênh, kho tài sản, luật nhịp. */
export function buildScriptV2Prompt(input: ScriptV2GenerationInput): string {
  const { brief, format } = input;
  const shots = shotsNeededForDuration(format, brief.durationSec);
  const speakers = input.cast.filter((c) => c.speaks).map((c) => c.characterKey);
  const lines = [
    "Write two script variants for this brief.",
    `topic: ${brief.topic}`,
    `audience: ${brief.audience}`,
    `goal: ${brief.goal}`,
    `durationSec: ${brief.durationSec}`,
    `tone: ${brief.tone}`,
    `visualStyle: ${brief.visualStyle}`,
  ];
  if (brief.notes?.trim()) {
    lines.push(`notes: ${brief.notes.trim()}`);
  }
  lines.push(
    "",
    `Format: ${format.id} v${format.version} (${format.displayName}). Beats in this exact order, each used by at least one scene:`,
    ...format.beats.map(
      (b) =>
        `  - ${b.id}: ${b.label}${b.requiresSource ? " (must cite at least one source id in sourceIds)" : ""}`,
    ),
    `Pacing: ${format.pacing.cutsPerMinute.min}-${format.pacing.cutsPerMinute.max} shots per minute, about ${shots.min}-${shots.max} shots for this duration; no shot longer than ${format.pacing.maxStaticSec} seconds of speech; two consecutive shots (also across scenes) never share the same shotSize.`,
    "Write 2-4 short spoken lines per scene. Each shot anchors to one line of the same scene (lineId) and cuts on one word that appears in that line (cutOnWord).",
    "",
    "Channel cast (character keys):",
    ...input.cast.map(
      (c) =>
        `  - ${c.characterKey} "${c.displayName}" (${c.role}${c.speaks ? "" : ", never speaks"}): ${c.personality}${c.catchphrases.length > 0 ? ` Catchphrases: ${c.catchphrases.join(" / ")}` : ""}`,
    ),
    `Speakers allowed: ${[...speakers, ...(format.allowNarrator ? [NARRATOR] : [])].join(", ")}. The speaker of a shot's anchor line must be one of that shot's actors${format.allowNarrator ? " (except narrator)" : ""}. Characters stay where they are; code decides positions.`,
    `A shot has 1-2 actors (actor1, actor2); a third actor (actor3) only when shotSize is ${SHOT_SIZES.filter((size) => MAX_ACTORS_BY_SHOT_SIZE[size] >= 3).join(" or ")}.`,
  );
  const companions = input.cast.filter((c) => c.speaks && c.role === "companion");
  if (companions.length > 0) {
    lines.push(
      `${companions.map((c) => c.characterKey).join(", ")} (companion) speaks rarely: only very short lines of a few words (reactions, jokes), never facts or numbers.`,
    );
  }
  if (input.toneRules.trim()) {
    lines.push(`Channel tone rules: ${input.toneRules.trim()}`);
  }
  lines.push("", "Approved assets you may use:", ...catalogLines(input.assetCatalog));
  if (input.mode === "creative") {
    lines.push(
      "",
      "Creative mode: if a scene really needs a pose, action, prop, background or camera move that the list lacks, add up to 5 assetRequests (id r1..r5, kind, Vietnamese description, sceneIds, fallbackAssetId = closest approved id of the same kind). Shots must still use approved ids only (use the fallback).",
    );
  }
  if (input.researchSources !== undefined && input.researchSources.length > 0) {
    lines.push(
      "",
      "Research sources (untrusted context; copy id, title, url into sources when cited):",
      ...input.researchSources.map((s) => `  - ${s.id}: ${s.title}${s.url ? ` <${s.url}>` : ""}`),
    );
  }
  if (input.researchSummary?.trim()) {
    lines.push("", "Research summary (untrusted context):", input.researchSummary.trim());
  }
  if (input.directorNote?.trim()) {
    lines.push(
      "",
      "Director change request for this rewrite (apply it to both variants):",
      input.directorNote.trim(),
    );
  }
  lines.push(
    "",
    'Output shape: { "variants": [ { title, sources, scenes, lines, shots' +
      (input.mode === "creative" ? ", assetRequests" : "") +
      " }, { … } ] }",
  );
  return lines.join("\n");
}

const str = (description?: string) => ({
  type: "string",
  ...(description === undefined ? {} : { description }),
});
const enumOf = (values: readonly string[], description?: string) => ({
  type: "string",
  enum: [...values],
  ...(description === undefined ? {} : { description }),
});

/**
 * JSON Schema gửi LLM (`responseJsonSchema`). Tối đa hai tầng mảng-chứa-object (variants → lines/shots),
 * id tài sản và key nhân vật là enum để model không bịa. Zod của contracts kiểm sau khi giải mã.
 */
export function scriptV2GenerationSchema(input: ScriptV2GenerationInput): Record<string, unknown> {
  const ids = (kinds: readonly string[]) =>
    input.assetCatalog.filter((a) => kinds.includes(a.kind)).map((a) => a.id);
  const characters = input.cast.map((c) => c.characterKey);
  const speakers = [
    ...input.cast.filter((c) => c.speaks).map((c) => c.characterKey),
    ...(input.format.allowNarrator ? [NARRATOR] : []),
  ];
  const expressions = ids(["expression"]);
  const actor = {
    type: "object",
    properties: {
      character: enumOf(characters),
      action: enumOf(ids(["action", "pose"])),
      expression: enumOf(expressions),
    },
    required: ["character", "action", "expression"],
  };
  const props = ids(["prop"]);
  const cameras = ids(["camera"]);
  const variant: Record<string, unknown> = {
    type: "object",
    properties: {
      title: str("1-80 ký tự"),
      sources: {
        type: "array",
        items: {
          type: "object",
          properties: { id: str(), title: str(), url: str() },
          required: ["id", "title"],
        },
      },
      scenes: {
        type: "array",
        minItems: 3,
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            id: str("^[a-z0-9-]{1,40}$"),
            beat: enumOf(input.format.beats.map((b) => b.id)),
            sourceIds: { type: "array", items: str() },
          },
          required: ["id", "beat", "sourceIds"],
        },
      },
      lines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sceneId: str(),
            id: str("l1, l2, … unique in the variant"),
            speaker: enumOf(speakers),
            text: str("1-300 ký tự, tiếng Việt"),
            ...(expressions.length > 0 ? { emotion: enumOf(expressions) } : {}),
          },
          required: ["sceneId", "id", "speaker", "text"],
        },
      },
      shots: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sceneId: str(),
            id: str("s1, s2, … unique in the variant"),
            lineId: str(),
            cutOnWord: str("one word of the anchor line"),
            background: enumOf(ids(["background"])),
            shotSize: enumOf(SHOT_SIZES),
            ...(cameras.length > 0 ? { camera: enumOf(cameras) } : {}),
            focus: enumOf(characters),
            actor1: actor,
            actor2: actor,
            actor3: actor,
            ...(props.length > 0
              ? { props: { type: "array", maxItems: 3, items: enumOf(props) } }
              : {}),
            ambience: { type: "array", maxItems: 3, items: enumOf(AMBIENCE_KINDS) },
          },
          required: [
            "sceneId",
            "id",
            "lineId",
            "cutOnWord",
            "background",
            "shotSize",
            "focus",
            "actor1",
          ],
        },
      },
      ...(input.mode === "creative"
        ? {
            assetRequests: {
              type: "array",
              maxItems: 5,
              items: {
                type: "object",
                properties: {
                  id: str("r1..r5"),
                  kind: enumOf(REQUESTABLE_ASSET_KINDS),
                  description: str(),
                  sceneIds: { type: "array", items: str() },
                  fallbackAssetId: str(),
                },
                required: ["id", "kind", "description", "sceneIds", "fallbackAssetId"],
              },
            },
          }
        : {}),
    },
    required: [
      "title",
      "sources",
      "scenes",
      "lines",
      "shots",
      ...(input.mode === "creative" ? ["assetRequests"] : []),
    ],
  };
  return {
    type: "object",
    properties: { variants: { type: "array", minItems: 2, maxItems: 2, items: variant } },
    required: ["variants"],
  };
}

type FlatVariant = {
  title?: unknown;
  sources?: unknown;
  scenes?: Array<Record<string, unknown> & { id?: unknown }>;
  lines?: Array<Record<string, unknown> & { sceneId?: unknown }>;
  shots?: Array<
    Record<string, unknown> & {
      sceneId?: unknown;
      actor1?: unknown;
      actor2?: unknown;
      actor3?: unknown;
    }
  >;
  assetRequests?: unknown;
};

/**
 * Giải mã dạng `flat` về script `2` lồng nhau, gắn hằng số (`schemaVersion`, `language`, gói).
 * Không sửa nội dung: dữ liệu sai vẫn đi tới Zod để lần repair biết lỗi.
 */
export function decodeFlatScriptV2(
  raw: unknown,
  format: Pick<FormatPack, "id" | "version">,
): unknown {
  const root = raw as { variants?: unknown };
  if (raw === null || typeof raw !== "object" || !Array.isArray(root.variants)) {
    return raw;
  }
  return {
    variants: root.variants.map((v) => {
      if (v === null || typeof v !== "object") {
        return v;
      }
      const variant = v as FlatVariant;
      const lines = Array.isArray(variant.lines) ? variant.lines : [];
      const shots = Array.isArray(variant.shots) ? variant.shots : [];
      const scenes = Array.isArray(variant.scenes) ? variant.scenes : [];
      return {
        schemaVersion: 2,
        language: "vi",
        formatId: format.id,
        formatVersion: format.version,
        title: variant.title,
        sources: variant.sources,
        ...(variant.assetRequests === undefined ? {} : { assetRequests: variant.assetRequests }),
        scenes: scenes.map((scene) => ({
          ...scene,
          lines: lines
            .filter((l) => l.sceneId === scene.id)
            .map(({ sceneId: _s, ...line }) => line),
          shots: shots
            .filter((s) => s.sceneId === scene.id)
            .map(({ sceneId: _s, actor1, actor2, actor3, ...shot }) => ({
              ...shot,
              actors: [actor1, actor2, actor3].filter((a) => a !== undefined && a !== null),
            })),
        })),
      };
    }),
  };
}
