import { z } from "zod/v4";
import type { FormatPack } from "../formats/packs.js";
import { scriptSourceSchema } from "./schema.js";
import { normalizedWords, normalizeWord } from "./words.js";

/**
 * Script JSON `2` (05 mục Script JSON v2; ADR-013, 014, 015, 016). Schema phụ thuộc kênh và kho
 * tài sản, nên đây là hàm dựng schema thay vì một hằng số.
 * ADR-014 bổ sung 2026-11-03: không có `onScreenText` của shot và `board` của cảnh; video chỉ có
 * hoạt hình và phụ đề lời thoại. Object `.strict()` nên LLM trả hai trường này thì bị từ chối.
 */

export const NARRATOR = "narrator";

export const MOTION_ASSET_KINDS = [
  "character_skin",
  "expression",
  "pose",
  "action",
  "background",
  "prop",
  "camera",
  "sfx",
  "brand_card",
] as const;
export type MotionAssetKind = (typeof MOTION_ASSET_KINDS)[number];

export const SHOT_SIZES = ["wide", "medium", "close", "high"] as const;
export type ShotSize = (typeof SHOT_SIZES)[number];

/**
 * Số nhân vật tối đa trong một shot theo cỡ khung (bổ sung ADR-013 ngày 2026-11-03): ba người chỉ ở
 * `wide` và `high`; `medium`, `close` tối đa hai để không ai bị mép khung cắt.
 */
export const MAX_ACTORS_BY_SHOT_SIZE: Record<ShotSize, number> = {
  wide: 3,
  high: 3,
  medium: 2,
  close: 2,
};

export const AMBIENCE_KINDS = ["vignette", "dust", "foreground_blur"] as const;

/** Kind mà yêu cầu tài sản của chế độ `creative` được xin; lớp da và thẻ kênh do Director mở task. */
export const REQUESTABLE_ASSET_KINDS = MOTION_ASSET_KINDS.filter(
  (k) => k !== "character_skin" && k !== "brand_card",
);

export type CastMember = { characterKey: string; speaks: boolean };
export type CatalogAsset = { id: string; kind: MotionAssetKind };
export type CreativeMode = "standard" | "creative";

export type ScriptV2SchemaOptions = {
  /** `brand_characters` của kênh. */
  cast: readonly CastMember[];
  /** Tài sản được phép dùng; chế độ `standard` chỉ truyền tài sản `approved`. */
  assetCatalog: readonly CatalogAsset[];
  format: FormatPack;
  mode: CreativeMode;
};

const assetIdSchema = z.string().regex(/^[a-z0-9_]{1,64}$/);
const characterKeySchema = z.string().regex(/^[a-z0-9_]{1,32}$/);

const lineSchema = z
  .object({
    id: z.string().regex(/^l[0-9]{1,3}$/),
    speaker: characterKeySchema,
    text: z.string().min(1).max(300),
    emotion: assetIdSchema.optional(),
  })
  .strict();

const actorSchema = z
  .object({ character: characterKeySchema, action: assetIdSchema, expression: assetIdSchema })
  .strict();

const shotSchema = z
  .object({
    id: z.string().regex(/^s[0-9]{1,3}$/),
    lineId: z.string().regex(/^l[0-9]{1,3}$/),
    cutOnWord: z.string().min(1).max(40),
    background: assetIdSchema,
    shotSize: z.enum(SHOT_SIZES),
    camera: assetIdSchema.optional(),
    focus: characterKeySchema,
    actors: z.array(actorSchema).min(1).max(3),
    props: z.array(assetIdSchema).max(3).optional(),
    ambience: z.array(z.enum(AMBIENCE_KINDS)).max(3).optional(),
  })
  .strict();

const sceneV2Schema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,40}$/),
    beat: z.string().regex(/^[a-z0-9_]{1,32}$/),
    sourceIds: z.array(z.string().min(1).max(40)),
    lines: z.array(lineSchema).min(1).max(6),
    shots: z.array(shotSchema).min(1).max(8),
  })
  .strict();

const assetRequestSchema = z
  .object({
    id: z.string().regex(/^r[0-9]{1,2}$/),
    kind: z.enum(REQUESTABLE_ASSET_KINDS as [string, ...string[]]),
    description: z.string().min(1).max(300),
    sceneIds: z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).min(1),
    fallbackAssetId: assetIdSchema,
  })
  .strict();

