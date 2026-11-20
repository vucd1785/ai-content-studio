import { type FormatPack, getFormatPack, scriptV2Schema } from "@studio/contracts";
import { describe, expect, it } from "vitest";
import { stageOutroScenes } from "./outro-scene.js";

const V3 = getFormatPack("story", 3) as FormatPack;
const V4 = getFormatPack("story", 4) as FormatPack;

const actor = (character: string, action = "action_talk") => ({
  character,
  action,
  expression: "expr_doubt",
});

function variant(lastSize = "medium") {
  return {
    title: "Vì sao đom đóm phát sáng?",
    scenes: [
      {
        id: "mo",
        beat: "payoff",
        lines: [{ id: "l1", speaker: "ti", text: "Em nháy thế nào?" }],
        shots: [
          {
            id: "s1",
            lineId: "l1",
            cutOnWord: "nháy",
            background: "bg_meadow",
            shotSize: lastSize,
            focus: "ti",
            actors: [actor("dau"), actor("ti"), actor("bit")],
          },
        ],
      },
      {
        id: "ket",
        beat: "outro",
        lines: [
          {
            id: "l2",
            speaker: "bit",
            text: "Follow chúng mình để biết thêm nhiều kiến thức thú vị nhé!",
          },
        ],
        shots: [
          {
            id: "s2",
            lineId: "l2",
            cutOnWord: "kênh",
            background: "bg_meadow",
            shotSize: "close",
            camera: "cam_dutch",
            focus: "bit",
            actors: [actor("bit")],
            props: ["prop_laptop"],
          },
          {
            id: "s3",
            lineId: "l2",
            cutOnWord: "thú",
            background: "bg_room",
            shotSize: "medium",
            focus: "bit",
            actors: [actor("bit")],
          },
        ],
      },
    ],
  };
}

type Staged = { variants: ReturnType<typeof variant>[] };
const all = () => true;

describe("cảnh mời theo dõi do code dựng (ADR-026)", () => {
  it("một shot rộng, cả dàn nhân vật theo thứ tự xuất hiện chỉ lên nút theo dõi, tông ấm, hoa giấy", () => {
    const out = stageOutroScenes({ variants: [variant(), variant()] }, V4, all) as Staged;
    const ket = out.variants[0]?.scenes[1];
    expect(ket?.shots).toEqual([
      {
        id: "s2",
        lineId: "l2",
        cutOnWord: "Follow",
        background: "bg_meadow",
        shotSize: "wide",
        camera: "cam_end_card",
        focus: "bit",
        actors: ["dau", "ti", "bit"].map((character) => ({
          character,
          action: "action_follow",
          expression: "expr_happy",
        })),
        mood: "warm",
        effects: ["confetti"],
      },
    ]);
    // Câu do LLM viết giữ nguyên; cảnh khác không đổi.
    expect(ket?.lines).toEqual(variant().scenes[1]?.lines);
    expect(out.variants[0]?.scenes[0]).toEqual(variant().scenes[0]);
  });

  it("shot trước đã rộng thì dùng cỡ từ trên cao để không hai shot liền cùng cỡ", () => {
    const out = stageOutroScenes({ variants: [variant("wide")] }, V4, all) as Staged;
    expect(out.variants[0]?.scenes[1]?.shots[0]?.shotSize).toBe("high");
  });

  it("kho chưa có action_follow, cam_end_card, cam_push_in: vẫy tay, bỏ trường máy", () => {
    const pushOnly = stageOutroScenes(
      { variants: [variant()] },
      V4,
      (id) => id !== "cam_end_card",
    ) as Staged;
    expect(pushOnly.variants[0]?.scenes[1]?.shots[0]?.camera).toBe("cam_push_in");
    const out = stageOutroScenes(
      { variants: [variant()] },
      V4,
      (id) => !["action_follow", "cam_end_card", "cam_push_in"].includes(id),
    ) as Staged;
    const shot = out.variants[0]?.scenes[1]?.shots[0] as Record<string, unknown> & {
      actors: { action: string }[];
    };
    expect(shot.actors.every((a) => a.action === "action_wave")).toBe(true);
    expect("camera" in shot).toBe(false);
  });

  it("gói không có nhịp outro, hoặc dữ liệu lạ: trả nguyên", () => {
    const input = { variants: [variant()] };
    expect(stageOutroScenes(input, V3, all)).toBe(input);
    expect(stageOutroScenes({ nope: 1 }, V4, all)).toEqual({ nope: 1 });
    const broken = { variants: [{ scenes: [{ beat: "outro" }] }] };
    expect(stageOutroScenes(broken, V4, all)).toEqual(broken);
  });
});

