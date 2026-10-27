import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scriptSchema } from "./schema.js";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../fixtures/script.edu.json",
);

function loadFixture(): Record<string, unknown> {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>;
}

function parseFixture(overrides?: Record<string, unknown>) {
  const base = loadFixture();
  return scriptSchema.safeParse({ ...base, ...overrides });
}

describe("scriptSchema", () => {
  it("chấp nhận fixture Redis giáo dục", () => {
    const result = parseFixture();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.schemaVersion).toBe(1);
      expect(result.data.scenes).toHaveLength(5);
    }
  });

  it("từ chối scene code không có codeSnippet", () => {
    const fixture = loadFixture();
    const scenes = [...(fixture.scenes as object[])];
    scenes[2] = {
      id: "bad-code",
      narration: "Nội dung.",
      onScreenText: "Code",
      visualIntent: "Intent.",
      templateSlot: "code",
    };
    const result = scriptSchema.safeParse({ ...fixture, scenes });
    expect(result.success).toBe(false);
  });

  it("từ chối scene diagram không có diagram", () => {
    const fixture = loadFixture();
    const scenes = [...(fixture.scenes as object[])];
    scenes[3] = {
      id: "bad-diagram",
      narration: "Nội dung.",
      onScreenText: "Diagram",
      visualIntent: "Intent.",
      templateSlot: "diagram",
    };
    const result = scriptSchema.safeParse({ ...fixture, scenes });
    expect(result.success).toBe(false);
  });

  it("từ chối scene đầu không phải title", () => {
    const fixture = loadFixture();
    const scenes = [...(fixture.scenes as object[])];
    scenes[0] = {
      ...(scenes[0] as object),
      templateSlot: "explain",
    };
    const result = scriptSchema.safeParse({ ...fixture, scenes });
    expect(result.success).toBe(false);
  });

  it("từ chối scene cuối không phải cta", () => {
    const fixture = loadFixture();
    const scenes = [...(fixture.scenes as object[])];
    const lastIndex = scenes.length - 1;
    scenes[lastIndex] = {
      ...(scenes[lastIndex] as object),
      templateSlot: "explain",
    };
    const result = scriptSchema.safeParse({ ...fixture, scenes });
    expect(result.success).toBe(false);
  });

  it("từ chối field duration không thuộc schema", () => {
    const result = scriptSchema.safeParse({
      ...loadFixture(),
      duration: 60,
    });
    expect(result.success).toBe(false);
  });

  it("từ chối schemaVersion khác 1", () => {
    const result = parseFixture({ schemaVersion: 2 });
    expect(result.success).toBe(false);
  });

  it("từ chối scene id trùng", () => {
    const fixture = loadFixture();
    const scenes = [...(fixture.scenes as object[])];
    scenes[1] = { ...(scenes[1] as object), id: "intro-title" };
    const result = scriptSchema.safeParse({ ...fixture, scenes });
    expect(result.success).toBe(false);
  });

  it("từ chối ít hơn 3 scene", () => {
    const fixture = loadFixture();
    const scenes = (fixture.scenes as object[]).slice(0, 2);
    const result = scriptSchema.safeParse({ ...fixture, scenes });
    expect(result.success).toBe(false);
  });
});
