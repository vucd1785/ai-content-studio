import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Script } from "@studio/contracts";
import { parseScript } from "@studio/contracts";
import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { resolveRepoRoot } from "../cli/paths.js";
import { LlmError } from "./errors.js";
import { createGeminiAdapter } from "./gemini-adapter.js";
import { createGeminiStructuredClient } from "./gemini-client.js";
import { scriptVariantsPayloadSchema } from "./script-schema.js";
import type { StructuredGenerateClient, StructuredGenerateResponse } from "./structured-output.js";
import { generateWithSchemaRepair } from "./structured-output.js";
import type { BriefInput } from "./types.js";

function loadEduScript(): Script {
  const repoRoot = resolveRepoRoot(import.meta.url);
  const raw = JSON.parse(
    readFileSync(join(repoRoot, "fixtures", "script.edu.json"), "utf8"),
  ) as Record<string, unknown>;
  const withSources = {
    ...raw,
    sources: [
      { id: "src-redis-docs", title: "Redis documentation", url: "https://redis.io/docs/" },
    ],
  };
  return parseScript(withSources);
}

function sampleBrief(): BriefInput {
  return {
    topic: "Redis là gì",
    audience: "Developer mới",
    goal: "Giải thích cache trong 60 giây",
    durationSec: 60,
    language: "vi",
    tone: "thân thiện",
    visualStyle: "gradient tối, flat icon",
    notes: "Nhấn SET/GET",
  };
}

function usage(model = "fake-gemini"): StructuredGenerateResponse["usage"] {
  return {
    provider: "gemini",
    model,
    inputTokens: 10,
    outputTokens: 20,
    thinkingTokens: 0,
  };
}

function fakeClient(responses: string[]): StructuredGenerateClient {
  let callIndex = 0;
  return {
    async generateStructured() {
      const jsonText = responses[callIndex];
      callIndex += 1;
      if (jsonText === undefined) {
        throw new LlmError("provider_error", "unexpected extra provider call");
      }
      return { jsonText, usage: usage() };
    },
  };
}

describe("generateWithSchemaRepair", () => {
  const schema = z.object({ value: z.number().int() }).strict();

  it("chấp nhận JSON hợp lệ lần đầu", async () => {
    const client = fakeClient(['{"value":1}']);
    const result = await generateWithSchemaRepair(schema, client, {
      systemInstruction: "sys",
      userPrompt: "user",
      model: "fake",
      thinkingBudget: 0,
    });
    expect(result.data.value).toBe(1);
    expect(result.repairCount).toBe(0);
    expect(result.usage).toHaveLength(1);
  });

  it("repair đúng một lần rồi pass", async () => {
    const client = fakeClient(['{"value":"x"}', '{"value":2}']);
    const result = await generateWithSchemaRepair(schema, client, {
      systemInstruction: "sys",
      userPrompt: "user",
      model: "fake",
      thinkingBudget: 0,
    });
    expect(result.data.value).toBe(2);
    expect(result.repairCount).toBe(1);
    expect(result.usage).toHaveLength(2);
  });

  it("fail sau repair và không gọi provider lần thứ ba", async () => {
    const client = fakeClient(['{"value":"bad"}', '{"value":"still-bad"}', '{"value":3}']);
    await expect(
      generateWithSchemaRepair(schema, client, {
        systemInstruction: "sys",
        userPrompt: "user",
        model: "fake",
        thinkingBudget: 0,
      }),
    ).rejects.toMatchObject({ code: "schema_invalid" });
  });
});

describe("createGeminiStructuredClient", () => {
  it("báo configuration_missing khi thiếu API key", () => {
    expect(() =>
      createGeminiStructuredClient({
        apiKey: undefined,
        modelScript: "gemini-2.0-flash",
        thinkingBudgetScript: 0,
      }),
    ).toThrow(LlmError);
  });
});

describe("createGeminiAdapter script task", () => {
  it("trả đúng hai phương án đã validate", async () => {
    const script = loadEduScript();
    const payload = JSON.stringify({
      variants: [script, { ...script, title: `${script.title} B` }],
    });
    const adapter = createGeminiAdapter({
      config: {
        apiKey: "test-key",
        modelScript: "gemini-2.0-flash",
        thinkingBudgetScript: 0,
      },
      client: fakeClient([payload]),
    });

    const result = await adapter.generateScriptVariants({ brief: sampleBrief() });
    expect(result.variants).toHaveLength(2);
    expect(result.variants[0]?.schemaVersion).toBe(1);
    expect(result.variants[1]?.title).toContain(" B");
    expect(result.repairCount).toBe(0);
    expect(result.usage[0]?.outputTokens).toBe(20);
  });

  it("schema sai → một repair → fail nếu vẫn sai", async () => {
    const script = loadEduScript();
    const valid = JSON.stringify({ variants: [script, script] });
    const invalid = JSON.stringify({ variants: [script] });
    const adapter = createGeminiAdapter({
      config: {
        apiKey: "test-key",
        modelScript: "gemini-2.0-flash",
        thinkingBudgetScript: 0,
      },
      client: fakeClient([invalid, invalid, valid]),
    });

    await expect(adapter.generateScriptVariants({ brief: sampleBrief() })).rejects.toMatchObject({
      code: "schema_invalid",
    });
  });

  it("schema sai → repair thành công", async () => {
    const script = loadEduScript();
    const valid = JSON.stringify({ variants: [script, script] });
    const invalid = JSON.stringify({ notVariants: true });
    const adapter = createGeminiAdapter({
      config: {
        apiKey: "test-key",
        modelScript: "gemini-2.0-flash",
        thinkingBudgetScript: 0,
      },
      client: fakeClient([invalid, valid]),
    });

    const result = await adapter.generateScriptVariants({ brief: sampleBrief() });
    expect(result.repairCount).toBe(1);
    expect(result.variants).toHaveLength(2);
  });

  it("provider lỗi → provider_error", async () => {
    const adapter = createGeminiAdapter({
      config: {
        apiKey: "test-key",
        modelScript: "gemini-2.0-flash",
        thinkingBudgetScript: 0,
      },
      client: {
        async generateStructured() {
          throw new LlmError("provider_error", "network down");
        },
      },
    });

    await expect(adapter.generateScriptVariants({ brief: sampleBrief() })).rejects.toMatchObject({
      code: "provider_error",
    });
  });

  it("từ chối script LLM thiếu sources", async () => {
    const repoRoot = resolveRepoRoot(import.meta.url);
    const raw = JSON.parse(
      readFileSync(join(repoRoot, "fixtures", "script.edu.json"), "utf8"),
    ) as Record<string, unknown>;
    const noSources = parseScript(raw);
    const payload = JSON.stringify({ variants: [noSources, noSources] });
    const adapter = createGeminiAdapter({
      config: {
        apiKey: "test-key",
        modelScript: "gemini-2.0-flash",
        thinkingBudgetScript: 0,
      },
      client: fakeClient([payload, payload]),
    });

    await expect(adapter.generateScriptVariants({ brief: sampleBrief() })).rejects.toMatchObject({
      code: "schema_invalid",
    });
  });
});

describe("scriptVariantsPayloadSchema", () => {
  it("parse payload mẫu hai variant", () => {
    const script = loadEduScript();
    const parsed = scriptVariantsPayloadSchema.safeParse({
      variants: [script, { ...script, title: "Alt" }],
    });
    expect(parsed.success).toBe(true);
  });
});
