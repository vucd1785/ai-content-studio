import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { redoTarget } from "@studio/contracts";
import { redoIdFromJobKey, redoJobKey } from "@studio/db";
import { STICK_STORY_FIXTURE_PROPS } from "@studio/video/stick-story/fixture";
import { afterAll, describe, expect, it } from "vitest";
import { approvalIdFromRenderJobKey, renderBarrier } from "../assets/approved-script.js";
import { OUTRO_CTA, titleCards } from "../cli/build-stick-story-props.js";
import { applyRedoOverrides, loadRedoOverrides } from "./redo.js";

const RUN = "11111111-1111-4111-8111-111111111111";
const APPROVAL = "22222222-2222-4222-8222-222222222222";
const REDO_A = "33333333-3333-4333-8333-333333333333";
const REDO_B = "44444444-4444-4444-8444-444444444444";
const REDO_OLD = "55555555-5555-4555-8555-555555555555";

const dataDir = mkdtempSync(join(tmpdir(), "redo-"));
afterAll(() => rmSync(dataDir, { recursive: true, force: true }));

function writeRedo(redoId: string, createdAt: string, request: unknown, result?: unknown) {
  const dir = join(dataDir, "artifacts", RUN, "redo");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${redoId}.json`), JSON.stringify({ redoId, createdAt, request }));
  if (result !== undefined) {
    writeFileSync(join(dir, `${redoId}.result.json`), JSON.stringify(result));
  }
}

describe("làm lại một phần ở Cổng 2 (ADR-021)", () => {
  it("key job làm lại giữ approval, có redoId; đọc lại cảnh tạo job render cùng redoId", () => {
    const voiceKey = redoJobKey("voice", RUN, APPROVAL, REDO_A);
    const renderKey = redoJobKey("render", RUN, APPROVAL, REDO_A);
    expect(redoIdFromJobKey(voiceKey)).toBe(REDO_A);
    expect(redoIdFromJobKey(`render:${RUN}:approval:${APPROVAL}`)).toBeNull();
    expect(approvalIdFromRenderJobKey(renderKey)).toBe(APPROVAL);
    expect(renderBarrier(RUN, APPROVAL, voiceKey)).toEqual({
      requiredJobKeys: [voiceKey],
      nextJob: { role: "video", queue: "render", idempotencyKey: renderKey },
    });
    // Job thường vẫn chờ cả visual lẫn voice.
    expect(
      renderBarrier(RUN, APPROVAL, `voice:${RUN}:approval:${APPROVAL}`).requiredJobKeys,
    ).toHaveLength(2);
    expect(redoTarget("revoice")).toBe("producing_assets");
    expect(redoTarget("background")).toBe("preview_rendering");
    expect(redoTarget("rerender")).toBe("preview_rendering");
  });

  it("áp đổi nền và tạo lại hình sau lần duyệt kịch bản, theo thứ tự thời gian", async () => {
    const scene = STICK_STORY_FIXTURE_PROPS.shots[0]?.sceneId as string;
    const oldBg = STICK_STORY_FIXTURE_PROPS.shots[0]?.background as string;
    writeRedo(REDO_OLD, "2026-11-01T00:00:00.000Z", {
      kind: "background",
      sceneId: scene,
      backgroundId: "bg_truoc_duyet",
    });
    writeRedo(REDO_A, "2026-11-12T01:00:00.000Z", {
      kind: "background",
      sceneId: scene,
      backgroundId: "bg_moi",
    });
    writeRedo(
      REDO_B,
      "2026-11-12T02:00:00.000Z",
      { kind: "regenerate_asset", assetId: "bg_moi", note: "sáng hơn" },
      { redoId: REDO_B, oldAssetId: "bg_moi", newAssetId: "bg_moi_v2", error: null },
    );
    const overrides = await loadRedoOverrides(dataDir, RUN, new Date("2026-11-10T00:00:00Z"));
    expect(overrides).toEqual([
      { kind: "background", sceneId: scene, backgroundId: "bg_moi" },
      { kind: "swap", from: "bg_moi", to: "bg_moi_v2" },
    ]);
    const next = applyRedoOverrides(STICK_STORY_FIXTURE_PROPS, overrides);
    for (const shot of next.shots) {
      if (shot.sceneId === scene) {
        expect(shot.background).toBe("bg_moi_v2");
      } else {
        expect(shot.background).not.toBe("bg_moi_v2");
      }
    }
    expect(STICK_STORY_FIXTURE_PROPS.shots[0]?.background).toBe(oldBg);
  });

  it("tạo lại hình không thành thì không đổi gì", async () => {
    const run2 = "66666666-6666-4666-8666-666666666666";
    const dir = join(dataDir, "artifacts", run2, "redo");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, `${REDO_A}.json`),
      JSON.stringify({
        redoId: REDO_A,
        createdAt: "2026-11-12T01:00:00.000Z",
        request: { kind: "regenerate_asset", assetId: "prop_x", note: "to hơn" },
      }),
    );
    writeFileSync(
      join(dir, `${REDO_A}.result.json`),
      JSON.stringify({ redoId: REDO_A, oldAssetId: "prop_x", newAssetId: null, error: "lỗi" }),
    );
    expect(await loadRedoOverrides(dataDir, run2, new Date(0))).toEqual([]);
    expect(
      await loadRedoOverrides(dataDir, "77777777-7777-4777-8777-777777777777", new Date(0)),
    ).toEqual([]);
  });
});

describe("thẻ chữ (ADR-021)", () => {
  it("tiêu đề một dòng; tên kênh chỉ khi đã đặt", () => {
    expect(titleCards("Vì sao\n biển   mặn?", "Tí Bit")).toEqual({
      intro: { title: "Vì sao biển mặn?" },
      outro: { channel: "Tí Bit", cta: OUTRO_CTA },
    });
    expect(titleCards("A", "Kênh mặc định").outro.channel).toBeNull();
    expect(titleCards("A", null).outro.channel).toBeNull();
  });
});
