import type { ScriptV2, ScriptV2SchemaOptions } from "@studio/contracts";
import { z } from "zod/v4";
import type { ScriptV2GenerationInput } from "./script-v2-prompt.js";

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
  /** `claude-code`: gói thuê bao qua Claude Code CLI (ADR-007, bổ sung 2026-11-02), chi phí 0. */
  provider: "gemini" | "claude-code";
  model: string;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
};

export type ScriptV2GenerationResult = {
  variants: [ScriptV2, ScriptV2];
  usage: LlmUsage[];
  repairCount: number;
};

export type StructuredLlmAdapter = {
  /**
   * Script `2` có shot list (P6-10): một lần gọi cho hai phương án, repair tối đa một lần.
   * `schema` là `ScriptV2SchemaOptions` của kênh, gói và chế độ (contracts kiểm sau khi giải mã).
   * Script `1` đã xóa (ADR-013 bổ sung (2) 2026-11-03).
   */
  generateScriptV2Variants(
    input: ScriptV2GenerationInput,
    schema: ScriptV2SchemaOptions,
  ): Promise<ScriptV2GenerationResult>;
};
