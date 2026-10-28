import { describe, expect, it } from "vitest";
import { buildRedisEduVerticalFixtureProps } from "../fixtures/redis-edu-props";
import { hashEduVerticalRenderProps } from "./content-hash";

const SILENT_AUDIO_SHA = "0".repeat(64);

describe("hashEduVerticalRenderProps", () => {
  it("ổn định với cùng props và audio identity", () => {
    const props = buildRedisEduVerticalFixtureProps();
    const options = { audioContentSha256: SILENT_AUDIO_SHA };
    const a = hashEduVerticalRenderProps(props, options);
    const b = hashEduVerticalRenderProps(props, options);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("bỏ qua audio.src tạm thời", () => {
    const props = buildRedisEduVerticalFixtureProps();
    const options = { audioContentSha256: SILENT_AUDIO_SHA };
    const withSrc = {
      ...props,
      audio: { ...props.audio, src: "https://example.test/audio.wav" },
    };
    expect(hashEduVerticalRenderProps(withSrc, options)).toBe(
      hashEduVerticalRenderProps(props, options),
    );
  });

  it("đổi audio bytes đổi hash", () => {
    const props = buildRedisEduVerticalFixtureProps();
    const a = hashEduVerticalRenderProps(props, { audioContentSha256: "a".repeat(64) });
    const b = hashEduVerticalRenderProps(props, { audioContentSha256: "b".repeat(64) });
    expect(a).not.toBe(b);
  });

  it("đổi templateVersion đổi hash", () => {
    const props = buildRedisEduVerticalFixtureProps();
    const options = { audioContentSha256: SILENT_AUDIO_SHA };
    const bumped = { ...props, templateVersion: "1.0.1" };
    expect(hashEduVerticalRenderProps(bumped, options)).not.toBe(
      hashEduVerticalRenderProps(props, options),
    );
  });

  it("đổi nội dung scene đổi hash", () => {
    const props = buildRedisEduVerticalFixtureProps();
    const options = { audioContentSha256: SILENT_AUDIO_SHA };
    const scenes = [...props.scenes];
    const first = scenes[0];
    if (!first) {
      throw new Error("fixture missing first scene");
    }
    scenes[0] = { ...first, onScreenText: "Khác" };
    expect(hashEduVerticalRenderProps({ ...props, scenes }, options)).not.toBe(
      hashEduVerticalRenderProps(props, options),
    );
  });
});
