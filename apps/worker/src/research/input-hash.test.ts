import { describe, expect, it } from "vitest";
import type { ResearchDocument } from "../llm/research-prompt.js";
import { researchInputHash } from "./input-hash.js";

const brief = {
  topic: "Redis",
  audience: "Dev",
  goal: "TTL",
  durationSec: 60,
  language: "vi" as const,
  tone: "friendly",
  visualStyle: "edu",
};
const doc: ResearchDocument = { sourceId: "ref-1", title: "a.md", origin: "user_reference", text: "TTL vô hạn." };
const documents = [doc];
const sources = [{ id: "ref-1", title: "a.md", origin: "user_reference" as const }];
const urlDoc: ResearchDocument = { sourceId: "url-1", title: "x", origin: "fetched_url", text: "a" };

describe("researchInputHash (P5-01)", () => {
  it("ổn định: cùng nội dung thì cùng hash, kể cả thứ tự key object khác", () => {
    const reordered = {
      visualStyle: "edu",
      tone: "friendly",
      language: "vi" as const,
      durationSec: 60,
      goal: "TTL",
      audience: "Dev",
      topic: "Redis",
    };
    expect(researchInputHash({ brief, documents, sources })).toBe(
      researchInputHash({ brief: reordered, documents: [{ ...doc }], sources: [...sources] }),
    );
    expect(researchInputHash({ brief, documents, sources })).toMatch(/^[a-f0-9]{64}$/);
  });

  it("đổi field brief, nội dung nguồn, URL nguồn, hay thêm nguồn thì đổi hash", () => {
    const base = researchInputHash({ brief, documents, sources });
    const variants = [
      researchInputHash({ brief: { ...brief, notes: "khác" }, documents, sources }),
      researchInputHash({ brief: { ...brief, durationSec: 61 }, documents, sources }),
      researchInputHash({ brief, documents: [{ ...doc, text: "TTL 60 giây." }], sources }),
      researchInputHash({
        brief,
        documents: [urlDoc],
        sources: [{ id: "url-1", title: "x", origin: "fetched_url", url: "https://a.example/" }],
      }),
      researchInputHash({
        brief,
        documents: [urlDoc],
        sources: [{ id: "url-1", title: "x", origin: "fetched_url", url: "https://b.example/" }],
      }),
      researchInputHash({ brief, documents: [doc, { ...doc, sourceId: "ref-2" }], sources }),
    ];
    expect(new Set([base, ...variants]).size).toBe(variants.length + 1);
  });
});
