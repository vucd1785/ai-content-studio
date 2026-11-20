import { describe, expect, it } from "vitest";
import { musicVolumeAt, speechRanges } from "./audio-mix";

const MIX = { base: 0.5, duck: 0.2, rampFrames: 10, fadeInFrames: 20, fadeOutFrames: 40 };

describe("trộn nhạc nền (ADR-019)", () => {
  it("gộp khoảng nói trùng lặp giữa các shot và nhân vật", () => {
    const shots = [
      { actors: [{ speakingRanges: [{ from: 10, to: 50 }] }, { speakingRanges: [] }] },
      {
        actors: [
          {
            speakingRanges: [
              { from: 10, to: 50 },
              { from: 45, to: 80 },
            ],
          },
        ],
      },
      { actors: [{ speakingRanges: [{ from: 200, to: 260 }] }] },
    ];
    expect(speechRanges(shots)).toEqual([
      { from: 10, to: 80 },
      { from: 200, to: 260 },
    ]);
  });

  it("hạ nhạc khi nói, lên lại giữa câu, vào dần và tắt dần", () => {
    const ranges = [{ from: 100, to: 200 }];
    expect(musicVolumeAt(0, ranges, 1000, MIX)).toBe(0);
    expect(musicVolumeAt(50, ranges, 1000, MIX)).toBeCloseTo(0.5);
    expect(musicVolumeAt(150, ranges, 1000, MIX)).toBeCloseTo(0.2);
    expect(musicVolumeAt(95, ranges, 1000, MIX)).toBeCloseTo(0.35);
    expect(musicVolumeAt(400, ranges, 1000, MIX)).toBeCloseTo(0.5);
    expect(musicVolumeAt(980, ranges, 1000, MIX)).toBeCloseTo(0.25);
  });
});
