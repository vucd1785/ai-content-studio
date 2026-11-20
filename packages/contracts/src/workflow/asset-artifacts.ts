import { z } from "zod/v4";
import { alignResponseSchema } from "../media/tts.js";

/**
 * Artifact do hai job sau cổng script tạo ra (P3-05, 05-VIDEO-PIPELINE).
 * Cả hai đều ghi rõ phương án đã duyệt (`variantIndex`, quyết định 6) và artifact script nguồn.
 */

const variantIndexSchema = z.union([z.literal(1), z.literal(2)]);

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
    scenes: z
      .array(z.object({ sceneId: z.string().min(1), alignment: alignResponseSchema }).strict())
      .min(1),
  })
  .strict();

export type AlignmentArtifact = z.infer<typeof alignmentArtifactSchema>;

/** Mã QA trước cổng final (05-VIDEO-PIPELINE mục QA). */
export const qaCheckCodeSchema = z.enum([
  "schema_invalid",
  "audio_missing",
  "duration_out_of_range",
  "caption_gap",
  "frame_size_mismatch",
  "low_alignment_confidence",
  "research_stale",
  "long_silence",
  // ADR-020: QA hình trên mọi shot của bản cuối (cùng luật hình học với storyboard), chỉ cảnh báo.
  "visual_unsafe_area",
  "visual_overlap",
]);

/** `qa_report` của một preview. `passed` là true khi không có check `error`. QA không ghi approval. */
export const qaReportArtifactSchema = z
  .object({
    schemaVersion: z.literal(1),
    previewArtifactId: z.uuid(),
    passed: z.boolean(),
    checks: z.array(
      z
        .object({
          code: qaCheckCodeSchema,
          severity: z.enum(["error", "warning"]),
          message: z.string().min(1).max(500),
        })
        .strict(),
    ),
  })
  .strict()
  .refine(
    (report) => report.passed === !report.checks.some((check) => check.severity === "error"),
    {
      message: "passed phải bằng việc không có check error",
      path: ["passed"],
    },
  );

export type QaReportArtifact = z.infer<typeof qaReportArtifactSchema>;
export type QaCheckCode = z.infer<typeof qaCheckCodeSchema>;
