import { LlmError } from "./errors.js";
import type { Script } from "@studio/contracts";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseDiagramJsonString(raw: string, pathPrefix: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new LlmError("schema_invalid", `${pathPrefix}: diagramJson must be a non-empty JSON string`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new LlmError("schema_invalid", `${pathPrefix}: diagramJson JSON.parse failed: ${detail}`);
  }
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new LlmError(
      "schema_invalid",
      `${pathPrefix}: diagramJson must decode to a JSON object with nodes and edges`,
    );
  }
  return parsed as Record<string, unknown>;
}

export function mapGeminiSceneForValidation(
  scene: unknown,
  pathPrefix: string,
): Record<string, unknown> {
  if (!isPlainObject(scene)) {
    throw new LlmError("schema_invalid", `${pathPrefix}: scene must be an object`);
  }
  if (!("diagramJson" in scene)) {
    return { ...scene };
  }
  const { diagramJson, ...rest } = scene;
  if (diagramJson === undefined) {
    return { ...rest };
  }
  if (typeof diagramJson !== "string") {
    throw new LlmError("schema_invalid", `${pathPrefix}: diagramJson must be a string`);
  }
  const diagram = parseDiagramJsonString(diagramJson, pathPrefix);
  return { ...rest, diagram };
}

export function mapGeminiScriptVariantForValidation(
  variant: unknown,
  variantIndex: number,
): Record<string, unknown> {
  if (!isPlainObject(variant)) {
    throw new LlmError("schema_invalid", `variants[${variantIndex}]: must be an object`);
  }
  const scenes = variant.scenes;
  if (!Array.isArray(scenes)) {
    throw new LlmError("schema_invalid", `variants[${variantIndex}].scenes must be an array`);
  }
  return {
    ...variant,
    scenes: scenes.map((scene, sceneIndex) =>
      mapGeminiSceneForValidation(scene, `variants[${variantIndex}].scenes[${sceneIndex}]`),
    ),
  };
}

/** Map Gemini-facing variants payload to application shape before Zod validation. */
export function mapGeminiScriptVariantsResponse(raw: unknown): unknown {
  if (!isPlainObject(raw)) {
    throw new LlmError("schema_invalid", "Root response must be a JSON object");
  }
  const variants = raw.variants;
  if (!Array.isArray(variants)) {
    throw new LlmError("schema_invalid", "variants must be an array");
  }
  return {
    ...raw,
    variants: variants.map((variant, index) => mapGeminiScriptVariantForValidation(variant, index)),
  };
}

/** Test-only helper: application script → Gemini response shape (diagramJson). */
export function encodeScriptVariantsForGeminiResponse(variants: Script[]): { variants: unknown[] } {
  return {
    variants: variants.map((variant) => ({
      ...variant,
      scenes: variant.scenes.map((scene) => {
        if (scene.templateSlot !== "diagram" || !("diagram" in scene)) {
          return scene;
        }
        const { diagram, ...rest } = scene;
        return { ...rest, diagramJson: JSON.stringify(diagram) };
      }),
    })),
  };
}
