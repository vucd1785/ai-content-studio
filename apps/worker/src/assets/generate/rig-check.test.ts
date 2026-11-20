import { easing, getMotion, pose } from "@studio/motion-kit";
import { describe, expect, it } from "vitest";
import { checkRigClip } from "./rig-check.js";

describe("luật tay của rig cho hành động tự tạo (2026-11-11)", () => {
  it("hành động có sẵn của kit đạt", () => {
    for (const id of ["action_talk", "action_wave", "action_point", "pose_stand"]) {
      expect(checkRigClip(getMotion(id) as never), id).toBeNull();
    }
  });

  it("hai tay giơ ngang vai lâu chạm đầu tròn của Đậu: bị chặn, có frame và cách sửa", () => {
    // Rút gọn từ action_keo_thuoc_day_3f3b của run e8143c46 (lọt kho vì luật chỉ có ở test kit).
    const pull = pose({ armA: [78, 10], armB: [86, 4], lean: -15, tilt: -6 });
    const error = checkRigClip({
      keys: [
        { frame: 0, pose: pose({}) },
        { frame: 14, pose: pull, ease: easing.outBack(1.4) },
        { frame: 32, pose: pull },
      ],
    });
    expect(error).toMatch(/^luật tay của rig: skin_dau: /);
    expect(error).toMatch(/frame \d+/);
    expect(error).toMatch(/Hạ tay/);
  });
});
