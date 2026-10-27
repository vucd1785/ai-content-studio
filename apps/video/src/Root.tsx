import type { FC } from "react";
import { Composition } from "remotion";
import { SpikeComposition } from "./compositions/SpikeComposition";
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
    </>
  );
};
