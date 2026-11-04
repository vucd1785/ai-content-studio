import {
  type AlignResponse,
  type FormatPack,
  getFormatPack,
  type ScriptV2,
} from "@studio/contracts";
import { describe, expect, it } from "vitest";
import type { SceneLineAudio, SceneMediaArtifacts } from "./build-render-props.js";
import {
  assignSlots,
  buildStickStoryRenderProps,
  CUT_LEAD_FRAMES,
  fixPacing,
} from "./build-stick-story-props.js";

const WHAT_IF = getFormatPack("what_if", 1) as FormatPack;
const CAST = [
  { characterKey: "ti", skinAssetId: "skin_ti", color: "#ffb08a" },
  { characterKey: "bit", skinAssetId: "skin_bit", color: "#8fe9ff" },
  { characterKey: "dau", skinAssetId: "skin_dau", color: "#6cc04a" },
];

/** Alignment giả: mỗi từ 300 ms trong đoạn câu, câu cách nhau đúng như `lines`. */
function media(
  sceneId: string,
  lines: { lineId: string; speaker: string; text: string; startMs: number }[],
): SceneMediaArtifacts {
  const words: AlignResponse["words"] = [];
  const spans: SceneLineAudio[] = lines.map((line) => {
    const tokens = line.text.split(" ");
    tokens.forEach((t, i) => {
      words.push({ text: t, startMs: line.startMs + i * 300, endMs: line.startMs + i * 300 + 280 });
    });
    return {
      ...line,
      voiceId: line.speaker === "ti" ? "Hải Đăng" : "Trúc Ly",
      wavArtifactId: "a".repeat(32),
      endMs: line.startMs + tokens.length * 300,
    };
  });
  const durationMs = spans.at(-1)?.endMs ?? 0;
  return {
    sceneId,
    wavArtifactId: "b".repeat(32),
    measuredDurationMs: durationMs,
    lines: spans,
    alignment: {
      alignmentArtifactId: "b".repeat(32),
      audioArtifactId: "b".repeat(32),
      durationMs,
      transcript: lines.map((l) => l.text).join(" "),
      engine: "whisper",
      modelId: "fake",
      words,
      validation: {
        ok: true,
        errors: [],
        warnings: [],
        wordCount: words.length,
        alignedWordCount: words.length,
        missingWords: [],
        coverageStartMs: 0,
        coverageEndMs: durationMs,
        durationDeltaMs: 20,
        nonMonotonicWordRatio: 0,
        timelineOrderRatio: 1,
      },
      gate: {
        alignedWordRatio: 1,
        durationDeltaMs: 20,
        coverageWithin250Ms: true,
        ratioAtLeast90Pct: true,
        validationOk: true,
        passesGate: true,
        gatePolicyVersion: "2.1.0-repair-zero-length",
        trailingSilenceVerified: false,
        trailingSilenceMs: null,
        coverageAcceptanceReason: "within_250ms",
      },
      processingMs: 7,
    },
  };
}

const actor = (character: string, action = "pose_stand", expression = "expr_happy") => ({
  character,
  action,
  expression,
});

function script(cutWord = "Nghe"): ScriptV2 {
  return {
    schemaVersion: 2,
    language: "vi",
    formatId: "what_if",
    formatVersion: 1,
    title: "Thử",
    sources: [],
    scenes: [
      {
        id: "mo-dau",
        beat: "cold_open",
        sourceIds: [],
        lines: [
          { id: "l1", speaker: "ti", text: "Bit ơi mình không ngủ" },
          { id: "l2", speaker: "bit", text: "Nghe hấp dẫn đấy" },
        ],
        shots: [
          {
            id: "s1",
            lineId: "l1",
            cutOnWord: "Bit",
            background: "bg_room",
            shotSize: "wide",
            focus: "ti",
            actors: [actor("ti", "action_wave"), actor("bit")],
          },
          {
            id: "s2",
            lineId: "l2",
            cutOnWord: cutWord,
            background: "bg_room",
            shotSize: "close",
            focus: "bit",
            actors: [actor("bit", "action_talk")],
          },
        ],
      },
      {
        id: "ket",
        beat: "twist",
        sourceIds: [],
        lines: [{ id: "l3", speaker: "ti", text: "Thôi đi ngủ" }],
        shots: [
          {
            id: "s3",
            lineId: "l3",
            cutOnWord: "Thôi",
            background: "bg_classroom",
            shotSize: "medium",
            focus: "ti",
            actors: [actor("ti", "action_walk")],
          },
        ],
      },
    ],
  };
}

const artifacts = () => [
  media("mo-dau", [
    { lineId: "l1", speaker: "ti", text: "Bit ơi mình không ngủ", startMs: 0 },
    { lineId: "l2", speaker: "bit", text: "Nghe hấp dẫn đấy", startMs: 1900 },
  ]),
  media("ket", [{ lineId: "l3", speaker: "ti", text: "Thôi đi ngủ", startMs: 0 }]),
];

const build = (s = script()) =>
  buildStickStoryRenderProps({
    script: s,
    sceneArtifacts: artifacts(),
    cast: CAST,
    format: WHAT_IF,
    brand: { fontFamily: "system-ui", textColor: "#ffffff" },
    audioStorageKey: "render/audio.wav",
    totalDurationMs: 6000,
  });

