import type { Script } from "@studio/contracts";
import { z } from "zod/v4";

export const briefInputSchema = z
  .object({
    topic: z.string().min(1).max(500),
    audience: z.string().min(1).max(500),
    goal: z.string().min(1).max(500),
    durationSec: z.number().int().min(30).max(90),
    language: z.literal("vi"),
    tone: z.string().min(1).max(200),
    visualStyle: z.string().min(1).max(200),
    notes: z.string().max(4000).optional(),
  })
  .strict();

export type BriefInput = z.infer<typeof briefInputSchema>;

export type LlmUsage = {
  provider: "gemini";
  model: string;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
};

export type ScriptGenerationInput = {
  brief: BriefInput;
  /** Tóm tắt research tùy chọn (Phase 3+); MVP có thể rỗng. */
  researchSummary?: string;
};

export type ScriptGenerationResult = {
  variants: [Script, Script];
  usage: LlmUsage[];
  repairCount: number;
};

export type StructuredLlmAdapter = {
  generateScriptVariants(input: ScriptGenerationInput): Promise<ScriptGenerationResult>;
};
