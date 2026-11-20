import { describe, expect, it } from "vitest";
import { reviewScriptV2 } from "./review.js";

const scene = (id: string, beat: string, text: string, shot: Record<string, unknown> = {}) => ({
  id,
  beat,
  lines: [{ text }],
  shots: [{ background: "bg_room", ...shot }],
});

describe("tự phê bình kịch bản (ADR-020)", () => {
  it("bắt mở đầu thiếu câu hỏi, giải thích không có hình, ba cảnh cùng nền, ít nguồn, thiếu nhạc", () => {
    const codes = reviewScriptV2({
      sources: [{}],
      scenes: [
        scene("a", "cold_open", "Ực ực! Ngon quá."),
        scene("b", "premise", "Nước biển mặn chát."),
        scene("c", "fact", "Muối bắt đầu từ đá."),
      ],
    }).map((i) => [i.code, i.sceneId ?? null]);
    expect(codes).toEqual([
      ["hook_late", null],
      ["explain_without_picture", "c"],
      ["same_background_run", "c"],
      ["few_sources", null],
      ["no_music", null],
    ]);
  });

  it("luật dựng hình (ADR-024): ít cỡ cảnh, không có shot nhìn người nghe, lặp một hành động", () => {
    const shot = (lineId: string, shotSize: string, focus: string, action: string) => ({
      background: "bg_room",
      illustration: {},
      shotSize,
      lineId,
      focus,
      actors: [
        { character: "ti", action },
        { character: "bit", action: "pose_stand" },
      ],
    });
    const lines = [
      { id: "l1", speaker: "ti", text: "Sao biển mặn?" },
      { id: "l2", speaker: "bit", text: "Vì muối từ đá." },
    ];
    const flat = {
      music: "to_mo",
      sources: [{}, {}],
      scenes: [
        {
          id: "a",
          beat: "cold_open",
          lines,
          shots: [
            shot("l1", "medium", "ti", "action_talk"),
            shot("l1", "close", "ti", "action_talk"),
            shot("l2", "medium", "bit", "action_talk"),
            shot("l2", "close", "bit", "action_talk"),
            shot("l2", "medium", "bit", "action_talk"),
            shot("l2", "close", "bit", "action_talk"),
          ],
        },
      ],
    };
    expect(reviewScriptV2(flat).map((i) => [i.code, i.sceneId ?? null])).toEqual([
      ["few_shot_sizes", null],
      ["no_reaction_shot", null],
      ["repeated_action", "a"],
      ["repeated_action", "a"],
    ]);
    // Đủ ba cỡ cảnh, có shot nhìn người nghe, hành động đổi theo câu: không còn gợi ý.
    const good = {
      ...flat,
      scenes: [
        {
          id: "a",
          beat: "cold_open",
          lines,
          shots: [
            shot("l1", "wide", "ti", "action_wave"),
            shot("l1", "medium", "bit", "action_talk"),
            shot("l2", "close", "bit", "action_point"),
            shot("l2", "medium", "ti", "action_celebrate"),
            shot("l2", "wide", "bit", "action_talk"),
            shot("l2", "close", "ti", "action_wave"),
          ].map((s, i) => ({
            ...s,
            actors: [
              s.actors[0],
              { character: "bit", action: i % 2 ? "pose_stand" : "pose_point" },
            ],
          })),
        },
      ],
    };
    expect(reviewScriptV2(good)).toEqual([]);
  });

  it("kịch bản tốt không có gợi ý", () => {
    expect(
      reviewScriptV2({
        music: "to_mo",
        sources: [{}, {}],
        scenes: [
          scene("a", "cold_open", "Sao biển mặn?"),
          scene("b", "fact", "Muối từ đá.", {
            background: "bg_classroom",
            illustration: { style: "board" },
          }),
          scene("c", "payoff", "Hay quá!"),
        ],
      }),
    ).toEqual([]);
  });
});
