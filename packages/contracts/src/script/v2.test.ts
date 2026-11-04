import { describe, expect, it } from "vitest";
import {
  DEFAULT_FORMAT,
  FORMAT_PACKS,
  type FormatPack,
  formatPackSchema,
  getFormatPack,
  isDurationAllowed,
} from "../formats/packs.js";
import { checkPacing, shotsNeededForDuration, type TimedShot } from "./pacing.js";
import {
  type CastMember,
  type CatalogAsset,
  type ScriptV2,
  type ScriptV2SchemaOptions,
  scriptV2ArtifactSchema,
  scriptV2Schema,
} from "./v2.js";
import { normalizedWords, tokenizeWords } from "./words.js";

const WHAT_IF = getFormatPack("what_if", 1) as FormatPack;
const STORY = getFormatPack("story", 1) as FormatPack;
/** Gói chỉ dùng trong test: có người dẫn, nhịp chậm (thay `explainer` đã xóa theo ADR-013 bổ sung (2)). */
const NARRATED: FormatPack = formatPackSchema.parse({
  id: "narrated_test",
  version: 1,
  displayName: "Có người dẫn (test)",
  beats: [
    { id: "hook", label: "Mở đầu", requiresSource: false },
    { id: "explain", label: "Giải thích", requiresSource: true },
    { id: "example", label: "Ví dụ", requiresSource: true },
    { id: "recap", label: "Tóm tắt", requiresSource: false },
    { id: "cta", label: "Kêu gọi", requiresSource: false },
  ],
  defaultCast: ["bit", "ti"],
  allowNarrator: true,
  research: "required",
  durationSec: { min: 30, max: 90 },
  pacing: { cutsPerMinute: { min: 12, max: 20 }, maxStaticSec: 5, noSameShotSizeInARow: true },
  qaRules: [],
});

/** Dàn nhân vật seed P6-07. */
const CAST: CastMember[] = [
  { characterKey: "ti", speaks: true },
  { characterKey: "bit", speaks: true },
  { characterKey: "dau", speaks: false },
];

/** Id của motion kit P6-05 (đã `approved`). */
const CATALOG: CatalogAsset[] = [
  ...["expr_happy", "expr_surprised", "expr_panic", "expr_doubt", "expr_smug", "expr_sad"].map(
    (id) => ({ id, kind: "expression" as const }),
  ),
  ...["pose_stand", "pose_hero", "pose_point"].map((id) => ({ id, kind: "pose" as const })),
  ...[
    "action_wave",
    "action_point",
    "action_celebrate",
    "action_panic",
    "action_walk",
    "action_talk",
  ].map((id) => ({ id, kind: "action" as const })),
  { id: "bg_room", kind: "background" },
  { id: "bg_classroom", kind: "background" },
  { id: "cam_static", kind: "camera" },
  { id: "cam_push_in", kind: "camera" },
];

const OPTS: ScriptV2SchemaOptions = {
  cast: CAST,
  assetCatalog: CATALOG,
  format: WHAT_IF,
  mode: "standard",
};

const ti = (action: string, expression = "expr_happy") => ({ character: "ti", action, expression });
const bit = (action: string, expression = "expr_doubt") => ({
  character: "bit",
  action,
  expression,
});

