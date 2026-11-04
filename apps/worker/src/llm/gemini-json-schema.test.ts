import { describe, expect, it } from "vitest";
import { sanitizeJsonSchemaForGemini, summarizeGeminiJsonSchema } from "./gemini-json-schema.js";
import { buildGeminiGenerateContentConfig } from "./gemini-request-config.js";

describe("sanitizeJsonSchemaForGemini", () => {
  it("bỏ $schema và pattern, đổi const thành enum", () => {
    const raw = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        id: { type: "string", pattern: "^[a-z]+$", const: "vi" },
      },
    };
    const sanitized = sanitizeJsonSchemaForGemini(raw);
    expect(sanitized).not.toHaveProperty("$schema");
    expect(JSON.stringify(sanitized)).not.toContain("pattern");
    expect(sanitized).toEqual({
      type: "object",
      properties: {
        id: { type: "string", enum: ["vi"] },
      },
    });
  });

  it("schema sinh có const và pattern: sau sanitize không còn keyword bị Gemini từ chối", () => {
    const sanitized = sanitizeJsonSchemaForGemini({
      $schema: "x",
      type: "object",
      properties: {
        schemaVersion: { const: 2 },
        id: { type: "string", pattern: "^s[0-9]+$" },
        lines: {
          type: "array",
          items: { type: "object", properties: { text: { type: "string" } } },
        },
      },
    });
    const keywords = summarizeGeminiJsonSchema(sanitized).keywords;
    expect(keywords).not.toContain("$schema");
    expect(keywords).not.toContain("const");
    expect(keywords).not.toContain("pattern");
    expect(keywords).not.toContain("oneOf");
    expect(keywords).not.toContain("prefixItems");
    expect(JSON.stringify(sanitized)).toContain('"enum"');
  });
});

describe("buildGeminiGenerateContentConfig regression HTTP 400", () => {
  it("gửi responseJsonSchema (không responseSchema OpenAPI)", () => {
    const config = buildGeminiGenerateContentConfig({
      systemInstruction: "sys",
      thinkingLevel: "minimal",
      responseJsonSchema: { $schema: "x", type: "object", const: 1 },
    });
    expect(config).not.toHaveProperty("responseSchema");
    expect(config.responseJsonSchema).toEqual({ type: "object", enum: [1] });
  });
});
