import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MOTION_KIT_VERSION } from "@studio/motion-kit";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { renderStickStoryWithCache } from "./cached-render";
import { characterSeed, previousPose } from "./StickStoryComposition";
import { STICK_STORY_FIXTURE_PROPS } from "./stick-story-fixture";
import { hashStickStoryRenderProps } from "./stick-story-hash";
import {
  parseStickStoryRenderProps,
  STICK_STORY_MOTION_KIT_VERSION,
  stickStoryDurationInFrames,
  stickStoryRenderPropsSchema,
  stickStoryTemplateVersion,
} from "./stick-story-props";

const fixture = STICK_STORY_FIXTURE_PROPS;

describe("render props StickStory", () => {
  it("version kit ghim trong props bằng MOTION_KIT_VERSION của packages/motion-kit", () => {
    expect(STICK_STORY_MOTION_KIT_VERSION).toBe(MOTION_KIT_VERSION);
    expect(fixture.templateVersion).toBe(`1.1.0+kit.${MOTION_KIT_VERSION}`);
    expect(fixture.motionKitVersion).toBe(MOTION_KIT_VERSION);
  });

  it("fixture hai nhân vật hợp lệ: 1080×1920, 30 fps, shot nối liền, phụ đề có người nói", () => {
    expect(fixture.width).toBe(1080);
    expect(fixture.height).toBe(1920);
    expect(fixture.fps).toBe(30);
    expect(fixture.shots).toHaveLength(7);
    const characters = new Set(fixture.shots.flatMap((s) => s.actors.map((a) => a.character)));
    expect([...characters].sort()).toEqual(["bit", "dau", "ti"]);
    expect(new Set(fixture.captions.map((c) => c.speaker))).toEqual(new Set(["ti", "bit"]));
    const sceneFrames = fixture.scenes.reduce(
      (sum, s) => sum + Math.round((s.durationMs * 30) / 1000),
      0,
    );
    expect(stickStoryDurationInFrames(fixture)).toBe(sceneFrames);
  });

  it("chặn shot hở frame, focus ngoài shot, templateVersion không khớp kit", () => {
    const gap = structuredClone(fixture);
    (gap.shots[1] as { fromFrame: number }).fromFrame += 1;
    expect(stickStoryRenderPropsSchema.safeParse(gap).success).toBe(false);
    const focus = structuredClone(fixture);
    (focus.shots[1] as { focus: string }).focus = "dau";
    expect(stickStoryRenderPropsSchema.safeParse(focus).success).toBe(false);
    const version = { ...structuredClone(fixture), templateVersion: "1.0.0+kit.9.9.9" };
    expect(() => parseStickStoryRenderProps(version)).toThrow();
  });

  it("đổi version kit thì đổi templateVersion và content_hash", () => {
    const next = parseStickStoryRenderProps({
      ...fixture,
      motionKitVersion: "0.9.0",
      templateVersion: stickStoryTemplateVersion("1.1.0", "0.9.0"),
    });
    const options = { audioContentSha256: "a".repeat(64) };
    expect(next.templateVersion).not.toBe(fixture.templateVersion);
    expect(hashStickStoryRenderProps(next, options)).not.toBe(
      hashStickStoryRenderProps(fixture, options),
    );
    // audio.src là đường dẫn tạm, không vào hash.
    expect(
      hashStickStoryRenderProps({ ...fixture, audio: { ...fixture.audio, src: "x.wav" } }, options),
    ).toBe(hashStickStoryRenderProps(fixture, options));
  });

  it("không có chữ phủ màn hình hay khung bảng (Director 2026-11-03): schema từ chối hai trường này", () => {
    const withText = structuredClone(fixture);
    (withText.shots[0] as Record<string, unknown>).onScreenText = "Chữ phủ";
    expect(stickStoryRenderPropsSchema.safeParse(withText).success).toBe(false);
    const withBoard = structuredClone(fixture);
    (withBoard.scenes[0] as Record<string, unknown>).board = {
      kind: "code",
      codeSnippet: { language: "text", code: "x" },
    };
    expect(stickStoryRenderPropsSchema.safeParse(withBoard).success).toBe(false);
  });
});

describe("cache render StickStory", () => {
  let cacheRoot: string;
  afterEach(() => {
    rmSync(cacheRoot, { recursive: true, force: true });
  });

  it("cùng props thì trúng cache; đổi kit thì render lại, không trả MP4 cũ", async () => {
    cacheRoot = mkdtempSync(join(tmpdir(), "p609-cache-"));
    const renders: string[] = [];
    const renderMedia = async (o: { outputLocation: string }) => {
      renders.push(o.outputLocation);
      writeFileSync(o.outputLocation, "mp4");
    };
    const common = {
      purpose: "preview" as const,
      cacheRoot,
      serveUrl: "x",
      composition: {},
      renderMedia,
      audioContentSha256: "b".repeat(64),
      validateCachedMp4: () => true,
    };
    const first = await renderStickStoryWithCache({ ...common, props: fixture });
    const again = await renderStickStoryWithCache({ ...common, props: fixture });
    expect(first.cacheHit).toBe(false);
    expect(again.cacheHit).toBe(true);
    expect(again.outputLocation).toBe(first.outputLocation);
    const newKit = parseStickStoryRenderProps({
      ...fixture,
      motionKitVersion: "0.9.0",
      templateVersion: stickStoryTemplateVersion("1.1.0", "0.9.0"),
    });
    const third = await renderStickStoryWithCache({ ...common, props: newKit });
    expect(third.cacheHit).toBe(false);
    expect(third.outputLocation).not.toBe(first.outputLocation);
    expect(third.outputLocation).toContain("kit.0.9.0");
    expect(renders).toHaveLength(2);
  });
});

describe("composition", () => {
  it("tư thế nối qua cú cắt trong cùng cảnh, không nối sang cảnh mới", () => {
    const shots = fixture.shots;
    // s1 → s2 cùng cảnh "mo-dau": Bit có ở s1 nên nối tư thế; Đậu không có ở s1.
    expect(previousPose(shots, 1, "bit")).toBeDefined();
    expect(previousPose(shots, 1, "dau")).toBeUndefined();
    const firstOfScene2 = shots.findIndex((s) => s.sceneId === "su-that");
    expect(previousPose(shots, firstOfScene2, "bit")).toBeUndefined();
  });

  it("hạt giống nhân vật ổn định và khác nhau", () => {
    expect(characterSeed("ti")).toBe(characterSeed("ti"));
    expect(characterSeed("ti")).not.toBe(characterSeed("bit"));
  });

  it("không dùng số ngẫu nhiên, mạng, R3F trong stick-story", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const dir = join(import.meta.dirname, ".");
    const files = readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts"));
    const hits = files.filter((f) =>
      /Math\.random|\bfetch\(|@react-three|\beval\(/.test(readFileSync(join(dir, f), "utf8")),
    );
    expect(hits).toEqual([]);
    expect(renderToStaticMarkup(createElement("div"))).toBe("<div></div>");
  });
});
