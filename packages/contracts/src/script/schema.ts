import { z } from "zod/v4";

/**
 * Nguồn trích dẫn của kịch bản (script `2`, 05 mục Script JSON v2). Schema script `1` đã xóa theo
 * ADR-013 bổ sung (2) ngày 2026-11-03.
 */
export const scriptSourceSchema = z
  .object({
    id: z.string().min(1).max(40),
    title: z.string().min(1).max(200),
    url: z.url().optional(),
  })
  .strict();

export type ScriptSource = z.infer<typeof scriptSourceSchema>;