const baseShape = {
  schemaVersion: z.literal(2),
  language: z.literal("vi"),
  formatId: z.string().regex(/^[a-z0-9_]{1,32}$/),
  formatVersion: z.number().int().min(1),
  title: z.string().min(1).max(80),
  scenes: z.array(sceneV2Schema).min(3).max(8),
  sources: z.array(scriptSourceSchema),
};

export type ScriptV2Line = z.infer<typeof lineSchema>;
export type ScriptV2Shot = z.infer<typeof shotSchema>;
export type ScriptV2Scene = z.infer<typeof sceneV2Schema>;
export type AssetRequest = z.infer<typeof assetRequestSchema>;
export type ScriptV2 = z.infer<z.ZodObject<typeof baseShape>> & { assetRequests?: AssetRequest[] };

type Issue = { message: string; path: (string | number)[] };

/** Kiểm ngữ nghĩa sau Zod; mỗi lỗi kèm đường dẫn để lần repair của LLM biết sửa chỗ nào. */
export function checkScriptV2Semantics(script: ScriptV2, opts: ScriptV2SchemaOptions): Issue[] {
  const issues: Issue[] = [];
  const add = (message: string, path: (string | number)[]) => issues.push({ message, path });
  const { format, mode } = opts;
  const cast = new Map(opts.cast.map((c) => [c.characterKey, c]));
  const catalog = new Map(opts.assetCatalog.map((a) => [a.id, a.kind]));
  const needAsset = (
    id: string | undefined,
    kinds: readonly MotionAssetKind[],
    path: (string | number)[],
  ) => {
    if (id === undefined) {
      return;
    }
    const kind = catalog.get(id);
    if (kind === undefined) {
      add(`Tài sản không có trong kho: ${id}`, path);
    } else if (!kinds.includes(kind)) {
      add(`Tài sản ${id} là ${kind}, cần ${kinds.join(" hoặc ")}`, path);
    }
  };

  if (script.formatId !== format.id || script.formatVersion !== format.version) {
    add(`Script phải dùng gói ${format.id} v${format.version}`, ["formatId"]);
  }

  const sourceIds = new Set(script.sources.map((s) => s.id));
  const beatIndex = new Map(format.beats.map((b, i) => [b.id, i]));
  const seenBeats = new Set<string>();
  const sceneIds = new Set<string>();
  const lineIds = new Set<string>();
  const shotIds = new Set<string>();
  let lastBeat = -1;
  let prevShotSize: ShotSize | undefined;

  script.scenes.forEach((scene, si) => {
    const sp = ["scenes", si];
    if (sceneIds.has(scene.id)) {
      add(`Scene id trùng: ${scene.id}`, [...sp, "id"]);
    }
    sceneIds.add(scene.id);

    const bi = beatIndex.get(scene.beat);
    if (bi === undefined) {
      add(`Nhịp không thuộc gói ${format.id}: ${scene.beat}`, [...sp, "beat"]);
    } else {
      if (bi < lastBeat) {
        add(`Nhịp ${scene.beat} sai thứ tự của gói`, [...sp, "beat"]);
      }
      lastBeat = Math.max(lastBeat, bi);
      seenBeats.add(scene.beat);
      const beat = format.beats[bi];
      if (beat?.requiresSource && scene.sourceIds.length === 0) {
        add(`Nhịp ${scene.beat} cần ít nhất một nguồn`, [...sp, "sourceIds"]);
      }
    }
    scene.sourceIds.forEach((id, i) => {
      if (!sourceIds.has(id)) {
        add(`Nguồn không có trong sources: ${id}`, [...sp, "sourceIds", i]);
      }
    });

    const sceneLines = new Map<string, ScriptV2Line>();
    scene.lines.forEach((line, li) => {
      const lp = [...sp, "lines", li];
      if (lineIds.has(line.id)) {
        add(`Line id trùng: ${line.id}`, [...lp, "id"]);
      }
      lineIds.add(line.id);
      sceneLines.set(line.id, line);
      if (line.speaker === NARRATOR) {
        if (!format.allowNarrator) {
          add(`Gói ${format.id} không có người dẫn chuyện`, [...lp, "speaker"]);
        }
      } else {
        const member = cast.get(line.speaker);
        if (member === undefined) {
          add(`Người nói không thuộc kênh: ${line.speaker}`, [...lp, "speaker"]);
        } else if (!member.speaks) {
          add(`Nhân vật ${line.speaker} không nói`, [...lp, "speaker"]);
        }
      }
      needAsset(line.emotion, ["expression"], [...lp, "emotion"]);
    });

    scene.shots.forEach((shot, hi) => {
      const hp = [...sp, "shots", hi];
      if (shotIds.has(shot.id)) {
        add(`Shot id trùng: ${shot.id}`, [...hp, "id"]);
      }
      shotIds.add(shot.id);

      const line = sceneLines.get(shot.lineId);
      if (line === undefined) {
        add(`lineId ${shot.lineId} không thuộc cảnh ${scene.id}`, [...hp, "lineId"]);
      } else {
        const word = normalizeWord(shot.cutOnWord);
        if (word === "" || !normalizedWords(line.text).includes(word)) {
          add(`cutOnWord "${shot.cutOnWord}" không có trong câu ${line.id}`, [...hp, "cutOnWord"]);
        }
        if (line.speaker !== NARRATOR && !shot.actors.some((a) => a.character === line.speaker)) {
          add(`Người nói ${line.speaker} phải có mặt trong shot`, [...hp, "actors"]);
        }
      }

      if (format.pacing.noSameShotSizeInARow && prevShotSize === shot.shotSize) {
        add(`Hai shot liền nhau cùng cỡ cảnh ${shot.shotSize}`, [...hp, "shotSize"]);
      }
      prevShotSize = shot.shotSize;

      needAsset(shot.background, ["background"], [...hp, "background"]);
      needAsset(shot.camera, ["camera"], [...hp, "camera"]);
      (shot.props ?? []).forEach((id, i) => {
        needAsset(id, ["prop"], [...hp, "props", i]);
      });

      const inShot = new Set<string>();
      shot.actors.forEach((actor, ai) => {
        const ap = [...hp, "actors", ai];
        if (!cast.has(actor.character)) {
          add(`Nhân vật không thuộc kênh: ${actor.character}`, [...ap, "character"]);
        }
        if (inShot.has(actor.character)) {
          add(`Nhân vật ${actor.character} lặp trong shot`, [...ap, "character"]);
        }
        inShot.add(actor.character);
        needAsset(actor.action, ["action", "pose"], [...ap, "action"]);
        needAsset(actor.expression, ["expression"], [...ap, "expression"]);
      });
      const maxActors = MAX_ACTORS_BY_SHOT_SIZE[shot.shotSize];
      if (shot.actors.length > maxActors) {
        add(`Cỡ ${shot.shotSize} có tối đa ${maxActors} nhân vật`, [...hp, "actors"]);
      }
      if (!inShot.has(shot.focus)) {
        add(`focus ${shot.focus} phải là một nhân vật trong shot`, [...hp, "focus"]);
      }
    });
  });

  format.beats.forEach((beat) => {
    if (!seenBeats.has(beat.id)) {
      add(`Thiếu nhịp ${beat.id} của gói ${format.id}`, ["scenes"]);
    }
  });

  if (mode === "creative") {
    const requestIds = new Set<string>();
    (script.assetRequests ?? []).forEach((req, ri) => {
      const rp = ["assetRequests", ri];
      if (requestIds.has(req.id)) {
        add(`Yêu cầu tài sản trùng id: ${req.id}`, [...rp, "id"]);
      }
      requestIds.add(req.id);
      req.sceneIds.forEach((id, i) => {
        if (!sceneIds.has(id)) {
          add(`Cảnh không tồn tại: ${id}`, [...rp, "sceneIds", i]);
        }
      });
      needAsset(req.fallbackAssetId, [req.kind as MotionAssetKind], [...rp, "fallbackAssetId"]);
    });
  }
  return issues;
}

/**
 * Schema Zod của script `2` cho một kênh, một gói và một chế độ.
 * Chế độ `standard` không có `assetRequests`; `creative` có 0–5 yêu cầu.
 */
export function scriptV2Schema(opts: ScriptV2SchemaOptions) {
  const shape =
    opts.mode === "creative"
      ? { ...baseShape, assetRequests: z.array(assetRequestSchema).max(5) }
      : baseShape;
  return z
    .object(shape)
    .strict()
    .superRefine((script, ctx) => {
      for (const issue of checkScriptV2Semantics(script as ScriptV2, opts)) {
        ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
      }
    });
}

/** Artifact `script` với `schemaVersion` 2: đúng hai phương án (quyết định 6). */
export function scriptV2ArtifactSchema(opts: ScriptV2SchemaOptions) {
  const script = scriptV2Schema(opts);
  return z.object({ variants: z.tuple([script, script]) }).strict();
}
