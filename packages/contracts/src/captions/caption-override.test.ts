import { describe, expect, it } from "vitest";
import { SCENE_EDGE_PAD_MS } from "../timing/constants.js";
import type { RemotionCaption } from "./types.js";
import {
  applyCaptionOverride,
  CaptionOverrideError,
  parseCaptionTimingOverride,
  type ApplyCaptionOverrideContext,
  type CaptionTimingOverride,
} from "./caption-override.js";

function sampleCaptions(): RemotionCaption[] {
  return [
    { text: "A", startMs: 200, endMs: 400, timestampMs: 200, confidence: null },
    { text: " B", startMs: 500, endMs: 700, timestampMs: 500, confidence: null },
    { text: " C", startMs: 800, endMs: 1000, timestampMs: 800, confidence: null },
  ];
}

function sampleContext(): ApplyCaptionOverrideContext {
  return {
    scenes: [
      {
        sceneId: "scene-a",
        fromMs: 0,
        durationMs: 5000,
        measuredDurationMs: 1200,
        wordCount: 3,
      },
    ],
  };
}

function validOverride(partial?: Partial<CaptionTimingOverride>): CaptionTimingOverride {
  return {
    schemaVersion: 1,
    overrides: [
      {
        sceneId: "scene-a",
        wordIndex: 1,
        startMs: 520,
        endMs: 750,
      },
    ],
    ...partial,
  };
}

describe("parseCaptionTimingOverride", () => {
  it("chấp nhận override hợp lệ", () => {
    const parsed = parseCaptionTimingOverride(validOverride());
    expect(parsed.overrides[0]?.startMs).toBe(520);
  });

  it("từ chối timestamp âm", () => {
    expect(() =>
      parseCaptionTimingOverride(
        validOverride({
          overrides: [{ sceneId: "scene-a", wordIndex: 0, startMs: -1, endMs: 100 }],
        }),
      ),
    ).toThrow();
  });

  it("từ chối timestamp không hữu hạn", () => {
    expect(() =>
      parseCaptionTimingOverride(
        validOverride({
          overrides: [
            {
              sceneId: "scene-a",
              wordIndex: 0,
              startMs: Number.NaN,
              endMs: 100,
            },
          ],
        }),
      ),
    ).toThrow();
  });

  it("từ chối endMs <= startMs", () => {
    expect(() =>
      parseCaptionTimingOverride(
        validOverride({
          overrides: [{ sceneId: "scene-a", wordIndex: 0, startMs: 500, endMs: 500 }],
        }),
      ),
    ).toThrow();
  });

  it("từ chối trùng mục tiêu", () => {
    expect(() =>
      parseCaptionTimingOverride(
        validOverride({
          overrides: [
            { sceneId: "scene-a", wordIndex: 1, startMs: 520, endMs: 600 },
            { sceneId: "scene-a", wordIndex: 1, startMs: 530, endMs: 610 },
          ],
        }),
      ),
    ).toThrow();
  });

  it("từ chối sceneId rỗng", () => {
    expect(() =>
      parseCaptionTimingOverride(
        validOverride({
          overrides: [{ sceneId: "", wordIndex: 0, startMs: 200, endMs: 300 }],
        }),
      ),
    ).toThrow();
  });
});

describe("applyCaptionOverride", () => {
  it("đổi timing một từ và giữ text", () => {
    const original = sampleCaptions();
    const result = applyCaptionOverride(original, validOverride(), sampleContext());

    expect(result[1]?.startMs).toBe(520);
    expect(result[1]?.endMs).toBe(750);
    expect(result[1]?.timestampMs).toBe(520);
    expect(result[1]?.text).toBe(" B");
    expect(original[1]?.startMs).toBe(500);
  });

  it("giữ nguyên từ không bị override", () => {
    const original = sampleCaptions();
    const result = applyCaptionOverride(original, validOverride(), sampleContext());
    expect(result[0]).toEqual(original[0]);
    expect(result[2]).toEqual(original[2]);
  });

  it("áp dụng nhiều override hợp lệ", () => {
    const result = applyCaptionOverride(
      sampleCaptions(),
      validOverride({
        overrides: [
          { sceneId: "scene-a", wordIndex: 0, startMs: 210, endMs: 390 },
          { sceneId: "scene-a", wordIndex: 2, startMs: 820, endMs: 980 },
        ],
      }),
      sampleContext(),
    );
    expect(result[0]?.startMs).toBe(210);
    expect(result[2]?.endMs).toBe(980);
  });

  it("từ chối sceneId không tồn tại", () => {
    expect(() =>
      applyCaptionOverride(
        sampleCaptions(),
        validOverride({
          overrides: [{ sceneId: "missing", wordIndex: 0, startMs: 200, endMs: 300 }],
        }),
        sampleContext(),
      ),
    ).toThrow(CaptionOverrideError);
  });

  it("từ chối wordIndex ngoài phạm vi", () => {
    expect(() =>
      applyCaptionOverride(
        sampleCaptions(),
        validOverride({
          overrides: [{ sceneId: "scene-a", wordIndex: 9, startMs: 200, endMs: 300 }],
        }),
        sampleContext(),
      ),
    ).toThrow(CaptionOverrideError);
  });

  it("từ chối không đơn điệu sau override", () => {
    expect(() =>
      applyCaptionOverride(
        sampleCaptions(),
        validOverride({
          overrides: [{ sceneId: "scene-a", wordIndex: 1, startMs: 350, endMs: 600 }],
        }),
        sampleContext(),
      ),
    ).toThrow(CaptionOverrideError);
  });

  it("từ chối vượt biên audio cảnh", () => {
    const context = sampleContext();
    const audioEnd = SCENE_EDGE_PAD_MS + context.scenes[0]!.measuredDurationMs;
    expect(() =>
      applyCaptionOverride(
        sampleCaptions(),
        validOverride({
          overrides: [
            {
              sceneId: "scene-a",
              wordIndex: 2,
              startMs: audioEnd - 50,
              endMs: audioEnd + 10,
            },
          ],
        }),
        context,
      ),
    ).toThrow(CaptionOverrideError);
  });
});
