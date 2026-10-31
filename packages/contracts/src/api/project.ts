import { z } from "zod/v4";

export const uuidParamSchema = z.string().uuid();

export const projectSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Project = z.infer<typeof projectSchema>;

export const projectListResponseSchema = z.object({
  projects: z.array(projectSchema),
});

export const projectCreateBodySchema = z.object({
  title: z.string().min(1).max(200),
});

export const projectPatchBodySchema = z.object({
  title: z.string().min(1).max(200),
});

export const briefWriteBodySchema = z.object({
  topic: z.string().min(1).max(2000),
  audience: z.string().min(1).max(2000),
  goal: z.string().min(1).max(2000),
  durationSec: z.number().int().min(30).max(90),
  language: z.literal("vi"),
  tone: z.string().min(1).max(2000),
  visualStyle: z.string().min(1).max(2000),
  notes: z.string().max(8000).optional(),
});

export type BriefWriteBody = z.infer<typeof briefWriteBodySchema>;

export const briefSchema = briefWriteBodySchema.extend({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  createdAt: z.string(),
});

export type Brief = z.infer<typeof briefSchema>;

export const workflowRunSummarySchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const referenceResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  kind: z.enum(["user_file", "user_url"]),
  title: z.string().nullable(),
  mediaType: z.string().nullable(),
  byteSize: z.number().int().nullable(),
  createdAt: z.string(),
});

export type ReferenceResponse = z.infer<typeof referenceResponseSchema>;

export const projectDetailResponseSchema = z.object({
  project: projectSchema,
  brief: briefSchema.nullable(),
  workflowRun: workflowRunSummarySchema.nullable(),
  references: z.array(referenceResponseSchema),
});

export const referenceJsonBodySchema = z.object({
  url: z.url({ protocol: /^https?$/ }).max(2048),
  title: z.string().max(200).optional(),
});

export type ReferenceJsonBody = z.infer<typeof referenceJsonBodySchema>;

export const projectIdParamsSchema = z.object({
  projectId: uuidParamSchema,
});

export const referenceIdParamsSchema = z.object({
  projectId: uuidParamSchema,
  referenceId: uuidParamSchema,
});
