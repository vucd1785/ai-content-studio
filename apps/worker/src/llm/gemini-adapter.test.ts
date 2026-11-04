import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { LlmError } from "./errors.js";
import { createGeminiStructuredClient } from "./gemini-client.js";
import type { StructuredGenerateClient, StructuredGenerateResponse } from "./structured-output.js";
import { generateWithSchemaRepair } from "./structured-output.js";

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
      thinkingLevel: "low",
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
      thinkingLevel: "low",
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
        thinkingLevel: "low",
      }),
    ).rejects.toMatchObject({ code: "schema_invalid" });
  });
});

describe("createGeminiStructuredClient", () => {
  it("báo configuration_missing khi thiếu API key", () => {
    expect(() =>
      createGeminiStructuredClient({
        apiKey: undefined,
        modelScript: "gemini-3.6-flash",
        thinkingLevelScript: "low",
      }),
    ).toThrow(LlmError);
  });
});
