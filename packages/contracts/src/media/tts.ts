import { z } from "zod/v4";

const artifactIdSchema = z
  .string()
  .regex(/^[a-f0-9]{32}$/, "artifact id must be 32 lowercase hex characters");

export const synthesizeRequestSchema = z.object({
  text: z.string().min(1).max(10_000),
  voiceId: z.string().min(1).optional(),
});

export const synthesizeResponseSchema = z.object({
  artifactId: artifactIdSchema,
  relativePath: z.string().min(1),
  durationSeconds: z.number().positive(),
  sampleRate: z.number().int().positive(),
  inferenceSeconds: z.number().nonnegative(),
  rtf: z.number().nonnegative(),
  backend: z.string().min(1),
  model: z.string().min(1),
  voiceId: z.string().min(1),
});

export const alignmentEngineSchema = z.enum(["whisper", "ctc"]);

export const alignRequestSchema = z.object({
  audioArtifactId: artifactIdSchema,
  transcript: z.string().min(1).max(50_000),
  engine: alignmentEngineSchema.optional(),
});

export const alignmentWordSchema = z.object({
  text: z.string(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
});

export const alignmentValidationSchema = z.object({
  ok: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  wordCount: z.number().int().nonnegative(),
  alignedWordCount: z.number().int().nonnegative(),
  missingWords: z.array(z.string()),
  coverageStartMs: z.number().int().nullable(),
  coverageEndMs: z.number().int().nullable(),
  durationDeltaMs: z.number().int().nullable(),
  /** @deprecated Use timelineOrderRatio; kept for spike JSON compatibility */
  nonMonotonicWordRatio: z.number().nullable(),
  timelineOrderRatio: z.number().nullable(),
});

export const alignmentGateSchema = z.object({
  alignedWordRatio: z.number(),
  durationDeltaMs: z.number().int().nullable(),
  coverageWithin250Ms: z.boolean(),
  ratioAtLeast90Pct: z.boolean(),
  validationOk: z.boolean(),
  passesGate: z.boolean(),
});

export const alignResponseSchema = z.object({
  alignmentArtifactId: artifactIdSchema,
  audioArtifactId: artifactIdSchema,
  durationMs: z.number().int().positive(),
  transcript: z.string(),
  engine: alignmentEngineSchema,
  modelId: z.string().min(1),
  words: z.array(alignmentWordSchema),
  validation: alignmentValidationSchema,
  gate: alignmentGateSchema,
  processingMs: z.number().int().nonnegative(),
});

export const ttsErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

export type SynthesizeRequest = z.infer<typeof synthesizeRequestSchema>;
export type SynthesizeResponse = z.infer<typeof synthesizeResponseSchema>;
export type AlignRequest = z.infer<typeof alignRequestSchema>;
export type AlignResponse = z.infer<typeof alignResponseSchema>;
export type AlignmentWord = z.infer<typeof alignmentWordSchema>;
export type AlignmentValidation = z.infer<typeof alignmentValidationSchema>;
