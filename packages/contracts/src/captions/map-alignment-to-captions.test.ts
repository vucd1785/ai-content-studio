import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { AlignmentValidation, AlignmentWord } from "../media/tts.js";
import { MVP_VIDEO_FPS, SCENE_EDGE_PAD_MS } from "../timing/constants.js";
import {
  computeSceneTimingPlan,
  msToFrames,
  type SceneTiming,
  type SceneTimingPlan,
} from "../timing/scene-duration.js";
import {
  assertAlignmentReadyForCaptions,
  buildCaptionsFromSceneAlignments,
  CaptionMappingError,
  mapSceneAlignmentToCaptions,
  type SceneAlignmentForCaptions,
} from "./map-alignment-to-captions.js";
import { remotionCaptionSchema } from "./types.js";

function firstScene(plan: SceneTimingPlan): SceneTiming {
  const scene = plan.scenes[0];
  if (!scene) {
    throw new Error("expected at least one scene in plan");
  }
  return scene;
}

function okValidation(wordCount: number): AlignmentValidation {
  return {
    ok: true,
    errors: [],
    warnings: [],
    wordCount,
    alignedWordCount: wordCount,
    missingWords: [],
    coverageStartMs: 0,
    coverageEndMs: 1000,
    durationDeltaMs: 0,
    nonMonotonicWordRatio: 0,
    timelineOrderRatio: 1,
  };
}

function sceneInput(
  partial: Partial<SceneAlignmentForCaptions> & {
    words: AlignmentWord[];
    measuredDurationMs: number;
    fromMs: number;
    durationMs: number;
  },
): SceneAlignmentForCaptions {
  const wordCount = partial.words.length;
  return {
    timing: {
      sceneId: partial.timing?.sceneId ?? "scene-a",
      fromMs: partial.fromMs,
      durationMs: partial.durationMs,
    },
    measuredDurationMs: partial.measuredDurationMs,
    words: partial.words,
    validation: partial.validation ?? okValidation(wordCount),
    alignmentDurationMs: partial.alignmentDurationMs ?? partial.measuredDurationMs,
  };
}

describe("assertAlignmentReadyForCaptions", () => {
  it("từ thiếu (interval 0) bị lỗi", () => {
    const words: AlignmentWord[] = [{ text: "Redis", startMs: 0, endMs: 0 }];
    const validation: AlignmentValidation = {
      ok: false,
      errors: ["invalid interval"],
      warnings: [],
      wordCount: 1,
      alignedWordCount: 0,
      missingWords: ["Redis"],
      coverageStartMs: null,
      coverageEndMs: null,
      durationDeltaMs: null,
      nonMonotonicWordRatio: 1,
      timelineOrderRatio: 0,
    };
    expect(() => assertAlignmentReadyForCaptions(words, validation)).toThrow(CaptionMappingError);
    try {
      assertAlignmentReadyForCaptions(words, validation);
    } catch (error) {
      expect(error).toMatchObject({ code: "alignment_validation_failed" });
    }
  });

  it("timestamp không đơn điệu bị lỗi", () => {
    const words: AlignmentWord[] = [
      { text: "một", startMs: 0, endMs: 200 },
      { text: "hai", startMs: 100, endMs: 400 },
    ];
    const validation = okValidation(2);
    expect(() => assertAlignmentReadyForCaptions(words, validation)).toThrow(CaptionMappingError);
    try {
      assertAlignmentReadyForCaptions(words, validation);
    } catch (error) {
      expect(error).toMatchObject({ code: "non_monotonic_timestamps" });
    }
  });
});

