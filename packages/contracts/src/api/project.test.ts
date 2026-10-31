import { describe, expect, it } from "vitest";
import {
  briefWriteBodySchema,
  projectCreateBodySchema,
  referenceIdParamsSchema,
  referenceJsonBodySchema,
} from "./project.js";

const validBrief = {
  topic: "Redis",
  audience: "Dev",
  goal: "Hiểu cache",
  durationSec: 60,
  language: "vi",
  tone: "friendly",
  visualStyle: "edu",
};

describe("project contracts", () => {
  it("title phải 1–200 ký tự", () => {
    expect(projectCreateBodySchema.safeParse({ title: "" }).success).toBe(false);
    expect(projectCreateBodySchema.safeParse({ title: "a".repeat(201) }).success).toBe(false);
    expect(projectCreateBodySchema.safeParse({ title: "Dự án" }).success).toBe(true);
  });

  it("brief chặn duration ngoài 30–90 và language khác vi", () => {
    expect(briefWriteBodySchema.safeParse(validBrief).success).toBe(true);
    expect(briefWriteBodySchema.safeParse({ ...validBrief, durationSec: 29 }).success).toBe(false);
    expect(briefWriteBodySchema.safeParse({ ...validBrief, durationSec: 91 }).success).toBe(false);
    expect(briefWriteBodySchema.safeParse({ ...validBrief, durationSec: 45.5 }).success).toBe(false);
    expect(briefWriteBodySchema.safeParse({ ...validBrief, language: "en" }).success).toBe(false);
    expect(briefWriteBodySchema.safeParse({ ...validBrief, notes: "x".repeat(8001) }).success).toBe(
      false,
    );
  });

  it("reference url chỉ http/https, tối đa 2048", () => {
    expect(referenceJsonBodySchema.safeParse({ url: "https://example.com/a" }).success).toBe(true);
    expect(referenceJsonBodySchema.safeParse({ url: "http://example.com/a" }).success).toBe(true);
    expect(referenceJsonBodySchema.safeParse({ url: "file:///etc/passwd" }).success).toBe(false);
    expect(referenceJsonBodySchema.safeParse({ url: "javascript:alert(1)" }).success).toBe(false);
    expect(referenceJsonBodySchema.safeParse({ url: "not a url" }).success).toBe(false);
    expect(
      referenceJsonBodySchema.safeParse({ url: `https://example.com/${"a".repeat(2048)}` }).success,
    ).toBe(false);
  });

  it("params bắt buộc uuid", () => {
    expect(
      referenceIdParamsSchema.safeParse({ projectId: "abc", referenceId: "../x" }).success,
    ).toBe(false);
  });
});
