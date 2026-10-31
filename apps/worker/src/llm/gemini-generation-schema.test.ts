import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseScript } from "@studio/contracts";
import { describe, expect, it } from "vitest";
import { resolveRepoRoot } from "../cli/paths.js";
import { createGeminiAdapter } from "./gemini-adapter.js";
import { encodeScriptVariantsForGeminiResponse } from "./gemini-diagram-transform.js";
import {
  countSchemaKeyword,
  scriptVariantsGeminiGenerationSchema,
  scriptVariantsZodDerivedGenerationSchema,
  scriptVariantsZodJsonSchema,
} from "./gemini-generation-schema.js";
import { sanitizeJsonSchemaForGemini, summarizeGeminiJsonSchema } from "./gemini-json-schema.js";
import { scriptVariantsPayloadSchema } from "./script-schema.js";
import type { BriefInput } from "./types.js";

function loadEduScript() {
  const repoRoot = resolveRepoRoot(import.meta.url);
  const raw = JSON.parse(
    readFileSync(join(repoRoot, "fixtures", "script.edu.json"), "utf8"),
  ) as Record<string, unknown>;
  return {
    ...raw,
    sources: [{ id: "src-1", title: "Docs", url: "https://example.com/docs" }],
  };
}

describe("scriptVariantsGeminiGenerationSchema", () => {
  const generation = scriptVariantsGeminiGenerationSchema();
  const legacyZod = scriptVariantsZodDerivedGenerationSchema();

  it("generation schema: đúng 2 variants, không prefixItems", () => {
    const variants = (generation.properties as { variants: Record<string, unknown> }).variants;
    expect(variants.type).toBe("array");
    expect(variants.minItems).toBe(2);
    expect(variants.maxItems).toBe(2);
    expect(variants).toHaveProperty("items");
    expect(variants).not.toHaveProperty("prefixItems");
  });

  it("regression HTTP 400: không anyOf scene union (Zod-derived cũ có anyOf)", () => {
    expect(JSON.stringify(generation)).not.toContain('"anyOf"');
    expect(JSON.stringify(legacyZod)).toContain('"anyOf"');
    expect(countSchemaKeyword(generation, "anyOf")).toBe(0);
    expect(countSchemaKeyword(legacyZod, "anyOf")).toBeGreaterThan(0);
  });

  it("regression HTTP 400: không additionalProperties lồng nhau như Zod-derived", () => {
    expect(countSchemaKeyword(generation, "additionalProperties")).toBe(0);
    expect(countSchemaKeyword(legacyZod, "additionalProperties")).toBeGreaterThan(0);
  });

  it("regression HTTP 400: không format uri / string length generation", () => {
    const json = JSON.stringify(generation);
    expect(json).not.toContain('"format"');
    expect(json).not.toContain("minLength");
    expect(json).not.toContain("maxLength");
  });

  it("vẫn biểu diễn đủ 5 templateSlot + code + diagramJson + sources", () => {
    const json = JSON.stringify(generation);
    for (const slot of ["title", "explain", "code", "diagram", "cta"] as const) {
      expect(json).toContain(`"${slot}"`);
    }
    expect(json).toContain("codeSnippet");
    expect(json).toContain("diagramJson");
    expect(json).not.toMatch(/"diagram"\s*:\s*\{/);
    expect(json).toContain("sources");
  });

  it("Zod tuple contract không đổi", () => {
    const script = parseScript(loadEduScript());
    const payload = scriptVariantsPayloadSchema.parse({
      variants: [script, script],
    });
    expect(payload.variants).toHaveLength(2);
  });

  it("nhỏ hơn schema Zod-derived (2983 B class)", () => {
    const after = summarizeGeminiJsonSchema(generation);
    const before = summarizeGeminiJsonSchema(legacyZod);
    expect(after.serializedBytes).toBeLessThan(before.serializedBytes);
    expect(after.unionBranchCount).toBe(0);
  });

  it("tuple Zod prefixItems: hai phần tử giống nhau (phân tích lịch sử)", () => {
    const sanitizedTuple = sanitizeJsonSchemaForGemini(scriptVariantsZodJsonSchema());
    const variants = (sanitizedTuple.properties as { variants: { prefixItems: unknown[] } })
      .variants;
    expect(variants.prefixItems).toHaveLength(2);
    expect(JSON.stringify(variants.prefixItems[0])).toBe(JSON.stringify(variants.prefixItems[1]));
  });
});

describe("repair behavior unchanged", () => {
  it("vẫn tối đa một lần repair qua adapter path", async () => {
    let calls = 0;
    const client = {
      async generateStructured() {
        calls += 1;
        if (calls === 1) {
          return {
            jsonText: JSON.stringify({ variants: [{ bad: true }, { bad: true }] }),
            usage: {
              provider: "gemini" as const,
              model: "fake",
              inputTokens: 1,
              outputTokens: 1,
              thinkingTokens: 0,
            },
          };
        }
        return {
          jsonText: JSON.stringify(
            encodeScriptVariantsForGeminiResponse([
              parseScript(loadEduScript()),
              parseScript(loadEduScript()),
            ]),
          ),
          usage: {
            provider: "gemini" as const,
            model: "fake",
            inputTokens: 1,
            outputTokens: 1,
            thinkingTokens: 0,
          },
        };
      },
    };

    const brief: BriefInput = {
      topic: "t",
      audience: "a",
      goal: "g",
      durationSec: 60,
      language: "vi",
      tone: "t",
      visualStyle: "v",
    };

    const adapter = createGeminiAdapter({
      client,
      config: { apiKey: "x", modelScript: "fake", thinkingLevelScript: "low" },
    });
    const result = await adapter.generateScriptVariants({ brief });
    expect(result.variants).toHaveLength(2);
    expect(result.repairCount).toBe(1);
    expect(calls).toBe(2);
  });
});
