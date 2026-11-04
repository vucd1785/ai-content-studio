import { z } from "zod/v4";

/**
 * Shape compatible with `@remotion/captions` `Caption` (see docs/05-VIDEO-PIPELINE.md).
 * `timestampMs` is the highlight instant; word-level captions use the same value as `startMs`.
 */
export const remotionCaptionSchema = z.object({
  text: z.string(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  timestampMs: z.number().int().nonnegative().nullable(),
  confidence: z.number().nullable(),
  /** Script `2`: `character_key` hoặc `narrator` của câu. */
  speaker: z.string().min(1).max(32).optional(),
});

export type RemotionCaption = z.infer<typeof remotionCaptionSchema>;
