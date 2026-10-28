import { type Script, scriptSchema } from "@studio/contracts";
import { z } from "zod/v4";

/** Kịch bản do LLM sinh: thêm ràng buộc nguồn theo docs/05-VIDEO-PIPELINE.md. */
export const llmScriptSchema = scriptSchema.superRefine((data, ctx) => {
  if (data.sources.length < 1) {
    ctx.addIssue({
      code: "custom",
      message: "LLM script must include at least one source",
      path: ["sources"],
    });
  }
});

export const scriptVariantsPayloadSchema = z
  .object({
    variants: z.tuple([llmScriptSchema, llmScriptSchema]),
  })
  .strict();

export type ScriptVariantsPayload = z.infer<typeof scriptVariantsPayloadSchema>;

export function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export function assertScriptTuple(variants: Script[]): asserts variants is [Script, Script] {
  if (variants.length !== 2) {
    throw new Error("expected exactly two script variants");
  }
}
