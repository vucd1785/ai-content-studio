import { createHash } from "node:crypto";
import type { ResearchSource } from "@studio/contracts";
import type { ResearchDocument } from "../llm/research-prompt.js";
import type { BriefInput } from "../llm/types.js";

/** Tăng khi prompt, schema research hoặc cách gom nguồn đổi: cache cũ tự hết hiệu lực. */
export const RESEARCH_CACHE_VERSION = 1;

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Hash đầu vào của job research (P5-01): nội dung brief (không phải id brief) và nội dung từng nguồn
 * đã đọc/fetch (hash văn bản, không phải id reference). Cùng hash thì tái sử dụng artifact research.
 * Mảng có thứ tự cố định, nên thứ tự key object không ảnh hưởng.
 */
export function researchInputHash(input: {
  brief: BriefInput;
  documents: readonly ResearchDocument[];
  sources: readonly ResearchSource[];
}): string {
  const { brief } = input;
  const urlBySource = new Map(input.sources.map((source) => [source.id, source.url ?? null]));
  const canonical = [
    RESEARCH_CACHE_VERSION,
    [
      brief.topic,
      brief.audience,
      brief.goal,
      brief.durationSec,
      brief.language,
      brief.tone,
      brief.visualStyle,
      brief.notes ?? null,
    ],
    input.documents.map((doc) => [doc.sourceId, doc.origin, doc.title, urlBySource.get(doc.sourceId) ?? null, sha256(doc.text)]),
  ];
  return sha256(JSON.stringify(canonical));
}
