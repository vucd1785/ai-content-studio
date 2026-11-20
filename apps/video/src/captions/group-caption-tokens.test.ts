import type { RemotionCaption } from "@studio/contracts";
import { describe, expect, it } from "vitest";
import {
  findDisplayedGroup,
  groupCaptionPhrases,
  groupCaptionTokens,
} from "./group-caption-tokens";

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

describe("groupCaptionPhrases (cụm nghĩa)", () => {
  const tok = (text: string, startMs: number, speaker = "ti"): RemotionCaption => ({
    text,
    startMs,
    endMs: startMs + 200,
    timestampMs: startMs,
    confidence: null,
    speaker,
  });
  const words = (text: string, from: number, speaker = "ti") =>
    text.split(" ").map((w, i) => tok(i === 0 ? w : ` ${w}`, from + i * 220, speaker));

  it("ngắt ở dấu câu, câu cảm ngắn đi cùng vế sau", () => {
    const groups = groupCaptionPhrases([
      ...words("Ực ực! Nước sông ngọt mát ghê!", 0),
      ...words("Sai rồi Tí. Cá với nước mắt không làm biển mặn đâu.", 2000, "bit"),
    ]);
    expect(groups.map((g) => g.tokens.map((t) => t.text).join(""))).toEqual([
      "Ực ực! Nước sông ngọt mát ghê!",
      "Sai rồi Tí.",
      " Cá với nước mắt không làm biển mặn đâu.",
    ]);
  });

  it("không vắt qua hai người nói và giữ chữ một lúc rồi mới tắt", () => {
    const groups = groupCaptionPhrases([...words("Mặn quá", 0), ...words("Đúng", 500, "bit")]);
    expect(groups).toHaveLength(2);
    expect(findDisplayedGroup(groups, 450)?.tokens[0]?.text).toBe("Mặn");
    expect(findDisplayedGroup(groups, 520)?.tokens[0]?.text).toBe("Đúng");
    expect(findDisplayedGroup(groups, 5000)).toBeUndefined();
  });
});
