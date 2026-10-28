import { describe, expect, it } from "vitest";
import { buildRedisEduVerticalFixtureProps } from "../fixtures/redis-edu-props";
import { hashEduVerticalRenderProps } from "./content-hash";

describe("hashEduVerticalRenderProps", () => {
  it("ổn định với cùng props", () => {
    const props = buildRedisEduVerticalFixtureProps();
    const a = hashEduVerticalRenderProps(props);
    const b = hashEduVerticalRenderProps(props);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("bỏ qua audio.src tạm thời", () => {
    const props = buildRedisEduVerticalFixtureProps();
    const withSrc = {
      ...props,
      audio: { ...props.audio, src: "https://example.test/audio.wav" },
    };
    expect(hashEduVerticalRenderProps(withSrc)).toBe(hashEduVerticalRenderProps(props));
  });

  it("đổi templateVersion đổi hash", () => {
    const props = buildRedisEduVerticalFixtureProps();
    const bumped = { ...props, templateVersion: "1.0.1" };
    expect(hashEduVerticalRenderProps(bumped)).not.toBe(hashEduVerticalRenderProps(props));
  });

  it("đổi nội dung scene đổi hash", () => {
    const props = buildRedisEduVerticalFixtureProps();
    const scenes = [...props.scenes];
    const first = scenes[0];
    if (!first) {
      throw new Error("fixture missing first scene");
    }
    scenes[0] = { ...first, onScreenText: "Khác" };
    expect(hashEduVerticalRenderProps({ ...props, scenes })).not.toBe(
      hashEduVerticalRenderProps(props),
    );
  });
});
