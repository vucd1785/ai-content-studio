import { z } from "zod/v4";
import { SCENE_EDGE_PAD_MS } from "../timing/constants.js";
import type { RemotionCaption } from "./types.js";

export type CaptionOverrideErrorCode =
  | "unknown_scene"
  | "unknown_word_index"
  | "invalid_interval"
  | "non_monotonic_timestamps"
  | "word_outside_scene_bounds";

export class CaptionOverrideError extends Error {
  readonly code: CaptionOverrideErrorCode;

  constructor(code: CaptionOverrideErrorCode, message: string) {
    super(message);
    this.name = "CaptionOverrideError";
    this.code = code;
  }
}

const captionTimingMsSchema = z
  .number()
  .refine(Number.isFinite, "timestamp must be finite")
  .transform((value) => Math.round(value))
  .pipe(z.number().int().nonnegative());

export const captionTimingOverrideEntrySchema = z
  .object({
    sceneId: z.string().min(1),
    wordIndex: z.number().int().nonnegative(),
    startMs: captionTimingMsSchema,
    endMs: captionTimingMsSchema,
  })
  .refine((entry) => entry.endMs > entry.startMs, {
    message: "endMs must be greater than startMs",
  });

export const captionTimingOverrideSchema = z
  .object({
    schemaVersion: z.literal(1),
    overrides: z.array(captionTimingOverrideEntrySchema).min(1),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    for (let index = 0; index < value.overrides.length; index += 1) {
      const entry = value.overrides[index];
      if (!entry) {
        continue;
      }
      const key = `${entry.sceneId}\0${entry.wordIndex}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate override for sceneId=${entry.sceneId} wordIndex=${entry.wordIndex}`,
          path: ["overrides", index],
        });
      }
      seen.add(key);
    }
  });

export type CaptionTimingOverrideEntry = z.infer<typeof captionTimingOverrideEntrySchema>;
export type CaptionTimingOverride = z.infer<typeof captionTimingOverrideSchema>;

export function parseCaptionTimingOverride(raw: unknown): CaptionTimingOverride {
  return captionTimingOverrideSchema.parse(raw);
}

export type CaptionOverrideSceneContext = {
  sceneId: string;
  fromMs: number;
  durationMs: number;
  measuredDurationMs: number;
  wordCount: number;
};

export type ApplyCaptionOverrideContext = {
  scenes: CaptionOverrideSceneContext[];
};

function resolveGlobalCaptionIndex(
  scenes: CaptionOverrideSceneContext[],
  sceneId: string,
  wordIndex: number,
): number {
  let offset = 0;
  let foundScene = false;
  for (const scene of scenes) {
    if (scene.sceneId === sceneId) {
      foundScene = true;
      if (wordIndex >= scene.wordCount) {
        throw new CaptionOverrideError(
          "unknown_word_index",
          `wordIndex ${wordIndex} out of range for scene ${sceneId} (${scene.wordCount} words)`,
        );
      }
      return offset + wordIndex;
    }
    offset += scene.wordCount;
  }
  if (!foundScene) {
    throw new CaptionOverrideError("unknown_scene", `Unknown sceneId: ${sceneId}`);
  }
  return offset + wordIndex;
}

function assertCaptionInterval(caption: RemotionCaption, label: string): void {
  if (caption.endMs <= caption.startMs) {
    throw new CaptionOverrideError(
      "invalid_interval",
      `Invalid interval for ${label}: endMs must exceed startMs`,
    );
  }
}

function assertCaptionsMonotonic(captions: RemotionCaption[]): void {
  let prevEnd = -1;
  for (let index = 0; index < captions.length; index += 1) {
    const caption = captions[index];
    if (caption === undefined) {
      continue;
    }
    assertCaptionInterval(caption, `caption[${index}]`);
    if (caption.startMs < prevEnd) {
      throw new CaptionOverrideError(
        "non_monotonic_timestamps",
        `Overlapping or out-of-order at caption index ${index}`,
      );
    }
    prevEnd = Math.max(prevEnd, caption.endMs);
  }
}

function assertOverrideWithinSceneBounds(
  scene: CaptionOverrideSceneContext,
  startMs: number,
  endMs: number,
  label: string,
): void {
  const audioOffsetMs = scene.fromMs + SCENE_EDGE_PAD_MS;
  const sceneEndMs = scene.fromMs + scene.durationMs;
  const audioEndMs = audioOffsetMs + scene.measuredDurationMs;

  if (startMs < audioOffsetMs) {
    throw new CaptionOverrideError(
      "word_outside_scene_bounds",
      `${label}: startMs ${startMs} before scene audio offset ${audioOffsetMs}`,
    );
  }
  if (endMs > sceneEndMs) {
    throw new CaptionOverrideError(
      "word_outside_scene_bounds",
      `${label}: endMs ${endMs} after scene end ${sceneEndMs}`,
    );
  }
  if (endMs > audioEndMs) {
    throw new CaptionOverrideError(
      "word_outside_scene_bounds",
      `${label}: endMs ${endMs} after scene audio end ${audioEndMs}`,
    );
  }
}

/**
 * Applies validated timing overrides to mapped captions without mutating the input array.
 */
export function applyCaptionOverride(
  captions: RemotionCaption[],
  override: CaptionTimingOverride,
  context: ApplyCaptionOverrideContext,
): RemotionCaption[] {
  const sceneById = new Map(context.scenes.map((scene) => [scene.sceneId, scene]));
  const next = captions.map((caption) => ({ ...caption }));

  for (const entry of override.overrides) {
    const scene = sceneById.get(entry.sceneId);
    if (!scene) {
      throw new CaptionOverrideError("unknown_scene", `Unknown sceneId: ${entry.sceneId}`);
    }

    const globalIndex = resolveGlobalCaptionIndex(context.scenes, entry.sceneId, entry.wordIndex);
    const current = next[globalIndex];
    if (current === undefined) {
      throw new CaptionOverrideError(
        "unknown_word_index",
        `Missing caption at global index ${globalIndex} for ${entry.sceneId}[${entry.wordIndex}]`,
      );
    }

    assertOverrideWithinSceneBounds(
      scene,
      entry.startMs,
      entry.endMs,
      `${entry.sceneId}[${entry.wordIndex}]`,
    );

    next[globalIndex] = {
      ...current,
      startMs: entry.startMs,
      endMs: entry.endMs,
      timestampMs: entry.startMs,
    };
  }

  assertCaptionsMonotonic(next);
  return next;
}
