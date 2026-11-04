/** Entry riêng của spike P6-03, tách khỏi `src/index.ts` của workflow. */
import type { FC } from "react";
import { Composition, registerRoot } from "remotion";
import { P603_DURATION, P603_FPS, P603Scene } from "./scene";

const Root: FC = () => (
  <>
    {([1, 2, 3] as const).map((level) => (
      <Composition
        key={level}
        id={`P603-L${level}`}
        component={P603Scene}
        durationInFrames={P603_DURATION}
        fps={P603_FPS}
        width={1080}
        height={1920}
        defaultProps={{ level }}
      />
    ))}
    <Composition
      id="P603-L3-noblur"
      component={P603Scene}
      durationInFrames={P603_DURATION}
      fps={P603_FPS}
      width={1080}
      height={1920}
      defaultProps={{ level: 3, blur: false }}
    />
  </>
);

registerRoot(Root);