/** Phương án "Nếu như con người không cần ngủ?" hợp lệ, đủ 5 nhịp của `what_if`. */
function validScript(): ScriptV2 {
  return {
    schemaVersion: 2,
    language: "vi",
    formatId: "what_if",
    formatVersion: 1,
    title: "Nếu như con người không cần ngủ?",
    sources: [{ id: "src1", title: "Nghiên cứu thiếu ngủ", url: "https://example.org/sleep" }],
    scenes: [
      {
        id: "mo-dau",
        beat: "cold_open",
        sourceIds: [],
        lines: [
          { id: "l1", speaker: "ti", text: "Bit ơi, nếu mình không cần ngủ thì sao?" },
          { id: "l2", speaker: "bit", text: "Nghe hấp dẫn đấy." },
        ],
        shots: [
          {
            id: "s1",
            lineId: "l1",
            cutOnWord: "Bit",
            background: "bg_room",
            shotSize: "wide",
            camera: "cam_push_in",
            focus: "ti",
            actors: [ti("action_wave"), bit("pose_stand")],
          },
          {
            id: "s2",
            lineId: "l2",
            cutOnWord: "hấp",
            background: "bg_room",
            shotSize: "close",
            focus: "bit",
            actors: [bit("action_talk")],
          },
        ],
      },
      {
        id: "gia-thuyet",
        beat: "premise",
        sourceIds: [],
        lines: [{ id: "l3", speaker: "ti", text: "Thêm tám tiếng mỗi ngày để chơi!" }],
        shots: [
          {
            id: "s3",
            lineId: "l3",
            cutOnWord: "tám",
            background: "bg_room",
            shotSize: "medium",
            focus: "ti",
            actors: [ti("action_point", "expr_smug")],
          },
        ],
      },
      {
        id: "vui",
        beat: "fun",
        sourceIds: [],
        lines: [{ id: "l4", speaker: "ti", text: "Đêm nào cũng là tiệc!" }],
        shots: [
          {
            id: "s4",
            lineId: "l4",
            cutOnWord: "tiệc",
            background: "bg_room",
            shotSize: "high",
            focus: "ti",
            actors: [
              ti("action_celebrate"),
              { character: "dau", action: "action_celebrate", expression: "expr_happy" },
            ],
            ambience: ["dust"],
          },
        ],
      },
      {
        id: "su-that",
        beat: "fact",
        sourceIds: ["src1"],
        lines: [{ id: "l5", speaker: "bit", text: "Thức 24 giờ, phản xạ chậm như người say." }],
        shots: [
          {
            id: "s5",
            lineId: "l5",
            cutOnWord: "24",
            background: "bg_classroom",
            shotSize: "medium",
            focus: "bit",
            actors: [bit("action_point"), ti("pose_stand", "expr_surprised")],
          },
        ],
      },
      {
        id: "twist",
        beat: "twist",
        sourceIds: [],
        lines: [{ id: "l6", speaker: "ti", text: "Thôi, mình đi ngủ đây." }],
        shots: [
          {
            id: "s6",
            lineId: "l6",
            cutOnWord: "ngủ",
            background: "bg_classroom",
            shotSize: "close",
            focus: "ti",
            actors: [ti("action_walk", "expr_sad")],
          },
        ],
      },
    ],
  };
}

function messages(result: {
  success: boolean;
  error?: { issues: { message: string; path: PropertyKey[] }[] };
}) {
  return (result.error?.issues ?? []).map((i) => `${i.path.join(".")}: ${i.message}`);
}

describe("gói thể loại", () => {
  it("gói story là mặc định của brief mới; what_if giữ để đọc run cũ (ADR-013 bổ sung (2))", () => {
    for (const pack of FORMAT_PACKS) {
      expect(formatPackSchema.safeParse(pack).success).toBe(true);
    }
    expect(FORMAT_PACKS.map((p) => p.id)).toEqual(["story", "what_if"]);
    expect(DEFAULT_FORMAT).toEqual({ id: "story", version: 1 });
    expect(STORY.durationSec).toEqual({ min: 30, max: 90 });
    expect(STORY.allowNarrator).toBe(false);
    expect(STORY.beats.map((b) => b.id)).toEqual([
      "cold_open",
      "premise",
      "play",
      "fact",
      "payoff",
    ]);
    expect(STORY.beats.filter((b) => b.requiresSource).map((b) => b.id)).toEqual(["fact"]);
    expect(getFormatPack("explainer", 1)).toBeUndefined();
    expect(WHAT_IF.durationSec).toEqual({ min: 30, max: 60 });
    expect(WHAT_IF.beats.map((b) => b.id)).toEqual([
      "cold_open",
      "premise",
      "fun",
      "fact",
      "twist",
    ]);
    expect(WHAT_IF.beats.filter((b) => b.requiresSource).map((b) => b.id)).toEqual(["fact"]);
    expect(getFormatPack("what_if", 2)).toBeUndefined();
  });

  it.each([
    [WHAT_IF, 29, false],
    [WHAT_IF, 30, true],
    [WHAT_IF, 60, true],
    [WHAT_IF, 61, false],
    [STORY, 29, false],
    [STORY, 90, true],
    [STORY, 91, false],
  ])("thời lượng brief: %s.id %i giây → %s", (pack, sec, ok) => {
    expect(isDurationAllowed(pack, sec)).toBe(ok);
  });

  it("chặn gói không research mà có nhịp cần nguồn", () => {
    const r = formatPackSchema.safeParse({ ...WHAT_IF, research: "off" });
    expect(r.success).toBe(false);
  });

  it("chặn gói có trần shot ngắn đến mức không đạt được số cắt tối thiểu", () => {
    // Trần 3 giây: mọi video ≥ 20 cắt/phút, không bao giờ đạt 12.
    const r = formatPackSchema.safeParse({
      ...NARRATED,
      pacing: { ...NARRATED.pacing, maxStaticSec: 3 },
    });
    expect(r.success).toBe(false);
  });
});

