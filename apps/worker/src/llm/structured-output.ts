import type { GeminiThinkingLevel } from "@studio/config/gemini";
import type { z } from "zod/v4";
import { LlmError } from "./errors.js";
import type { LlmUsage } from "./types.js";

export type StructuredGenerateRequest = {
  systemInstruction: string;
  userPrompt: string;
  /** JSON Schema object for Gemini responseJsonSchema (generation); app validates with Zod after. */
  responseJsonSchema?: Record<string, unknown>;
  model: string;
  thinkingLevel: GeminiThinkingLevel;
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

export type GenerateWithRepairOptions = {
  /** Chuyển JSON sau parse (ví dụ diagramJson → diagram) trước Zod. */
  mapParsedJson?: (raw: unknown) => unknown;
  /** Gợi ý thêm trong prompt repair (Gemini-facing schema). */
  repairNotes?: string;
};

function formatAttemptFailure(detail: string): string {
  return detail;
}

function attemptParseValidate<T>(
  schema: z.ZodType<T>,
  jsonText: string,
  mapParsedJson?: (raw: unknown) => unknown,
): { ok: true; data: T } | { ok: false; detail: string } {
  let raw: unknown;
  try {
    raw = parseJsonText(jsonText);
  } catch (error) {
    const message = error instanceof LlmError ? error.message : String(error);
    return { ok: false, detail: message };
  }
  if (mapParsedJson) {
    try {
      raw = mapParsedJson(raw);
    } catch (error) {
      const message = error instanceof LlmError ? error.message : String(error);
      return { ok: false, detail: message };
    }
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, detail: formatZodIssues(parsed.error) };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Gọi provider, validate Zod, tối đa một lần repair (ADR-007 / docs/04-AGENT-ORCHESTRATION.md).
 */
export async function generateWithSchemaRepair<T>(
  schema: z.ZodType<T>,
  client: StructuredGenerateClient,
  baseRequest: Omit<StructuredGenerateRequest, "userPrompt"> & { userPrompt: string },
  options: GenerateWithRepairOptions = {},
): Promise<GenerateWithRepairResult<T>> {
  const usage: LlmUsage[] = [];
  let repairCount = 0;
  const { mapParsedJson, repairNotes } = options;

  const first = await client.generateStructured(baseRequest);
  usage.push(first.usage);

  let attempt = attemptParseValidate(schema, first.jsonText, mapParsedJson);
  if (attempt.ok) {
    return { data: attempt.data, usage, repairCount };
  }

  repairCount = MAX_REPAIR_ATTEMPTS;
  const repairLines = [
    baseRequest.userPrompt,
    "",
    "Previous JSON failed validation. Fix and return ONLY valid JSON matching the schema.",
    repairNotes?.trim() ? `Schema notes:\n${repairNotes.trim()}` : undefined,
    "Validation errors:",
    formatAttemptFailure(attempt.detail),
  ].filter((line): line is string => line !== undefined);

  const repaired = await client.generateStructured({
    ...baseRequest,
    userPrompt: repairLines.join("\n"),
  });
  usage.push(repaired.usage);

  attempt = attemptParseValidate(schema, repaired.jsonText, mapParsedJson);
  if (!attempt.ok) {
    throw new LlmError("schema_invalid", formatAttemptFailure(attempt.detail));
  }

  return { data: attempt.data, usage, repairCount };
}

/** Lỗi Zod gọn một dòng cho lần repair và log. */
export function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}
