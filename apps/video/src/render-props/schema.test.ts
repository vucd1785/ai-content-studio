import { describe, expect, it } from "vitest";
import { buildRedisEduVerticalFixtureProps } from "../fixtures/redis-edu-props";
import { buildSceneFramePlan, totalDurationInFrames } from "../timing/scene-frame-plan";
import {
  eduVerticalRenderPropsSchema,
  parseEduVerticalRenderProps,
  RenderPropsError,
} from "./schema";

describe("eduVerticalRenderPropsSchema", () => {
  it("fixture Redis hợp lệ với 5 slot", () => {
    const props = buildRedisEduVerticalFixtureProps();
    expect(parseEduVerticalRenderProps(props)).toEqual(props);
    expect(props.scenes.map((scene) => scene.templateSlot)).toEqual([
      "title",
      "explain",
      "code",
      "diagram",
      "cta",
    ]);
    expect(props.width).toBe(1080);
    expect(props.height).toBe(1920);
    expect(props.fps).toBe(30);
  });

  it("tổng frame composition khớp plan P1-01", () => {
    const props = buildRedisEduVerticalFixtureProps();
    const plan = buildSceneFramePlan(props.scenes, props.fps);
    expect(totalDurationInFrames(plan)).toBeGreaterThan(0);
    expect(props.captions.some((caption) => caption.text.includes("Redis"))).toBe(true);
  });

  it("props rỗng hoặc sai template bị từ chối", () => {
    expect(() => parseEduVerticalRenderProps({})).toThrow(RenderPropsError);
    const props = buildRedisEduVerticalFixtureProps();
    expect(eduVerticalRenderPropsSchema.safeParse({ ...props, templateId: "Other" }).success).toBe(
      false,
    );
  });
});
