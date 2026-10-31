import { z } from "zod/v4";

export const sessionLoginBodySchema = z.object({
  password: z.string().min(1).max(1024),
});

export type SessionLoginBody = z.infer<typeof sessionLoginBodySchema>;

export const sessionStatusResponseSchema = z.object({
  authenticated: z.boolean(),
});

export type SessionStatusResponse = z.infer<typeof sessionStatusResponseSchema>;
