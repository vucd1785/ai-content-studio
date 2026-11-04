import { z } from "zod/v4";
import { DEFAULT_FORMAT, getFormatPack } from "../formats/packs.js";

export const uuidParamSchema = z.string().uuid();

export const projectSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Project = z.infer<typeof projectSchema>;

/** Một dòng danh sách dự án: kèm run mới nhất để trang dự án biết việc nào chờ Director (P2-11). */
export const projectListItemSchema = projectSchema.extend({
  latestRun: z
    .object({ id: z.string().uuid(), status: z.string(), updatedAt: z.string() })
    .nullable()
    .default(null),
});

export type ProjectListItem = z.infer<typeof projectListItemSchema>;

export const projectListResponseSchema = z.object({
  projects: z.array(projectListItemSchema),
});

export const projectCreateBodySchema = z.object({
  title: z.string().min(1).max(200),
});

export const projectPatchBodySchema = z.object({
  title: z.string().min(1).max(200),
});

const briefFieldsSchema = z.object({
  topic: z.string().min(1).max(2000),
  audience: z.string().min(1).max(2000),
  goal: z.string().min(1).max(2000),
  /** Giới hạn an toàn như CHECK của DB; khoảng thật theo gói `story` (kiểm bên dưới). */
  durationSec: z.number().int().min(10).max(600),
  language: z.literal("vi"),
  tone: z.string().min(1).max(2000),
  visualStyle: z.string().min(1).max(2000),
  notes: z.string().max(8000).optional(),
});

/**
 * Body ghi brief. Client không chọn thể loại (ADR-013 bổ sung (2)): API luôn ghi `DEFAULT_FORMAT` (`story` v1),
 * nên thời lượng kiểm theo gói đó (30–90 giây). Trường lạ như `formatId` bị bỏ qua.
 */
export const briefWriteBodySchema = briefFieldsSchema.superRefine((body, ctx) => {
  const pack = getFormatPack(DEFAULT_FORMAT.id, DEFAULT_FORMAT.version);
  if (
    pack !== undefined &&
    (body.durationSec < pack.durationSec.min || body.durationSec > pack.durationSec.max)
  ) {
    ctx.addIssue({
      code: "custom",
      message: `Thời lượng của ${pack.displayName} là ${pack.durationSec.min}–${pack.durationSec.max} giây`,
      path: ["durationSec"],
    });
  }
});

export type BriefWriteBody = z.infer<typeof briefWriteBodySchema>;

/** Brief đã lưu: brief cũ có thể là gói `what_if`; brief mới là `story`. */
export const briefSchema = briefFieldsSchema.extend({
  formatId: z.string().min(1),
  formatVersion: z.number().int().min(1).default(1),
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