describe("dựng render props StickStory từ shot list", () => {
  it("cắt trước từ khóa 2 frame theo alignment; shot đầu cảnh bắt đầu ở đầu cảnh", () => {
    const { props } = build();
    const [s1, s2, s3] = props.shots;
    expect(s1?.fromFrame).toBe(0);
    // "Nghe" bắt đầu 1900 ms trong WAV; audio bắt đầu sau 200 ms đệm đầu cảnh → 2100 ms = frame 63.
    expect(s2?.fromFrame).toBe(63 - CUT_LEAD_FRAMES);
    expect((s1?.durationInFrames ?? 0) + (s2?.durationInFrames ?? 0)).toBe(
      Math.round(((3100 + 400) * 30) / 1000),
    );
    expect(s3?.fromFrame).toBe((s2?.fromFrame ?? 0) + (s2?.durationInFrames ?? 0));
  });

  it("nhân vật giữ nguyên bên trong cảnh; mở miệng đúng lời của mình", () => {
    const { props } = build();
    const [s1, s2] = props.shots;
    expect(s1?.actors.map((a) => [a.character, a.slot, a.skin])).toEqual([
      ["ti", "left", "skin_ti"],
      ["bit", "right", "skin_bit"],
    ]);
    // Bit một mình ở s2 vẫn đứng bên phải.
    expect(s2?.actors[0]?.slot).toBe("right");
    expect(s1?.actors[0]?.speakingRanges).toEqual([{ from: 6, to: 6 + 44 }]);
    expect(s1?.actors[1]?.speakingRanges).toEqual([{ from: 63, to: 63 + 35 }]);
  });

  it("phụ đề tô màu theo người nói; version kit trong templateVersion", () => {
    const { props } = build();
    expect(props.brand.speakerColors).toMatchObject({ ti: "#ffb08a", bit: "#8fe9ff" });
    expect(props.captions.map((c) => c.speaker)).toEqual([
      "ti",
      "ti",
      "ti",
      "ti",
      "ti",
      "bit",
      "bit",
      "bit",
      "bit",
      "ti",
      "ti",
      "ti",
    ]);
    expect(props.templateVersion).toBe(`1.1.0+kit.${props.motionKitVersion}`);
  });

  it("không tìm thấy từ cắt: cắt ở đầu câu và có warning cut_word_not_found", () => {
    const { props, warnings } = build(script("Tí"));
    expect(props.shots[1]?.fromFrame).toBe(63);
    expect(warnings).toContainEqual({
      code: "cut_word_not_found",
      sceneId: "mo-dau",
      shotId: "s2",
      cutOnWord: "Tí",
    });
  });

  it("nhịp ngoài khoảng của gói mà code không sửa được thì warning pacing_violation", () => {
    // 3 shot trong 4,8 giây = 37,5 cắt/phút, vượt 27 của what_if.
    const { warnings } = build();
    expect(warnings).toContainEqual({
      code: "pacing_violation",
      violation: { rule: "cuts_per_minute", cutsPerMinute: 37.5, min: 20, max: 27 },
    });
  });
});

describe("sửa luật nhịp bằng code", () => {
  const shot = (
    shotId: string,
    fromFrame: number,
    durationInFrames: number,
    shotSize: "wide" | "medium" | "close" | "high",
  ) => ({
    shotId,
    sceneId: "a",
    fromFrame,
    durationInFrames,
    background: "bg_room",
    shotSize,
    camera: "cam_static",
    focus: "ti",
    actors: [
      {
        character: "ti",
        skin: "skin_ti",
        action: "pose_stand",
        expression: "expr_happy",
        slot: "left" as const,
        speakingRanges: [],
      },
    ],
    props: [],
    ambience: [],
  });

  it("shot dài hơn 3 giây được chia, các phần xen cỡ cảnh", () => {
    const { shots, warnings } = fixPacing(
      [shot("s1", 0, 200, "medium"), shot("s2", 200, 60, "wide")],
      WHAT_IF,
      30,
    );
    expect(shots.map((s) => [s.shotId, s.fromFrame, s.durationInFrames, s.shotSize])).toEqual([
      ["s1", 0, 66, "medium"],
      ["s1b", 66, 66, "close"],
      ["s1c", 132, 68, "medium"],
      ["s2", 200, 60, "wide"],
    ]);
    expect(warnings).toEqual([
      { code: "pacing_fixed", shotId: "s1", action: "split" },
      { code: "pacing_fixed", shotId: "s1b", action: "shot_size_changed" },
    ]);
  });

  it("hai shot liền nhau cùng cỡ: đổi cỡ của shot sau, tránh trùng cả shot kế tiếp", () => {
    const { shots } = fixPacing(
      [shot("s1", 0, 60, "medium"), shot("s2", 60, 60, "medium"), shot("s3", 120, 60, "close")],
      WHAT_IF,
      30,
    );
    expect(shots.map((s) => s.shotSize)).toEqual(["medium", "wide", "close"]);
  });

  it("shot ba người được chia chỉ xen giữa wide và high (bổ sung ADR-013 2026-11-03)", () => {
    const base = shot("s1", 0, 200, "wide");
    const [actor] = base.actors;
    const trio = {
      ...base,
      actors: [
        actor,
        { ...actor, character: "bit", skin: "skin_bit", slot: "right" as const },
        { ...actor, character: "dau", skin: "skin_dau", slot: "center" as const },
      ],
    } as typeof base;
    const { shots } = fixPacing([trio], WHAT_IF, 30);
    expect(shots.map((s) => s.shotSize)).toEqual(["wide", "high", "wide"]);
  });

  it("vị trí: người thứ nhất trái, thứ hai phải, thứ ba giữa", () => {
    const slots = assignSlots([
      { actors: [{ character: "bit" }] },
      { actors: [{ character: "ti" }, { character: "dau" }] },
    ]);
    expect([...slots]).toEqual([
      ["bit", "left"],
      ["ti", "right"],
      ["dau", "center"],
    ]);
  });
});
