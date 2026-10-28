import type { FC } from "react";
import { Composition } from "remotion";
import { EduVerticalComposition } from "./compositions/EduVerticalComposition";
import { SpikeComposition } from "./compositions/SpikeComposition";
import {
  EDU_VERTICAL_COMPOSITION_ID,
  EDU_VERTICAL_DEFAULT_PROPS,
  eduVerticalDurationInFrames,
  MVP_FPS,
  MVP_HEIGHT,
  MVP_WIDTH,
} from "./edu-vertical-props";
import {
  P0_05_SPIKE_PROPS,
  SPIKE_COMPOSITION_ID,
  SPIKE_DURATION_IN_FRAMES,
  SPIKE_FPS,
  SPIKE_HEIGHT,
  SPIKE_WIDTH,
} from "./spike-props";

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
      <Composition
        id={EDU_VERTICAL_COMPOSITION_ID}
        component={EduVerticalComposition}
        durationInFrames={eduVerticalDurationInFrames()}
        fps={MVP_FPS}
        width={MVP_WIDTH}
        height={MVP_HEIGHT}
        defaultProps={EDU_VERTICAL_DEFAULT_PROPS}
        calculateMetadata={({ props }) => {
          const input = props as typeof EDU_VERTICAL_DEFAULT_PROPS;
          return {
            durationInFrames: eduVerticalDurationInFrames(input),
            fps: input.fps,
            width: input.width,
            height: input.height,
          };
        }}
      />
    </>
  );
};