describe("scriptV2Schema", () => {
  it("chấp nhận phương án hợp lệ; artifact cần đúng hai phương án", () => {
    const r = scriptV2Schema(OPTS).safeParse(validScript());
    expect(messages(r)).toEqual([]);
    const art = scriptV2ArtifactSchema(OPTS);
    expect(art.safeParse({ variants: [validScript(), validScript()] }).success).toBe(true);
    expect(art.safeParse({ variants: [validScript()] }).success).toBe(false);
  });

  const cases: [string, (s: ScriptV2) => void, string][] = [
    [
      "nhân vật speaks = false trong kênh làm người nói",
      (s) => {
        (s.scenes[0]?.lines[1] as { speaker: string }).speaker = "dau";
      },
      "scenes.0.lines.1.speaker: Nhân vật dau không nói",
    ],
    [
      "người nói không thuộc kênh",
      (s) => {
        (s.scenes[0]?.lines[1] as { speaker: string }).speaker = "meo";
      },
      "scenes.0.lines.1.speaker: Người nói không thuộc kênh: meo",
    ],
    [
      "narrator ở gói không cho phép",
      (s) => {
        (s.scenes[1]?.lines[0] as { speaker: string }).speaker = "narrator";
      },
      "scenes.1.lines.0.speaker: Gói what_if không có người dẫn chuyện",
    ],
    [
      "id tài sản lạ ở standard",
      (s) => {
        (s.scenes[0]?.shots[0] as { background: string }).background = "bg_space_station";
      },
      "scenes.0.shots.0.background: Tài sản không có trong kho: bg_space_station",
    ],
    [
      "tài sản sai kind",
      (s) => {
        const a = s.scenes[0]?.shots[0]?.actors[0] as { expression: string };
        a.expression = "action_wave";
      },
      "scenes.0.shots.0.actors.0.expression: Tài sản action_wave là action, cần expression",
    ],
    [
      "nhịp sự thật không có nguồn",
      (s) => {
        (s.scenes[3] as { sourceIds: string[] }).sourceIds = [];
      },
      "scenes.3.sourceIds: Nhịp fact cần ít nhất một nguồn",
    ],
    [
      "nguồn không tồn tại",
      (s) => {
        (s.scenes[3] as { sourceIds: string[] }).sourceIds = ["src9"];
      },
      "scenes.3.sourceIds.0: Nguồn không có trong sources: src9",
    ],
    [
      "nhịp sai thứ tự",
      (s) => {
        const [a, b] = [s.scenes[1], s.scenes[2]];
        if (a && b) {
          s.scenes[1] = b;
          s.scenes[2] = a;
          // giữ cỡ cảnh xen kẽ để chỉ còn lỗi thứ tự
          (b.shots[0] as { shotSize: string }).shotSize = "medium";
          (a.shots[0] as { shotSize: string }).shotSize = "high";
        }
      },
      "scenes.2.beat: Nhịp premise sai thứ tự của gói",
    ],
    [
      "cutOnWord không có trong câu",
      (s) => {
        (s.scenes[0]?.shots[0] as { cutOnWord: string }).cutOnWord = "Tí";
      },
      'scenes.0.shots.0.cutOnWord: cutOnWord "Tí" không có trong câu l1',
    ],
    [
      "lineId của cảnh khác",
      (s) => {
        (s.scenes[1]?.shots[0] as { lineId: string }).lineId = "l1";
      },
      "scenes.1.shots.0.lineId: lineId l1 không thuộc cảnh gia-thuyet",
    ],
    [
      "hai shot liền nhau cùng cỡ cảnh, qua ranh giới cảnh",
      (s) => {
        (s.scenes[1]?.shots[0] as { shotSize: string }).shotSize = "close";
      },
      "scenes.1.shots.0.shotSize: Hai shot liền nhau cùng cỡ cảnh close",
    ],
    [
      "người nói vắng mặt trong shot",
      (s) => {
        (s.scenes[0]?.shots[1] as { actors: unknown[] }).actors = [ti("pose_stand")];
        (s.scenes[0]?.shots[1] as { focus: string }).focus = "ti";
      },
      "scenes.0.shots.1.actors: Người nói bit phải có mặt trong shot",
    ],
    [
      "focus không có trong shot",
      (s) => {
        (s.scenes[0]?.shots[0] as { focus: string }).focus = "dau";
      },
      "scenes.0.shots.0.focus: focus dau phải là một nhân vật trong shot",
    ],
    [
      "line id trùng giữa hai cảnh",
      (s) => {
        (s.scenes[1]?.lines[0] as { id: string }).id = "l1";
        (s.scenes[1]?.shots[0] as { lineId: string }).lineId = "l1";
        (s.scenes[1]?.shots[0] as { cutOnWord: string }).cutOnWord = "tám";
      },
      "scenes.1.lines.0.id: Line id trùng: l1",
    ],
    [
      "thiếu nhịp twist",
      (s) => {
        s.scenes.pop();
      },
      "scenes: Thiếu nhịp twist của gói what_if",
    ],
  ];

  it.each(cases)("chặn: %s", (_name, mutate, expected) => {
    const s = validScript();
    mutate(s);
    const r = scriptV2Schema(OPTS).safeParse(s);
    expect(r.success).toBe(false);
    expect(messages(r)).toContain(expected);
  });

  it("không nhận chữ phủ màn hình và khung bảng (ADR-014 bổ sung 2026-11-03)", () => {
    const withText = validScript();
    (withText.scenes[1]?.shots[0] as Record<string, unknown>).onScreenText = "+8 tiếng";
    expect(scriptV2Schema(OPTS).safeParse(withText).success).toBe(false);
    const withBoard = validScript();
    (withBoard.scenes[3] as Record<string, unknown>).board = {
      kind: "code",
      codeSnippet: { language: "text", code: "x" },
    };
    expect(scriptV2Schema(OPTS).safeParse(withBoard).success).toBe(false);
  });

  it("ba nhân vật chỉ ở cỡ wide, high; Đậu nói khi kênh cho speaks (ADR-013 bổ sung 2026-11-03)", () => {
    const dau = { character: "dau", action: "pose_stand", expression: "expr_happy" };
    const three = validScript();
    const s1 = three.scenes[0]?.shots[0] as { actors: unknown[]; shotSize: string };
    s1.actors = [ti("action_wave"), bit("pose_stand"), dau];
    expect(messages(scriptV2Schema(OPTS).safeParse(three))).toEqual([]);
    s1.shotSize = "high";
    expect(messages(scriptV2Schema(OPTS).safeParse(three))).toEqual([]);
    s1.shotSize = "medium";
    expect(messages(scriptV2Schema(OPTS).safeParse(three))).toContain(
      "scenes.0.shots.0.actors: Cỡ medium có tối đa 2 nhân vật",
    );
    s1.actors.push(ti("pose_stand"));
    s1.shotSize = "wide";
    expect(scriptV2Schema(OPTS).safeParse(three).success).toBe(false);

    const talking = validScript();
    (talking.scenes[0]?.lines[1] as { speaker: string }).speaker = "dau";
    (talking.scenes[0]?.shots[1] as { actors: unknown[] }).actors = [dau];
    (talking.scenes[0]?.shots[1] as { focus: string }).focus = "dau";
    const castDauSpeaks = CAST.map((c) => (c.characterKey === "dau" ? { ...c, speaks: true } : c));
    expect(messages(scriptV2Schema({ ...OPTS, cast: castDauSpeaks }).safeParse(talking))).toEqual(
      [],
    );
    expect(messages(scriptV2Schema(OPTS).safeParse(talking))).toContain(
      "scenes.0.lines.1.speaker: Nhân vật dau không nói",
    );
  });

  it("standard không nhận assetRequests", () => {
    const r = scriptV2Schema(OPTS).safeParse({ ...validScript(), assetRequests: [] });
    expect(r.success).toBe(false);
  });

  it("creative: yêu cầu tài sản hợp lệ, fallback phải có trong kho và cùng kind", () => {
    const creative = { ...OPTS, mode: "creative" as const };
    const req = {
      id: "r1",
      kind: "action",
      description: "Tí ngáp dài rồi dụi mắt",
      sceneIds: ["twist"],
      fallbackAssetId: "action_walk",
    };
    expect(
      messages(scriptV2Schema(creative).safeParse({ ...validScript(), assetRequests: [req] })),
    ).toEqual([]);
    const badKind = scriptV2Schema(creative).safeParse({
      ...validScript(),
      assetRequests: [{ ...req, fallbackAssetId: "bg_room" }],
    });
    expect(messages(badKind)).toContain(
      "assetRequests.0.fallbackAssetId: Tài sản bg_room là background, cần action",
    );
    const skin = scriptV2Schema(creative).safeParse({
      ...validScript(),
      assetRequests: [{ ...req, kind: "character_skin" }],
    });
    expect(skin.success).toBe(false);
    const missingScene = scriptV2Schema(creative).safeParse({
      ...validScript(),
      assetRequests: [{ ...req, sceneIds: ["khong-co"] }],
    });
    expect(messages(missingScene)).toContain(
      "assetRequests.0.sceneIds.0: Cảnh không tồn tại: khong-co",
    );
    // shot vẫn không được dùng id ngoài kho ở creative
    const s = validScript();
    (s.scenes[0]?.shots[0] as { background: string }).background = "bg_moi";
    expect(scriptV2Schema(creative).safeParse({ ...s, assetRequests: [req] }).success).toBe(false);
  });

  it("gói cho phép người dẫn thì nhận narrator", () => {
    const s = validScript();
    s.formatId = "narrated_test";
    s.scenes = s.scenes.map((sc, i) => ({
      ...sc,
      beat: ["hook", "explain", "example", "recap", "cta"][i] as string,
      sourceIds: i === 1 || i === 2 ? ["src1"] : [],
    }));
    (s.scenes[0]?.lines[0] as { speaker: string }).speaker = "narrator";
    const r = scriptV2Schema({ ...OPTS, format: NARRATED }).safeParse(s);
    expect(messages(r)).toEqual([]);
  });

  it("script dùng gói khác gói của brief bị chặn", () => {
    const r = scriptV2Schema({ ...OPTS, format: NARRATED }).safeParse(validScript());
    expect(messages(r)).toContain("formatId: Script phải dùng gói narrated_test v1");
  });
});

