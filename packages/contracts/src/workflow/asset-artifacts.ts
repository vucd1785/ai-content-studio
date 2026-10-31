import { z } from "zod/v4";
import { alignResponseSchema } from "../media/tts.js";
import { sceneSchema } from "../script/schema.js";

/**
 * Artifact do hai job sau cổng script tạo ra (P3-05, 05-VIDEO-PIPELINE).
 * Cả hai đều ghi rõ phương án đã duyệt (`variantIndex`, quyết định 6) và artifact script nguồn.
 */

const variantIndexSchema = z.union([z.literal(1), z.literal(2)]);

/** `storyboard`: hình từng `sceneId` (slot, chữ trên màn hình, code hoặc diagram). Chưa có duration cuối. */
export const storyboardArtifactSchema = z
  .object({
    schemaVersion: z.literal(1),
    scriptArtifactId: z.uuid(),
    variantIndex: variantIndexSchema,
    title: z.string().min(1).max(80),
    hook: z.string().min(1).max(400),
    cta: z.string().min(1).max(240),
    scenes: z.array(sceneSchema).min(3).max(8),
  })
  .strict();

export type StoryboardArtifact = z.infer<typeof storyboardArtifactSchema>;

/** `audio`: danh sách WAV từng cảnh do TTS trả về, kèm duration ffprobe. File WAV nằm trong volume TTS. */
export const audioManifestArtifactSchema = z
  .object({
    schemaVersion: z.literal(1),
    scriptArtifactId: z.uuid(),
    variantIndex: variantIndexSchema,
    voiceId: z.string().min(1),
    scenes: z
      .array(
        z
          .object({
            sceneId: z.string().min(1),
            wavArtifactId: z.string().min(1),
            measuredDurationMs: z.number().int().positive(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export type AudioManifestArtifact = z.infer<typeof audioManifestArtifactSchema>;

/** `alignment`: response gốc của service align cho từng cảnh (ADR-011). */
export const alignmentArtifactSchema = z
  .object({
    schemaVersion: z.literal(1),
    scenes: z.array(z.object({ sceneId: z.string().min(1), alignment: alignResponseSchema }).strict()).min(1),
  })
  .strict();

export type AlignmentArtifact = z.infer<typeof alignmentArtifactSchema>;
