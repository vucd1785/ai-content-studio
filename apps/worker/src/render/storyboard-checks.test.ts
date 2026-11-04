import { describe, expect, it } from "vitest";
import {
  CAPTION_TEXT_WIDTH,
  checkStill,
  contrastRatio,
  type StillSpec,
  screenLayout,
  widestCaptionGroupPx,
} from "./storyboard-checks.js";

const base: StillSpec = {
  background: "bg_room",
  shotSize: "wide",
  camera: "cam_static",
  focus: "ti",
  actors: [
    {
      character: "ti",
      skin: "skin_ti",
      action: "action_wave",
      expression: "expr_happy",
      slot: "left",
    },
    {
      character: "bit",
      skin: "skin_bit",
      action: "pose_stand",
      expression: "expr_happy",
      slot: "right",
    },
  ],
  caption: { speaker: "ti", text: "Bit ơi, nếu mình không cần ngủ thì sao?", color: "#f26b3a" },
  placeholderAssetIds: [],
};

const codes = (spec: StillSpec) => checkStill(spec).map((i) => i.code);

describe("kiểm storyboard bằng hình học", () => {
  it("cỡ rộng hai nhân vật hai bên: không vấn đề", () => {
    expect(codes(base)).toEqual([]);
  });

  it("cỡ rộng và góc cao ba nhân vật trái, giữa, phải: không vấn đề (bổ sung ADR-013 2026-11-03)", () => {
    const trio: StillSpec = {
      ...base,
      actors: [
        ...base.actors,
        {
          character: "dau",
          skin: "skin_dau",
          action: "pose_stand",
          expression: "expr_happy",
          slot: "center",
        },
      ],
    };
    expect(checkStill(trio)).toEqual([]);
    expect(checkStill({ ...trio, shotSize: "high" })).toEqual([]);
    // Người thứ ba trùng vị trí với người khác: báo đúng cặp đó.
    const clash = {
      ...trio,
      actors: trio.actors.map((a, i) => (i === 2 ? { ...a, slot: "right" as const } : a)),
    };
    expect(checkStill(clash).map((i) => i.message)).toEqual(["bit và dau chồng lên nhau"]);
  });

  it("hai nhân vật cùng một vị trí: storyboard_overlap", () => {
    const spec: StillSpec = {
      ...base,
      actors: base.actors.map((a) => ({ ...a, slot: "left" as const })),
    };
    expect(codes(spec)).toContain("storyboard_overlap");
  });

  it("cỡ trung hai người: camera lấy giữa nhóm, không ai bị mép khung cắt đầu (lỗi P6-09, P6-17; kit 0.2.0)", () => {
    for (const focus of ["ti", "bit"]) {
      for (const camera of ["cam_static", "cam_push_in"]) {
        expect(checkStill({ ...base, shotSize: "medium", focus, camera })).toEqual([]);
      }
    }
    // Vẫn gần hơn cỡ rộng.
    const wide = screenLayout(base);
    const medium = screenLayout({ ...base, shotSize: "medium" });
    expect(medium[0]?.headRadius ?? 0).toBeGreaterThan(wide[0]?.headRadius ?? 0);
  });

  it("cỡ cận: người không được lấy nét lộ ở mép là chủ ý, không báo", () => {
    expect(checkStill({ ...base, shotSize: "close", focus: "bit" })).toEqual([]);
  });

  it("cỡ cận một nhân vật: mặt ở trên phụ đề, trong khung", () => {
    const spec: StillSpec = {
      ...base,
      shotSize: "close",
      actors: [base.actors[0] as StillSpec["actors"][number]],
    };
    expect(codes(spec)).toEqual([]);
    const [ti] = screenLayout(spec);
    expect(ti?.head.y).toBeLessThan(1650);
  });

  it("màu phụ đề tối trên nền tối: storyboard_low_contrast", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 0);
    expect(codes({ ...base, caption: { ...base.caption, color: "#333333" } })).toContain(
      "storyboard_low_contrast",
    );
  });

  it("từ quá dài làm nhóm phụ đề tràn: storyboard_text_overflow", () => {
    const long =
      "Supercalifragilistic expialidocious antidisestablishment floccinaucinihilipilification";
    expect(widestCaptionGroupPx(long)).toBeGreaterThan(CAPTION_TEXT_WIDTH);
    expect(codes({ ...base, caption: { ...base.caption, text: long } })).toContain(
      "storyboard_text_overflow",
    );
  });

  it("đang dùng tài sản tạm ở chế độ creative: storyboard_placeholder_asset", () => {
    expect(codes({ ...base, placeholderAssetIds: ["action_wave"] })).toContain(
      "storyboard_placeholder_asset",
    );
  });
});
