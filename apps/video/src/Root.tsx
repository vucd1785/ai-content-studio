import type { FC } from "react";
import { Composition } from "remotion";
import { SpikeComposition } from "./compositions/SpikeComposition";
import { MVP_FPS, MVP_HEIGHT, MVP_WIDTH } from "./render-props/common";
import {
  P0_05_SPIKE_PROPS,
  SPIKE_COMPOSITION_ID,
  SPIKE_DURATION_IN_FRAMES,
  SPIKE_FPS,
  SPIKE_HEIGHT,
  SPIKE_WIDTH,
} from "./spike-props";
import { StickStoryComposition } from "./stick-story/StickStoryComposition";
import { STICK_STORY_FIXTURE_PROPS } from "./stick-story/stick-story-fixture";
import {
  STICK_STORY_COMPOSITION_ID,
  type StickStoryRenderProps,
  stickStoryDurationInFrames,
} from "./stick-story/stick-story-props";

export const RemotionRoot: FC = () => {
  return (
    <>
      <Composition
        id={SPIKE_COMPOSITION_ID}
        component={SpikeComposition}
        durationInFrames={SPIKE_DURATION_IN_FRAMES}
        fps={SPIKE_FPS}
        width={SPIKE_WIDTH}
        height={SPIKE_HEIGHT}
        defaultProps={P0_05_SPIKE_PROPS}
      />
      {/* P6-09: template nhân vật vẽ bằng motion kit; template duy nhất của studio (ADR-013 bổ sung (2)). */}
      <Composition
        id={STICK_STORY_COMPOSITION_ID}
        component={StickStoryComposition}
        durationInFrames={stickStoryDurationInFrames(STICK_STORY_FIXTURE_PROPS)}
        fps={MVP_FPS}
        width={MVP_WIDTH}
        height={MVP_HEIGHT}
        defaultProps={STICK_STORY_FIXTURE_PROPS}
        calculateMetadata={({ props }) => {
          const input = props as StickStoryRenderProps;
          return {
            durationInFrames: stickStoryDurationInFrames(input),
            fps: input.fps,
            width: input.width,
            height: input.height,
          };
        }}
      />
    </>
  );
};
