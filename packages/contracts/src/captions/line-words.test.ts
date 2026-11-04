import { describe, expect, it } from "vitest";
import type { AlignmentValidation, AlignmentWord } from "../media/tts.js";
import { assignWordsToLines, type LineSpan, lineWordCount } from "./line-words.js";
import { CaptionMappingError, mapSceneAlignmentToCaptions } from "./map-alignment-to-captions.js";

const lines: LineSpan[] = [
  { lineId: "l1", speaker: "ti", text: "Bit ơi, thật à?", startMs: 0, endMs: 900 },
  { lineId: "l2", speaker: "bit", text: "Thật — đó!", startMs: 1300, endMs: 1900 },
];
const w = (text: string, startMs: number, endMs: number): AlignmentWord => ({
  text,
  startMs,
  endMs,
});

describe("assignWordsToLines", () => {
  it("đếm token như service alignment", () => {
    expect(lineWordCount("Bit ơi, thật à?")).toBe(4);
    expect(lineWordCount("Thật — đó!")).toBe(2);
    expect(lineWordCount("chậm !")).toBe(1);
  });

  it("gán theo thứ tự token, từ trong dung sai giữ nguyên", () => {
    const words = [
      w("Bit", 0, 200),
      w("ơi,", 220, 400),
      w("thật", 420, 650),
      w("à?", 670, 1000),
      w("Thật", 1250, 1500),
      w("đó!", 1520, 1880),
    ];
    const r = assignWordsToLines(words, lines);
    expect(r.speakers).toEqual(["ti", "ti", "ti", "ti", "bit", "bit"]);
    expect(r.lineIds).toEqual(["l1", "l1", "l1", "l1", "l2", "l2"]);
    expect(r.words).toEqual(words);
    expect(r.warnings).toEqual([]);
  });

  it("từ lệch quá dung sai bị kẹp vào đoạn câu, kèm warning", () => {
    const words = [
      w("Bit", 0, 200),
      w("ơi,", 220, 400),
      w("thật", 420, 650),
      w("à?", 700, 1200),
      w("Thật", 1300, 1500),
      w("đó!", 1520, 1880),
    ];
    const r = assignWordsToLines(words, lines);
    expect(r.words[3]).toEqual(w("à?", 700, 900));
    expect(r.warnings).toEqual([
      {
        code: "word_clamped_to_line",
        lineId: "l1",
        wordIndex: 3,
        word: "à?",
        fromMs: [700, 1200],
        toMs: [700, 900],
      },
    ]);
  });

  it("số từ khác tổng token: gán theo điểm giữa, kèm warning", () => {
    const words = [w("Bit", 0, 300), w("ơi", 320, 800), w("Thật", 1300, 1600), w("đó", 1620, 1880)];
    const r = assignWordsToLines(words, lines);
    expect(r.speakers).toEqual(["ti", "ti", "bit", "bit"]);
    expect(r.warnings).toEqual([{ code: "word_line_count_mismatch", expected: 6, actual: 4 }]);
  });
});

describe("phụ đề có người nói", () => {
  const validation: AlignmentValidation = {
    ok: true,
    errors: [],
    warnings: [],
    wordCount: 2,
    alignedWordCount: 2,
    missingWords: [],
    coverageStartMs: 0,
    coverageEndMs: 500,
    durationDeltaMs: 0,
    nonMonotonicWordRatio: 0,
    timelineOrderRatio: 1,
  };
  const base = {
    timing: { sceneId: "s", fromMs: 0, durationMs: 900 },
    measuredDurationMs: 500,
    alignmentDurationMs: 500,
    validation,
    words: [w("Chào", 0, 200), w("bạn", 250, 500)],
  };

  it("mỗi caption mang speaker của từ; không truyền speakers thì không có trường", () => {
    expect(
      mapSceneAlignmentToCaptions({ ...base, speakers: ["ti", "bit"] }).map((c) => c.speaker),
    ).toEqual(["ti", "bit"]);
    expect(mapSceneAlignmentToCaptions(base).every((c) => !("speaker" in c))).toBe(true);
  });

  it("speakers lệch số từ bị từ chối", () => {
    expect(() => mapSceneAlignmentToCaptions({ ...base, speakers: ["ti"] })).toThrow(
      CaptionMappingError,
    );
  });
});