describe("mapSceneAlignmentToCaptions", () => {
  it("mẫu tiếng Việt và thuật ngữ kỹ thuật", () => {
    const words: AlignmentWord[] = [
      { text: "Redis", startMs: 0, endMs: 320 },
      { text: "là", startMs: 350, endMs: 480 },
      { text: "API", startMs: 510, endMs: 720 },
      { text: "PostgreSQL.", startMs: 750, endMs: 1200 },
    ];
    const measured = 1300;
    const plan = computeSceneTimingPlan([{ sceneId: "explain", measuredDurationMs: measured }]);
    const timing = firstScene(plan);

    const captions = mapSceneAlignmentToCaptions(
      sceneInput({
        words,
        measuredDurationMs: measured,
        fromMs: timing.fromMs,
        durationMs: timing.durationMs,
        timing: { sceneId: timing.sceneId, fromMs: timing.fromMs, durationMs: timing.durationMs },
      }),
    );

    expect(captions).toHaveLength(4);
    expect(captions[0]?.text).toBe("Redis");
    expect(captions[1]?.text).toBe(" là");
    expect(captions[2]?.text).toBe(" API");
    expect(captions[0]?.startMs).toBe(SCENE_EDGE_PAD_MS);
    expect(captions[0]?.timestampMs).toBe(captions[0]?.startMs);
    for (const caption of captions) {
      expect(remotionCaptionSchema.safeParse(caption).success).toBe(true);
    }
  });

  it("từ đầu không có space thừa", () => {
    const words: AlignmentWord[] = [{ text: " Xin", startMs: 0, endMs: 200 }];
    const measured = 500;
    const plan = computeSceneTimingPlan([{ sceneId: "s", measuredDurationMs: measured }]);
    const timing = firstScene(plan);
    expect(() =>
      mapSceneAlignmentToCaptions(
        sceneInput({
          words,
          measuredDurationMs: measured,
          fromMs: timing.fromMs,
          durationMs: timing.durationMs,
        }),
      ),
    ).toThrow(CaptionMappingError);
  });

  it("áp dụng leading padding — audio bắt đầu sau 200 ms", () => {
    const words: AlignmentWord[] = [{ text: "Chào", startMs: 0, endMs: 400 }];
    const measured = 1000;
    const plan = computeSceneTimingPlan([{ sceneId: "intro", measuredDurationMs: measured }]);
    const timing = firstScene(plan);

    const [caption] = mapSceneAlignmentToCaptions(
      sceneInput({
        words,
        measuredDurationMs: measured,
        fromMs: timing.fromMs,
        durationMs: timing.durationMs,
      }),
    );

    expect(caption?.startMs).toBe(SCENE_EDGE_PAD_MS);
    expect(caption?.endMs).toBe(SCENE_EDGE_PAD_MS + 400);
  });

  it("nhiều cảnh liên tiếp — offset fromMs tích lũy", () => {
    const measuredA = 2000;
    const measuredB = 1500;
    const plan = computeSceneTimingPlan([
      { sceneId: "a", measuredDurationMs: measuredA },
      { sceneId: "b", measuredDurationMs: measuredB },
    ]);

    const wordsA: AlignmentWord[] = [{ text: "A", startMs: 0, endMs: 300 }];
    const wordsB: AlignmentWord[] = [{ text: "B", startMs: 0, endMs: 250 }];

    const sceneA = firstScene(plan);
    const sceneB = plan.scenes[1];
    if (!sceneB) {
      throw new Error("expected two scenes");
    }

    const captions = buildCaptionsFromSceneAlignments([
      sceneInput({
        words: wordsA,
        measuredDurationMs: measuredA,
        fromMs: sceneA.fromMs,
        durationMs: sceneA.durationMs,
        timing: sceneA,
      }),
      sceneInput({
        words: wordsB,
        measuredDurationMs: measuredB,
        fromMs: sceneB.fromMs,
        durationMs: sceneB.durationMs,
        timing: sceneB,
      }),
    ]);

    expect(captions[0]?.startMs).toBe(SCENE_EDGE_PAD_MS);
    expect(captions[1]?.startMs).toBe(sceneB.fromMs + SCENE_EDGE_PAD_MS);
    expect(captions[1]?.text).toBe("B");
  });

  it("khoảng dừng giữa các từ được giữ qua start/end", () => {
    const words: AlignmentWord[] = [
      { text: "một", startMs: 0, endMs: 200 },
      { text: "hai", startMs: 800, endMs: 1000 },
    ];
    const measured = 1100;
    const plan = computeSceneTimingPlan([{ sceneId: "pause", measuredDurationMs: measured }]);
    const timing = firstScene(plan);
    const captions = mapSceneAlignmentToCaptions(
      sceneInput({
        words,
        measuredDurationMs: measured,
        fromMs: timing.fromMs,
        durationMs: timing.durationMs,
      }),
    );
    expect(captions[0]?.endMs).toBe(SCENE_EDGE_PAD_MS + 200);
    expect(captions[1]?.startMs).toBe(SCENE_EDGE_PAD_MS + 800);
  });

  it("caption cuối không vượt biên cảnh", () => {
    const measured = 1000;
    const plan = computeSceneTimingPlan([{ sceneId: "edge", measuredDurationMs: measured }]);
    const timing = firstScene(plan);
    const words: AlignmentWord[] = [{ text: "cuối", startMs: 900, endMs: 1000 }];
    const captions = mapSceneAlignmentToCaptions(
      sceneInput({
        words,
        measuredDurationMs: measured,
        fromMs: timing.fromMs,
        durationMs: timing.durationMs,
      }),
    );
    const sceneEnd = timing.fromMs + timing.durationMs;
    expect(captions.at(-1)?.endMs).toBeLessThanOrEqual(sceneEnd);
    expect(captions.at(-1)?.endMs).toBeLessThanOrEqual(SCENE_EDGE_PAD_MS + measured);
  });

  it("nhất quán với P1-01 — sceneEnd khớp durationMs plan", () => {
    const measured = 44000;
    const plan = computeSceneTimingPlan([{ sceneId: "gate", measuredDurationMs: measured }]);
    const timing = firstScene(plan);
    const words: AlignmentWord[] = [{ text: "x", startMs: 100, endMs: 200 }];
    const captions = mapSceneAlignmentToCaptions(
      sceneInput({
        words,
        measuredDurationMs: measured,
        fromMs: timing.fromMs,
        durationMs: timing.durationMs,
      }),
    );
    expect(timing.durationInFrames).toBe(msToFrames(timing.durationMs, MVP_VIDEO_FPS));
    expect(captions[0]?.startMs).toBeGreaterThanOrEqual(timing.fromMs + SCENE_EDGE_PAD_MS);
    expect(captions[0]?.endMs).toBeLessThanOrEqual(timing.fromMs + timing.durationMs);
  });

  it("output xác định", () => {
    const words: AlignmentWord[] = [
      { text: "Laravel", startMs: 10, endMs: 300 },
      { text: "và", startMs: 320, endMs: 450 },
    ];
    const measured = 500;
    const plan = computeSceneTimingPlan([{ sceneId: "d", measuredDurationMs: measured }]);
    const timing = firstScene(plan);
    const input = sceneInput({
      words,
      measuredDurationMs: measured,
      fromMs: timing.fromMs,
      durationMs: timing.durationMs,
    });
    expect(mapSceneAlignmentToCaptions(input)).toEqual(mapSceneAlignmentToCaptions(input));
  });

  it("từ chối endMs vượt duration audio", () => {
    const measured = 500;
    const plan = computeSceneTimingPlan([{ sceneId: "x", measuredDurationMs: measured }]);
    const timing = firstScene(plan);
    const words: AlignmentWord[] = [{ text: "late", startMs: 0, endMs: 600 }];
    expect(() =>
      mapSceneAlignmentToCaptions(
        sceneInput({
          words,
          measuredDurationMs: measured,
          fromMs: timing.fromMs,
          durationMs: timing.durationMs,
        }),
      ),
    ).toThrow(CaptionMappingError);
  });
});

