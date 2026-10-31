import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Script } from "@studio/contracts";
import { parseScript } from "@studio/contracts";
import { describe, expect, it } from "vitest";
import { resolveRepoRoot } from "../cli/paths.js";
import { LlmError } from "./errors.js";
import { createGeminiAdapter } from "./gemini-adapter.js";
import {
  encodeScriptVariantsForGeminiResponse,
  mapGeminiSceneForValidation,
  mapGeminiScriptVariantsResponse,
} from "./gemini-diagram-transform.js";
import { scriptVariantsGeminiGenerationSchema } from "./gemini-generation-schema.js";
import { scriptVariantsPayloadSchema } from "./script-schema.js";
import type { StructuredGenerateClient } from "./structured-output.js";
import { generateWithSchemaRepair } from "./structured-output.js";
import type { BriefInput } from "./types.js";

function loadEduScript(): Script {
  const repoRoot = resolveRepoRoot(import.meta.url);
  const raw = JSON.parse(
    readFileSync(join(repoRoot, "fixtures", "script.edu.json"), "utf8"),
  ) as Record<string, unknown>;
  return parseScript({
    ...raw,
    sources: [{ id: "src-redis-docs", title: "Redis documentation", url: "https://redis.io/docs/" }],
  });
}

describe("mapGeminiScriptVariantsResponse", () => {
  const script = loadEduScript();

  it("chuyển diagramJson hợp lệ thành diagram, giữ label cạnh", () => {
    const gemini = encodeScriptVariantsForGeminiResponse([script, script]);
    const mapped = mapGeminiScriptVariantsResponse(gemini) as {
      variants: Array<{ scenes: Array<{ templateSlot: string; diagram?: { edges: Array<{ label?: string }> } }> }>;
    };
    const diagramScene = mapped.variants[0]?.scenes.find((s) => s.templateSlot === "diagram");
    expect(diagramScene?.diagram?.edges[0]?.label).toBe("lệnh");
    expect("diagramJson" in (diagramScene ?? {})).toBe(false);
  });

  it("giữ scene không diagram không đổi", () => {
    const gemini = encodeScriptVariantsForGeminiResponse([script, script]);
    const mapped = mapGeminiScriptVariantsResponse(gemini) as {
      variants: Array<{ scenes: Array<{ templateSlot: string }> }>;
    };
    const title = mapped.variants[0]?.scenes[0];
    expect(title?.templateSlot).toBe("title");
    expect(title).not.toHaveProperty("diagramJson");
  });

  it("hai variant và nhiều scene transform đúng", () => {
    const second = { ...script, title: "Phiên bản B" };
    const mapped = mapGeminiScriptVariantsResponse(
      encodeScriptVariantsForGeminiResponse([script, second]),
    );
    const parsed = scriptVariantsPayloadSchema.safeParse(mapped);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.variants[1]?.title).toBe("Phiên bản B");
    }
  });

  it("diagramJson malformed → LlmError, không silent recovery", () => {
    const gemini = encodeScriptVariantsForGeminiResponse([script, script]);
    const variant = (gemini.variants[0] ?? {}) as { scenes: Record<string, unknown>[] };
    const idx = variant.scenes.findIndex((s) => s.templateSlot === "diagram");
    variant.scenes[idx] = { ...variant.scenes[idx], diagramJson: "{not-json" };
    expect(() => mapGeminiScriptVariantsResponse(gemini)).toThrow(LlmError);
  });

  it("từ chối JSON array, null, primitive trong diagramJson", () => {
    for (const bad of ["[]", "null", '"text"', "42"]) {
      expect(() =>
        mapGeminiSceneForValidation(
          { id: "d", templateSlot: "diagram", diagramJson: bad },
          "scenes[0]",
        ),
      ).toThrow(LlmError);
    }
  });

  it("diagram scene thiếu diagramJson fail Zod sau map", () => {
    const gemini = encodeScriptVariantsForGeminiResponse([script, script]);
    const variant = (gemini.variants[0] ?? {}) as { scenes: Record<string, unknown>[] };
    const idx = variant.scenes.findIndex((s) => s.templateSlot === "diagram");
    const { diagramJson: _, ...without } = variant.scenes[idx] as { diagramJson: string };
    variant.scenes[idx] = without;
    const mapped = mapGeminiScriptVariantsResponse(gemini);
    const parsed = scriptVariantsPayloadSchema.safeParse(mapped);
    expect(parsed.success).toBe(false);
  });

  it("cấu trúc node/edge không hợp lệ fail Zod", () => {
    const gemini = encodeScriptVariantsForGeminiResponse([script, script]);
    const variant = (gemini.variants[0] ?? {}) as { scenes: Record<string, unknown>[] };
    const idx = variant.scenes.findIndex((s) => s.templateSlot === "diagram");
    variant.scenes[idx] = {
      ...variant.scenes[idx],
      diagramJson: JSON.stringify({ nodes: [{}], edges: [] }),
    };
    const mapped = mapGeminiScriptVariantsResponse(gemini);
    expect(scriptVariantsPayloadSchema.safeParse(mapped).success).toBe(false);
  });

  it("generation schema không còn diagram.nodes / diagram.edges lồng nhau", () => {
    const json = JSON.stringify(scriptVariantsGeminiGenerationSchema());
    expect(json).toContain("diagramJson");
    expect(json).not.toMatch(/"diagram"\s*:\s*\{/);
    expect(json).not.toContain('"nodes"');
    expect(json).not.toContain('"edges"');
  });
});

