import type { z } from "zod/v4";
import { LlmError } from "./errors.js";
import { formatZodIssues } from "./script-schema.js";
import type { LlmUsage } from "./types.js";

export type StructuredGenerateRequest = {
  systemInstruction: string;
  userPrompt: string;
  /** JSON Schema object for Gemini responseSchema when supported. */
  responseJsonSchema?: Record<string, unknown>;
  model: string;
  thinkingBudget: number;
};

export type StructuredGenerateResponse = {
  /** Raw JSON text from the model. */
  jsonText: string;
  usage: LlmUsage;
};

export type StructuredGenerateClient = {
  generateStructured(request: StructuredGenerateRequest): Promise<StructuredGenerateResponse>;
};

export type GenerateWithRepairResult<T> = {
  data: T;
  usage: LlmUsage[];
  repairCount: number;
};

const MAX_REPAIR_ATTEMPTS = 1;

function parseJsonText(jsonText: string): unknown {
  const trimmed = jsonText.trim();
  if (!trimmed) {
    throw new LlmError("schema_invalid", "Model returned empty JSON");
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new LlmError("schema_invalid", `Model JSON parse failed: ${detail}`);
  }
}

/**
 * Gọi provider, validate Zod, tối đa một lần repair (ADR-007 / docs/04-AGENT-ORCHESTRATION.md).
 */
export async function generateWithSchemaRepair<T>(
  schema: z.ZodType<T>,
  client: StructuredGenerateClient,
  baseRequest: Omit<StructuredGenerateRequest, "userPrompt"> & { userPrompt: string },
): Promise<GenerateWithRepairResult<T>> {
  const usage: LlmUsage[] = [];
  let repairCount = 0;

  const first = await client.generateStructured(baseRequest);
  usage.push(first.usage);

  let parsed = schema.safeParse(parseJsonText(first.jsonText));
  if (parsed.success) {
    return { data: parsed.data, usage, repairCount };
  }

  repairCount = MAX_REPAIR_ATTEMPTS;
  const repairPrompt = [
    baseRequest.userPrompt,
    "",
    "Previous JSON failed validation. Fix and return ONLY valid JSON matching the schema.",
    "Validation errors:",
    formatZodIssues(parsed.error),
  ].join("\n");

  const repaired = await client.generateStructured({
    ...baseRequest,
    userPrompt: repairPrompt,
  });
  usage.push(repaired.usage);

  parsed = schema.safeParse(parseJsonText(repaired.jsonText));
  if (!parsed.success) {
    throw new LlmError("schema_invalid", formatZodIssues(parsed.error));
  }

  return { data: parsed.data, usage, repairCount };
}