describe("P1-02 alignment artifact compatibility", () => {
  it("map artifact Whisper P0-03 trên đĩa (nếu có)", () => {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
    const artifactPath = join(
      repoRoot,
      "data/alignment/42daebb50e1a43759a1cdc7a439deb04-whisper.json",
    );
    const raw = JSON.parse(readFileSync(artifactPath, "utf8")) as {
      durationMs: number;
      words: AlignmentWord[];
      validation: AlignmentValidation & { timelineOrderRatio?: number | null };
    };
    const validation: AlignmentValidation = {
      ...raw.validation,
      timelineOrderRatio: raw.validation.timelineOrderRatio ?? 1,
      nonMonotonicWordRatio: raw.validation.nonMonotonicWordRatio ?? 0,
    };
    const plan = computeSceneTimingPlan([
      { sceneId: "p0-03-sample", measuredDurationMs: raw.durationMs },
    ]);
    const timing = firstScene(plan);
    const captions = mapSceneAlignmentToCaptions({
      timing,
      measuredDurationMs: raw.durationMs,
      words: raw.words,
      validation,
      alignmentDurationMs: raw.durationMs,
    });
    expect(captions.length).toBe(raw.words.length);
    expect(captions[0]?.text).toBe("Redis");
    expect(captions[1]?.text).toBe(" là");
    expect(captions.at(-1)?.endMs).toBeLessThanOrEqual(timing.fromMs + timing.durationMs);
  });

  it("parse cấu trúc words giống align response tối thiểu", () => {
    const sampleWords: AlignmentWord[] = [
      { text: "Redis", startMs: 0, endMs: 180 },
      { text: "cache", startMs: 200, endMs: 450 },
    ];
    const measured = 500;
    const plan = computeSceneTimingPlan([{ sceneId: "compat", measuredDurationMs: measured }]);
    const timing = firstScene(plan);
    const captions = mapSceneAlignmentToCaptions(
      sceneInput({
        words: sampleWords,
        measuredDurationMs: measured,
        fromMs: timing.fromMs,
        durationMs: timing.durationMs,
      }),
    );
    expect(captions.length).toBe(2);
    expect(captions.every((c) => c.confidence === null)).toBe(true);
  });
});
