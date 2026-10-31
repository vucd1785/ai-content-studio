import { z } from "zod/v4";
import { sanitizeJsonSchemaForGemini, summarizeGeminiJsonSchema } from "./gemini-json-schema.js";
import { llmScriptSchema, scriptVariantsPayloadSchema } from "./script-schema.js";

const CODE_LANGUAGES = ["ts", "sql", "json", "bash", "text"] as const;
const TEMPLATE_SLOTS = ["title", "explain", "code", "diagram", "cta"] as const;

/**
 * Gemini-facing scene shape: một object, không anyOf.
 * codeSnippet / diagramJson optional ở generation; Zod discriminatedUnion validate sau.
 */
export function geminiSceneObjectSchema(): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      id: { type: "string" },
      narration: { type: "string" },
      onScreenText: { type: "string" },
      visualIntent: { type: "string" },
      templateSlot: { type: "string", enum: [...TEMPLATE_SLOTS] },
      codeSnippet: {
        type: "object",
        properties: {
          language: { type: "string", enum: [...CODE_LANGUAGES] },
          code: { type: "string" },
        },
        required: ["language", "code"],
      },
      diagramJson: { type: "string" },
    },
    required: ["id", "narration", "onScreenText", "visualIntent", "templateSlot"],
  };
}

export function geminiScriptItemSchema(): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      schemaVersion: { type: "number", enum: [1] },
      language: { type: "string", enum: ["vi"] },
      title: { type: "string" },
      hook: { type: "string" },
      scenes: {
        type: "array",
        minItems: 3,
        maxItems: 8,
        items: geminiSceneObjectSchema(),
      },
      cta: { type: "string" },
      sources: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            url: { type: "string" },
          },
          required: ["id", "title"],
        },
      },
    },
    required: ["schemaVersion", "language", "title", "hook", "scenes", "cta", "sources"],
  };
}

/**
 * JSON Schema gửi Gemini (`responseJsonSchema`).
 * Không dùng `z.toJSONSchema` — tránh anyOf scene + additionalProperties lồng nhau (HTTP 400 đã xác nhận live trên C/D).
 * Validation app: `scriptVariantsPayloadSchema` / `@studio/contracts` không đổi.
 */
export function scriptVariantsGeminiGenerationSchema(): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      variants: {
        type: "array",
        minItems: 2,
        maxItems: 2,
        items: geminiScriptItemSchema(),
      },
    },
    required: ["variants"],
  };
}

/** Zod tuple JSON Schema — phân tích / so sánh, không gửi API. */
export function scriptVariantsZodJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(scriptVariantsPayloadSchema) as Record<string, unknown>;
}

/** Schema generation cũ từ Zod (anyOf + additionalProperties lồng nhau) — chỉ regression. */
export function scriptVariantsZodDerivedGenerationSchema(): Record<string, unknown> {
  const raw = z.toJSONSchema(llmScriptSchema) as Record<string, unknown>;
  const stripped = stripStringLengthConstraints(sanitizeJsonSchemaForGemini(raw)) as Record<
    string,
    unknown
  >;
  return {
    type: "object",
    properties: {
      variants: {
        type: "array",
        items: stripped,
        minItems: 2,
        maxItems: 2,
      },
    },
    required: ["variants"],
    additionalProperties: false,
  };
}

const STRING_LENGTH_KEYS = new Set(["minLength", "maxLength"]);

function stripStringLengthConstraints(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(stripStringLengthConstraints);
  }
  if (node === null || typeof node !== "object") {
    return node;
  }
  const input = node as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (STRING_LENGTH_KEYS.has(key)) {
      continue;
    }
    output[key] = stripStringLengthConstraints(value);
  }
  return output;
}

export function summarizeGeminiGenerationSchema() {
  return summarizeGeminiJsonSchema(scriptVariantsGeminiGenerationSchema());
}

export function countSchemaKeyword(node: unknown, keyword: string, count = 0): number {
  if (node === null || typeof node !== "object") {
    return count;
  }
  if (Array.isArray(node)) {
    return node.reduce((sum, item) => countSchemaKeyword(item, keyword, sum), count);
  }
  const record = node as Record<string, unknown>;
  if (keyword in record) {
    count += 1;
  }
  return Object.values(record).reduce<number>(
    (sum, value) => countSchemaKeyword(value, keyword, sum),
    count,
  );
}
