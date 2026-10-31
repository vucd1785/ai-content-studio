import { describe, expect, it } from "vitest";
import eduVerticalRedisFixture from "../../fixtures/edu-vertical-redis-props.json";
import { resolveCachedMp4Path } from "../render/cached-render";
import {
  EDU_VERTICAL_TEMPLATE_ID,
  EDU_VERTICAL_TEMPLATE_VERSION,
  eduVerticalRenderPropsSchema,
} from "../render-props/schema";
import { buildSceneFramePlan, totalDurationInFrames } from "../timing/scene-frame-plan";
import {
  EDU_LIGHT_DEFAULT_PROPS,
  EDU_LIGHT_TEMPLATE_ID,
  eduLightRenderPropsSchema,
  parseEduLightRenderProps,
} from "./edu-light-props";

describe("EduLight (P5-03)", () => {
  it("fixture Redis cũ vẫn là props EduVertical 1.0.0, không đổi", () => {
    const parsed = eduVerticalRenderPropsSchema.parse(eduVerticalRedisFixture);
    expect(parsed.templateId).toBe(EDU_VERTICAL_TEMPLATE_ID);
    expect(parsed.templateVersion).toBe(EDU_VERTICAL_TEMPLATE_VERSION);
    expect(totalDurationInFrames(buildSceneFramePlan(parsed.scenes, parsed.fps))).toBe(207);
  });

  it("mỗi schema chỉ nhận đúng templateId của nó", () => {
    expect(eduLightRenderPropsSchema.safeParse(eduVerticalRedisFixture).success).toBe(false);
    expect(eduVerticalRenderPropsSchema.safeParse(EDU_LIGHT_DEFAULT_PROPS).success).toBe(false);
    expect(() =>
      parseEduLightRenderProps({ ...eduVerticalRedisFixture, templateId: "Khac" }),
    ).toThrow();
  });

  it("props mặc định dùng lại nội dung, timing và caption của fixture Redis", () => {
    expect(EDU_LIGHT_DEFAULT_PROPS.templateId).toBe(EDU_LIGHT_TEMPLATE_ID);
    expect(EDU_LIGHT_DEFAULT_PROPS.scenes).toEqual(eduVerticalRedisFixture.scenes);
    expect(EDU_LIGHT_DEFAULT_PROPS.captions).toEqual(eduVerticalRedisFixture.captions);
    expect(EDU_LIGHT_DEFAULT_PROPS.scenes.map((scene) => scene.templateSlot)).toEqual([
      "title",
      "explain",
      "code",
      "diagram",
      "cta",
    ]);
  });

  it("vẫn giữ luật slot chung: cảnh đầu title, cảnh cuối cta", () => {
    const scenes = [...EDU_LIGHT_DEFAULT_PROPS.scenes].reverse();
    expect(
      eduLightRenderPropsSchema.safeParse({ ...EDU_LIGHT_DEFAULT_PROPS, scenes }).success,
    ).toBe(false);
  });

  it("cache MP4 tách thư mục theo templateId, hai template không đè nhau", () => {
    const common = { templateVersion: "1.0.0", purpose: "preview" as const, contentHash: "abc" };
    const vertical = resolveCachedMp4Path("cache", {
      ...common,
      templateId: EDU_VERTICAL_TEMPLATE_ID,
    });
    const light = resolveCachedMp4Path("cache", { ...common, templateId: EDU_LIGHT_TEMPLATE_ID });
    expect(light).not.toBe(vertical);
    expect(light).toContain(EDU_LIGHT_TEMPLATE_ID);
  });
});
