import { z } from "zod/v4";

export const apiErrorCodeSchema = z.enum([
  "validation_error",
  "unauthorized",
  "not_found",
  "conflict",
  "invalid_transition",
  "approval_required",
  "payload_too_large",
  "cost_ceiling",
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional().default({}),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