describe("kịch bản story v4 sau khi dựng cảnh kết vẫn qua kiểm Zod", () => {
  it("bảy cảnh đủ nhịp title … outro; shot kết hợp lệ với danh mục và dàn nhân vật", () => {
    const sizes = ["wide", "medium", "close", "medium", "wide", "medium", "close", "medium"];
    let n = 0;
    const scene = (id: string, beat: string, speaker: string, text: string, word: string) => {
      n += 1;
      return {
        id,
        beat,
        sourceIds: beat === "fact" ? ["src1"] : [],
        lines: [{ id: `l${n}`, speaker, text }],
        shots: [
          {
            id: `s${n}`,
            lineId: `l${n}`,
            cutOnWord: word,
            background: "bg_meadow",
            shotSize: sizes[n - 1] as string,
            focus: speaker,
            actors: [actor(speaker, "action_talk"), actor(speaker === "ti" ? "bit" : "ti")],
          },
        ],
      };
    };
    const script = {
      schemaVersion: 2,
      language: "vi",
      formatId: "story",
      formatVersion: 4,
      title: "Vì sao đom đóm phát sáng?",
      sources: [{ id: "src1", title: "Nguồn", url: "https://example.org" }],
      scenes: [
        scene("tieu-de", "title", "bit", "Vì sao đom đóm phát sáng?", "đom"),
        scene("mo", "cold_open", "ti", "Ơ, đốm sáng kìa!", "sáng"),
        scene("hoi", "premise", "dau", "Ma à?", "Ma"),
        scene("dien", "play", "bit", "Không phải ma đâu.", "ma"),
        scene("that", "fact", "bit", "Bụng đom đóm tự phát sáng.", "Bụng"),
        scene("chot", "payoff", "ti", "Em sẽ nháy mật mã thế nào?", "mật"),
        scene(
          "ket",
          "outro",
          "bit",
          "Follow chúng mình để biết thêm nhiều kiến thức thú vị nhé!",
          "chúng",
        ),
      ],
    };
    const ids = [
      "bg_meadow",
      "action_talk",
      "action_follow",
      "expr_doubt",
      "expr_happy",
      "cam_end_card",
    ];
    const kindOf = (id: string) =>
      id.startsWith("bg_")
        ? "background"
        : id.startsWith("action_")
          ? "action"
          : id.startsWith("expr_")
            ? "expression"
            : "camera";
    const staged = stageOutroScenes({ variants: [script] }, V4, (id) => ids.includes(id)) as {
      variants: unknown[];
    };
    const result = scriptV2Schema({
      format: V4,
      mode: "standard",
      cast: ["ti", "bit", "dau"].map((characterKey) => ({ characterKey, speaks: true })),
      assetCatalog: ids.map((id) => ({ id, kind: kindOf(id) as "action" })),
    }).safeParse(staged.variants[0]);
    expect(result.success ? [] : result.error.issues.map((i) => i.message)).toEqual([]);
    const ket = (staged.variants[0] as typeof script).scenes.at(-1)?.shots[0];
    expect(ket?.actors.map((a) => a.character)).toEqual(["bit", "ti", "dau"]);
  });
});