describe("diagramJson repair integration", () => {
  const brief: BriefInput = {
    topic: "Redis",
    audience: "dev",
    goal: "g",
    durationSec: 60,
    language: "vi",
    tone: "t",
    visualStyle: "v",
  };

  it("repair một lần sau diagramJson sai, usage hai lần", async () => {
    const script = loadEduScript();
    const valid = JSON.stringify(encodeScriptVariantsForGeminiResponse([script, script]));
    const invalid = JSON.stringify({
      variants: [{ bad: true }, { bad: true }],
    });
    let calls = 0;
    const client: StructuredGenerateClient = {
      async generateStructured() {
        calls += 1;
        return {
          jsonText: calls === 1 ? invalid : valid,
          usage: {
            provider: "gemini",
            model: "fake",
            inputTokens: 1,
            outputTokens: 2,
            thinkingTokens: 0,
          },
        };
      },
    };

    const adapter = createGeminiAdapter({
      client,
      config: { apiKey: "x", modelScript: "fake", thinkingLevelScript: "low" },
    });
    const result = await adapter.generateScriptVariants({ brief });
    expect(result.repairCount).toBe(1);
    expect(result.usage).toHaveLength(2);
    expect(calls).toBe(2);
    expect(result.variants[0]?.scenes.some((s) => s.templateSlot === "diagram")).toBe(true);
  });

  it("transform fail → repair → validate, không gọi lần 3", async () => {
    const script = loadEduScript();
    const geminiBad = encodeScriptVariantsForGeminiResponse([script, script]);
    const variant = (geminiBad.variants[0] ?? {}) as { scenes: Record<string, unknown>[] };
    const idx = variant.scenes.findIndex((s) => s.templateSlot === "diagram");
    variant.scenes[idx] = { ...variant.scenes[idx], diagramJson: "[]" };
    const bad = JSON.stringify(geminiBad);
    const good = JSON.stringify(encodeScriptVariantsForGeminiResponse([script, script]));
    let calls = 0;
    const client: StructuredGenerateClient = {
      async generateStructured() {
        calls += 1;
        return {
          jsonText: calls === 1 ? bad : good,
          usage: {
            provider: "gemini",
            model: "fake",
            inputTokens: 1,
            outputTokens: 1,
            thinkingTokens: 0,
          },
        };
      },
    };

    const result = await generateWithSchemaRepair(
      scriptVariantsPayloadSchema,
      client,
      {
        systemInstruction: "sys",
        userPrompt: "user",
        model: "fake",
        thinkingLevel: "low",
      },
      {
        mapParsedJson: mapGeminiScriptVariantsResponse,
        repairNotes: "diagramJson string",
      },
    );
    expect(result.repairCount).toBe(1);
    expect(calls).toBe(2);
  });
});
