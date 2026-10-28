import type { RemotionCaption } from "@studio/contracts";
import { describe, expect, it } from "vitest";
import { groupCaptionTokens } from "./group-caption-tokens";

describe("groupCaptionTokens", () => {
  it("gom token trong cửa sổ ~1200 ms, không gộp timestamp", () => {
    const captions: RemotionCaption[] = [
      { text: "Redis", startMs: 200, endMs: 400, timestampMs: 200, confidence: null },
      { text: " là", startMs: 450, endMs: 600, timestampMs: 450, confidence: null },
      { text: " API", startMs: 1600, endMs: 1800, timestampMs: 1600, confidence: null },
    ];
    const groups = groupCaptionTokens(captions, 1200);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.tokens).toHaveLength(2);
    expect(groups[1]?.tokens).toHaveLength(1);
    expect(groups[0]?.tokens[0]?.startMs).toBe(200);
  });
});
