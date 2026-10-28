import type { FC } from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import { SceneCaptions } from "../components/SceneCaptions";
import { SafeArea, SceneBackground } from "../components/SceneChrome";
import { SceneSlot } from "../components/slots/SceneSlots";
import type { EduVerticalRenderProps } from "../render-props/schema";
import { eduTheme } from "../theme/edu-theme";
import { buildSceneFramePlan, captionsForScene } from "../timing/scene-frame-plan";

function resolveAudioSrc(props: EduVerticalRenderProps): string | undefined {
  const raw = props.audio.src?.trim();
  if (!raw) {
    return undefined;
  }
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }
  if (raw.startsWith("/") || raw.startsWith("static-")) {
    return raw;
  }
  return staticFile(raw);
}

export const EduVerticalComposition: FC<EduVerticalRenderProps> = (props) => {
  const { fps } = useVideoConfig();
  const framePlan = buildSceneFramePlan(props.scenes, fps);
  const audioSrc = resolveAudioSrc(props);

  return (
    <AbsoluteFill style={{ fontFamily: eduTheme.fontFamily, backgroundColor: "#0b1120" }}>
      {audioSrc ? <Audio src={audioSrc} /> : null}
      {framePlan.map((plan, index) => {
        const scene = props.scenes[index];
        if (!scene) {
          return null;
        }
        const sceneCaptions = captionsForScene(props.captions, plan.fromMs, plan.durationMs);
        return (
          <Sequence
            key={plan.sceneId}
            from={plan.startFrame}
            durationInFrames={plan.durationInFrames}
            name={plan.sceneId}
          >
            <SceneBackground />
            <SafeArea>
              <SceneSlot scene={scene} />
            </SafeArea>
            <SceneCaptions captions={sceneCaptions} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
