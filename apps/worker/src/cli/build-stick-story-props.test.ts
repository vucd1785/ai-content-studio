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
  directCameras,
  fixPacing,
  groupSlots,
  planSfx,
  SFX_MIN_GAP_FRAMES,
  storyCards,
} from "./build-stick-story-props.js";

const WHAT_IF = getFormatPack("what_if", 1) as FormatPack;
const STORY_V2 = getFormatPack("story", 2) as FormatPack;
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
        gatePolicyVersion: "2.2.0-extend-last-word",
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
    expect(props.templateVersion).toBe(`1.12.0+kit.${props.motionKitVersion}`);
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

  it("đồ vật: giữ đồ vật có chỗ, bỏ đồ vật ở cỡ cận và đồ vật thừa kèm warning prop_dropped (P6-19)", () => {
    const s = script();
    const [s1, s2] = s.scenes[0]?.shots ?? [];
    const s3 = s.scenes[1]?.shots[0];
    if (s1 === undefined || s2 === undefined || s3 === undefined) {
      throw new Error("fixture");
    }
    s1.props = ["prop_server_overload", "prop_packets", "prop_shield"];
    s2.props = ["prop_server"];
    s3.props = ["prop_shield", "prop_laptop"];
    const { props, warnings } = build(s);
    expect(props.shots.map((shot) => shot.props)).toEqual([
      ["prop_server_overload", "prop_packets"],
      [],
      ["prop_shield"],
    ]);
    expect(warnings.filter((w) => w.code === "prop_dropped")).toEqual([
      { code: "prop_dropped", shotId: "s1", propId: "prop_shield" },
      { code: "prop_dropped", shotId: "s2", propId: "prop_server" },
      { code: "prop_dropped", shotId: "s3", propId: "prop_laptop" },
    ]);
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

  it("thẻ mở và kết theo cảnh title/outro (ADR-026): chữ trắng là câu nhân vật đọc, phụ đề hai cảnh đó bị ẩn", () => {
    const line = (text: string) => [{ id: "l1", speaker: "bit", text }];
    const script = {
      title: "Vì sao đom đóm phát sáng?",
      scenes: [
        { id: "tieu-de", beat: "title", lines: line("Vì sao   đom đóm phát sáng?") },
        { id: "mo", beat: "cold_open", lines: line("Ơ!") },
        {
          id: "ket",
          beat: "outro",
          lines: line("Follow chúng mình để biết thêm nhiều kiến thức thú vị nhé!"),
        },
      ],
    } as unknown as Parameters<typeof storyCards>[0];
    const ranges = [
      { sceneId: "tieu-de", fromMs: 0, durationMs: 3000, fromFrame: 0, toFrame: 90 },
      { sceneId: "mo", fromMs: 3000, durationMs: 2000, fromFrame: 90, toFrame: 150 },
      { sceneId: "ket", fromMs: 5000, durationMs: 4000, fromFrame: 150, toFrame: 270 },
    ];
    const { cards, hideCaptionsIn } = storyCards(script, "Kênh Tò Mò", ranges);
    expect(cards).toEqual({
      intro: { title: "Vì sao đom đóm phát sáng?", toFrame: 90 },
      outro: {
        channel: "Kênh Tò Mò",
        cta: "Follow chúng mình để biết thêm nhiều kiến thức thú vị nhé!",
        button: "Follow",
        fromFrame: 150,
      },
    });
    expect(hideCaptionsIn).toEqual([
      { fromMs: 0, toMs: 3000 },
      { fromMs: 5000, toMs: 9000 },
    ]);
    // Màu nhấn của kênh tô tên kênh trên thẻ chuyển động; màu không hợp lệ thì bỏ.
    expect(storyCards(script, "Kênh Tò Mò", ranges, "#f26b3a").cards.outro.accent).toBe("#f26b3a");
    expect(storyCards(script, "Kênh Tò Mò", ranges, "cam").cards.outro).not.toHaveProperty(
      "accent",
    );
    // ADR-028: avatar kênh đi kèm thẻ mời theo dõi.
    expect(
      storyCards(script, "Tí Hay Hỏi", ranges, "#f26b3a", "brand/kenh-a/avatar-0123456789ab.webp")
        .cards.outro.avatar,
    ).toBe("brand/kenh-a/avatar-0123456789ab.webp");
    // Gói cũ (không có title/outro): thẻ như ADR-021, giữ mọi phụ đề.
    const old = storyCards(
      { ...script, scenes: [script.scenes[1]] } as typeof script,
      null,
      ranges,
    );
    expect(old.cards.intro).toEqual({ title: "Vì sao đom đóm phát sáng?" });
    expect(old.cards.outro).toEqual({ channel: null, cta: "Theo dõi để xem tiếp nhé!" });
    expect(old.hideCaptionsIn).toEqual([]);
  });

  it("ảnh kết mời theo dõi (ADR-026): người cao nhất đứng giữa, hai người còn lại hai bên", () => {
    const heights: Record<string, number> = { dau: 300, ti: 520, bit: 430 };
    const shots = [{ actors: [{ character: "dau" }, { character: "ti" }, { character: "bit" }] }];
    expect(Object.fromEntries(groupSlots(shots, (c) => heights[c] ?? 0))).toEqual({
      dau: "left",
      bit: "right",
      ti: "center",
    });
    // Hai người thì giữ luật thường.
    expect(
      Object.fromEntries(
        groupSlots([{ actors: [{ character: "ti" }, { character: "bit" }] }], () => 1),
      ),
    ).toEqual({
      ti: "left",
      bit: "right",
    });
  });

  it("cảnh mời theo dõi (ADR-026) giữ một shot: không chia, không đổi cỡ, máy không bị đổi", () => {
    const outro = { ...shot("s9", 60, 200, "wide"), sceneId: "ket", camera: "cam_push_in" };
    const hold = new Set(["ket"]);
    const { shots, warnings } = fixPacing([shot("s1", 0, 60, "wide"), outro], WHAT_IF, 30, hold);
    expect(shots.map((s) => [s.shotId, s.durationInFrames, s.shotSize])).toEqual([
      ["s1", 60, "wide"],
      ["s9", 200, "wide"],
    ]);
    expect(warnings).toEqual([]);
    expect(directCameras(shots, () => true, hold).at(-1)?.camera).toBe("cam_push_in");
    // Không giữ thì vẫn chia như mọi shot.
    expect(fixPacing([outro], WHAT_IF, 30).shots.length).toBeGreaterThan(1);
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

  it("shot hai nhân vật bị chia: phần lẻ cắt sang người nghe, người nói vẫn mở miệng (ADR-024)", () => {
    const two = {
      ...shot("s1", 0, 315, "medium"),
      actors: [
        ...shot("s1", 0, 315, "medium").actors,
        {
          character: "bit",
          skin: "skin_bit",
          action: "pose_stand",
          expression: "expr_surprised",
          slot: "right" as const,
          speakingRanges: [],
        },
      ],
    };
    const { shots } = fixPacing([two], getFormatPack("story", 3) as FormatPack, 30);
    // 3,5 giây là 105 frame: 315 frame thành ba phần.
    expect(shots.map((s) => [s.shotId, s.durationInFrames, s.focus])).toEqual([
      ["s1", 105, "ti"],
      ["s1b", 105, "bit"],
      ["s1c", 105, "ti"],
    ]);
    // Hai phần liền nhau không trùng cỡ cảnh, nhân vật và hành động giữ nguyên.
    expect(shots[1]?.shotSize).not.toBe(shots[0]?.shotSize);
    expect(shots[1]?.actors).toEqual(two.actors);
    // Hiệu ứng đầu shot (ADR-025) chỉ ở phần đầu khi shot bị chia.
    const withFx = fixPacing(
      [{ ...two, effects: ["impact" as const] }],
      getFormatPack("story", 3) as FormatPack,
      30,
    );
    expect(withFx.shots.map((s) => s.effects)).toEqual([["impact"], undefined, undefined]);
    // Shot một nhân vật không có ai để cắt sang.
    const solo = fixPacing(
      [shot("s9", 0, 220, "medium")],
      getFormatPack("story", 3) as FormatPack,
      30,
    );
    expect(solo.shots.map((s) => s.focus)).toEqual(["ti", "ti", "ti"]);
  });

  it("story v2: shot tới 5 giây giữ nguyên, dài hơn thì chia (ADR-013 bổ sung 2026-11-09)", () => {
    const { shots } = fixPacing(
      [shot("s1", 0, 150, "medium"), shot("s2", 150, 210, "wide")],
      STORY_V2,
      30,
    );
    expect(shots.map((s) => [s.shotId, s.fromFrame, s.durationInFrames])).toEqual([
      ["s1", 0, 150],
      ["s2", 150, 105],
      ["s2b", 255, 105],
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

describe("âm thanh và máy quay theo luật (ADR-019, ADR-014 bổ sung 2026-11-12)", () => {
  type Shot = Parameters<typeof planSfx>[0][number];
  const shot = (over: Partial<Shot> & { action?: string; expression?: string }): Shot => {
    const { action = "pose_stand", expression = "expr_happy", ...rest } = over;
    return {
      shotId: "s1",
      sceneId: "a",
      fromFrame: 0,
      durationInFrames: 60,
      background: "bg_room",
      shotSize: "medium",
      camera: "cam_static",
      focus: "ti",
      props: [],
      ambience: [],
      actors: [
        { character: "ti", skin: "skin_ti", action, expression, slot: "left", speakingRanges: [] },
      ],
      ...rest,
    };
  };

  it("SFX: vút qua khi sang cảnh, bật ra khi có bong bóng, bùng nhún khi hoảng; bỏ phần chia thêm", () => {
    const cues = planSfx([
      shot({ shotId: "s1", sceneId: "a", fromFrame: 0, action: "action_panic" }),
      shot({ shotId: "s1b", sceneId: "a", fromFrame: 60, action: "action_panic" }),
      shot({
        shotId: "s2",
        sceneId: "b",
        fromFrame: 120,
        shotSize: "wide",
        illustration: { style: "bubble", owner: "ti", items: ["prop_laptop"] },
      }),
      shot({ shotId: "s3", sceneId: "b", fromFrame: 200, action: "action_celebrate" }),
    ]);
    expect(cues).toEqual([
      { assetId: "sfx_boing", fromFrame: 3 },
      { assetId: "sfx_whoosh", fromFrame: 116 },
      { assetId: "sfx_sparkle", fromFrame: 205 },
    ]);
    // Bong bóng ở frame 124 sát tiếng vút (116): giữ tiếng sang cảnh, bỏ tiếng bong bóng.
    expect(124 - 116).toBeLessThan(SFX_MIN_GAP_FRAMES);
    // Phản ứng ngay trước tiếng sang cảnh nhường chỗ cho tiếng sang cảnh.
    const near = planSfx([
      shot({ shotId: "s1", sceneId: "a", fromFrame: 100, action: "action_panic" }),
      shot({ shotId: "s2", sceneId: "b", fromFrame: 110 }),
    ]);
    expect(near).toEqual([{ assetId: "sfx_whoosh", fromFrame: 106 }]);
  });

  it("máy quay: giật máy khi hoảng, lùi máy mở cảnh rộng, đổi kiểu khi lặp ba lần", () => {
    const out = directCameras([
      shot({ shotId: "s1", shotSize: "wide" }),
      shot({ shotId: "s2", camera: "cam_push_in", shotSize: "close", expression: "expr_panic" }),
      shot({ shotId: "s3", camera: "cam_push_in", shotSize: "close" }),
      shot({ shotId: "s4", camera: "cam_push_in", shotSize: "close" }),
      shot({ shotId: "s5", camera: "cam_push_in", shotSize: "close" }),
    ]);
    expect(out.map((s) => s.camera)).toEqual([
      "cam_pull_out",
      "cam_bump",
      "cam_push_in",
      "cam_push_in",
      "cam_static",
    ]);
    // Không giật máy hai lần trong ba shot liền; ngạc nhiên chỉ giật ở cỡ cận.
    const calm = directCameras([
      shot({ shotId: "s1", expression: "expr_panic" }),
      shot({ shotId: "s2", expression: "expr_panic" }),
      shot({ shotId: "s3", expression: "expr_surprised" }),
    ]);
    expect(calm.map((s) => s.camera)).toEqual(["cam_bump", "cam_static", "cam_static"]);
    // Kênh chưa có camera mới thì giữ nguyên.
    expect(directCameras([shot({ shotSize: "wide" })], () => false)[0]?.camera).toBe("cam_static");
  });
});
