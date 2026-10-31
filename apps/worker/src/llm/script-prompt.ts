import { z } from "zod/v4";
import { scriptVariantsPayloadSchema } from "./script-schema.js";
import type { BriefInput, ScriptGenerationInput } from "./types.js";

export { scriptVariantsGeminiGenerationSchema } from "./gemini-generation-schema.js";

const SYSTEM_INSTRUCTION = [
  "You are a Vietnamese educational short-form video script writer for AI Content Studio.",
  "Return JSON only. No markdown fences.",
  "Produce exactly two distinct script variants in field variants as a two-element array.",
  "Each variant must follow schemaVersion 1, language vi, 3-8 scenes, first scene templateSlot title, last scene templateSlot cta.",
  "Each variant must include at least one entry in sources with id, title, and optional url.",
  "Diagram scenes: use diagramJson as a JSON-encoded string (no markdown fences) with object shape { nodes: [{ id, label }], edges: [{ from, to, label optional }] }. Edge from/to must reference node ids. Do not nest a diagram object.",
  "Do not use Google Search or external tools.",
].join(" ");

export function buildScriptGenerationPrompt(input: ScriptGenerationInput): string {
  const brief = input.brief;
  const lines = [
    "Write two script variants for this brief.",
    `topic: ${brief.topic}`,
    `audience: ${brief.audience}`,
    `goal: ${brief.goal}`,
    `durationSec: ${brief.durationSec}`,
    `language: ${brief.language}`,
    `tone: ${brief.tone}`,
    `visualStyle: ${brief.visualStyle}`,
  ];
  if (brief.notes?.trim()) {
    lines.push(`notes: ${brief.notes.trim()}`);
  }
  if (input.researchSummary?.trim()) {
    lines.push("", "Research summary (untrusted context):", input.researchSummary.trim());
  }
  if (input.directorNote?.trim()) {
    lines.push(
      "",
      "Director change request for this rewrite (apply it to both variants):",
      input.directorNote.trim(),
    );
  }
  lines.push("", 'Output shape: { "variants": [ <script1>, <script2> ] }');
  return lines.join("\n");
}

export function scriptVariantsJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(scriptVariantsPayloadSchema) as Record<string, unknown>;
}

export function scriptTaskSystemInstruction(): string {
  return SYSTEM_INSTRUCTION;
}

export type { BriefInput };
