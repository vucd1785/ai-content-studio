import { describe, expect, it } from "vitest";
import { createGeminiResearchAdapter } from "./gemini-research-adapter.js";
import {
  CostCeilingError,
  createMeteredClient,
  llmCallCeiling,
  type UsageStore,
} from "./metered-client.js";
import type { StructuredGenerateClient } from "./structured-output.js";
import type { LlmUsage } from "./types.js";

function memoryStore(initial = 0) {
  const records: LlmUsage[] = [];
  const store: UsageStore = {
    countCalls: async () => initial + records.length,
    record: async (usage) => {
      records.push(usage);
    },
  };
  return { store, records };
}

function scriptedClient(responses: (string | Error)[]) {
  let calls = 0;
  const client: StructuredGenerateClient = {
    async generateStructured(request) {
      calls += 1;
      const next = responses.shift();
      if (next === undefined) {
        throw new Error("client hết kịch bản");
      }
      if (next instanceof Error) {
        throw next;
      }
      return {
        jsonText: next,
        usage: {
          provider: "gemini",
          model: request.model,
          inputTokens: 100,
          outputTokens: 20,
          thinkingTokens: 5,
        },
      };
    },
  };
  return { client, calls: () => calls };
}

const config = {
  apiKey: "test-key-not-real",
  modelScript: "test-model",
  thinkingLevelScript: "low" as const,
};
const brief = {
  topic: "Redis",
  audience: "Dev",
  goal: "TTL",
  durationSec: 60,
  language: "vi" as const,
  tone: "friendly",
  visualStyle: "edu",
};
const valid = JSON.stringify({ summary: "Tóm tắt", facts: [] });
const invalid = JSON.stringify({ summary: "", facts: "x" });

describe("trần gọi LLM (P3-09)", () => {
  it("trần = 6 + 2 × số lượt changes_requested", () => {
    expect(llmCallCeiling(0)).toBe(6);
    expect(llmCallCeiling(1)).toBe(8);
    expect(llmCallCeiling(3)).toBe(12);
  });

  it("repair tính thêm một row; lần thứ ba không gọi provider khi trần là 2", async () => {
    const { store, records } = memoryStore();
    const inner = scriptedClient([invalid, valid, valid]);
    const adapter = createGeminiResearchAdapter({
      config,
      client: createMeteredClient(inner.client, { ceiling: 2, store }),
    });

    // Lần 1 sai schema → repair: hai lần gọi, hai row.
    const first = await adapter.extractResearch({ brief, documents: [] });
    expect(first.repairCount).toBe(1);
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.inputTokens)).toEqual([100, 100]);
    expect(inner.calls()).toBe(2);

    // Lần thứ ba: hết trần, provider không bị gọi, không thêm row.
    await expect(adapter.extractResearch({ brief, documents: [] })).rejects.toBeInstanceOf(
      CostCeilingError,
    );
    expect(inner.calls()).toBe(2);
    expect(records).toHaveLength(2);
  });

  it("trần chặn cả lần repair giữa chừng", async () => {
    const { store, records } = memoryStore(1);
    const inner = scriptedClient([invalid, valid]);
    const adapter = createGeminiResearchAdapter({
      config,
      client: createMeteredClient(inner.client, { ceiling: 2, store }),
    });
    await expect(adapter.extractResearch({ brief, documents: [] })).rejects.toMatchObject({
      code: "cost_ceiling",
      used: 2,
      ceiling: 2,
    });
    expect(inner.calls()).toBe(1);
    expect(records).toHaveLength(1);
  });

  it("provider lỗi không ghi row", async () => {
    const { store, records } = memoryStore();
    const inner = scriptedClient([new Error("503")]);
    const metered = createMeteredClient(inner.client, { ceiling: 6, store });
    await expect(
      metered.generateStructured({
        systemInstruction: "",
        userPrompt: "",
        model: "m",
        thinkingLevel: "low",
      }),
    ).rejects.toThrow("503");
    expect(records).toEqual([]);
  });
});