describe("tách từ giống alignment", () => {
  it.each([
    ["Bit ơi, nếu mình không cần ngủ?", ["bit", "ơi", "nếu", "mình", "không", "cần", "ngủ"]],
    ["Thức 24 giờ — phản xạ chậm !", ["thức", "24", "giờ", "phản", "xạ", "chậm"]],
    ["  Redis   là gì ? ", ["redis", "là", "gì"]],
  ])("%s", (text, words) => {
    expect(normalizedWords(text)).toEqual(words);
  });

  it("dấu câu đứng riêng gộp vào từ trước", () => {
    expect(tokenizeWords("chậm !")).toEqual(["chậm!"]);
  });
});

describe("luật nhịp (bảng)", () => {
  const FPS = 30;
  const sizes = ["wide", "close", "medium", "high"] as const;
  /** n shot đều nhau, mỗi shot `sec` giây, cỡ cảnh xen kẽ. */
  const even = (n: number, sec: number): TimedShot[] =>
    Array.from({ length: n }, (_, i) => ({
      shotId: `s${i + 1}`,
      fromFrame: i * sec * FPS,
      durationInFrames: sec * FPS,
      shotSize: sizes[i % sizes.length] as TimedShot["shotSize"],
    }));
  const rules = (shots: TimedShot[], pack: FormatPack) =>
    checkPacing(shots, pack, FPS).map((v) => v.rule);

  it.each<[string, FormatPack, TimedShot[], string[]]>([
    ["what_if 30 s, 10 shot × 3 s = 20 cắt/phút", WHAT_IF, even(10, 3), []],
    ["what_if 60 s, 27 shot ≈ 2,2 s = 27 cắt/phút", WHAT_IF, even(27, 60 / 27), []],
    [
      "what_if 30 s, 6 shot × 5 s = 12 cắt/phút: quá chậm và shot dài",
      WHAT_IF,
      even(6, 5),
      ["cuts_per_minute", ...Array(6).fill("max_static")],
    ],
    [
      "what_if 30 s, 15 shot × 2 s = 30 cắt/phút: quá nhanh",
      WHAT_IF,
      even(15, 2),
      ["cuts_per_minute"],
    ],
    ["có người dẫn 60 s, 12 shot × 5 s = 12 cắt/phút", NARRATED, even(12, 5), []],
    ["có người dẫn 60 s, 20 shot × 3 s = 20 cắt/phút", NARRATED, even(20, 3), []],
    [
      "có người dẫn 60 s, 10 shot × 6 s = 10 cắt/phút: chậm, shot quá 5 s",
      NARRATED,
      even(10, 6),
      ["cuts_per_minute", ...Array(10).fill("max_static")],
    ],
  ])("%s", (_name, pack, shots, expected) => {
    expect(rules(shots, pack)).toEqual(expected);
  });

  it("hai shot liền nhau cùng cỡ cảnh", () => {
    const shots = even(10, 3);
    // s4 là high; đổi s5 cũng thành high.
    shots[4] = { ...(shots[4] as TimedShot), shotSize: "high" };
    expect(checkPacing(shots, WHAT_IF, FPS)).toEqual([
      { rule: "same_shot_size", shotId: "s5", shotSize: "high" },
    ]);
  });

  it("một shot dài hơn trần trong video đúng nhịp", () => {
    const shots = even(10, 3);
    shots[2] = { ...(shots[2] as TimedShot), durationInFrames: 100 };
    // Giữ tổng 900 frame để số cắt mỗi phút vẫn là 20.
    shots[3] = { ...(shots[3] as TimedShot), durationInFrames: 80 };
    expect(checkPacing(shots, WHAT_IF, FPS)).toEqual([
      { rule: "max_static", shotId: "s3", seconds: 3.33, maxSeconds: 3 },
    ]);
  });

  it("số shot cần cho thời lượng brief", () => {
    expect(shotsNeededForDuration(WHAT_IF, 30)).toEqual({ min: 10, max: 13 });
    expect(shotsNeededForDuration(WHAT_IF, 60)).toEqual({ min: 20, max: 27 });
    expect(shotsNeededForDuration(NARRATED, 90)).toEqual({ min: 18, max: 30 });
    expect(shotsNeededForDuration(STORY, 90)).toEqual({ min: 30, max: 40 });
  });

  it("shot list rỗng không có vi phạm", () => {
    expect(checkPacing([], WHAT_IF, FPS)).toEqual([]);
  });
});
