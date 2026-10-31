import type { RemotionCaption } from "@studio/contracts";
import type { FC } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  findActiveGroup,
  findActiveToken,
  groupCaptionTokens,
} from "../captions/group-caption-tokens";
import { buildSceneFramePlan, captionsForScene } from "../timing/scene-frame-plan";
import { LightSceneSlot } from "./EduLightSlots";
import type { EduLightRenderProps } from "./edu-light-props";
import { eduLightTheme as theme } from "./edu-light-theme";

/** Cùng mốc gom phụ đề với EduVertical (05-VIDEO-PIPELINE). */
const COMBINE_MS = 1200;

function resolveAudioSrc(props: EduLightRenderProps): string | undefined {
  const raw = props.audio.src?.trim();
  if (!raw) {
    return undefined;
  }
  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("/") ||
    raw.startsWith("static-")
  ) {
    return raw;
  }
  return staticFile(raw);
}

/** Thanh tiến độ theo cảnh ở mép trên: cảnh đã qua đậm, cảnh hiện tại chạy theo frame. */
const SceneProgress: FC<{ index: number; sceneIds: string[]; durationInFrames: number }> = ({
  index,
  sceneIds,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const current = Math.min(1, frame / Math.max(1, durationInFrames));
  return (
    <div
      style={{
        position: "absolute",
        top: 56,
        left: theme.safeHorizontal,
        right: theme.safeHorizontal,
        display: "flex",
        gap: 12,
      }}
    >
      {sceneIds.map((sceneId, position) => {
        const fill = position < index ? 1 : position === index ? current : 0;
        return (
          <div
            key={sceneId}
            style={{ flex: 1, height: 10, borderRadius: 5, background: theme.progressTrack }}
          >
            <div
              style={{
                width: `${fill * 100}%`,
                height: "100%",
                borderRadius: 5,
                background: theme.accent,
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

/** Phụ đề trên thẻ trắng, từ đang đọc tô nền nhạt. Timing lấy từ caption trong props, không tính lại. */
const LightCaptions: FC<{ captions: RemotionCaption[] }> = ({ captions }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeMs = (frame / fps) * 1000;
  const activeGroup = findActiveGroup(groupCaptionTokens(captions, COMBINE_MS), timeMs);
  const activeToken = findActiveToken(captions, timeMs);
  if (!activeGroup) {
    return null;
  }
  return (
    <AbsoluteFill
      style={{ justifyContent: "flex-end", alignItems: "center", pointerEvents: "none" }}
    >
      <div
        style={{
          marginBottom: theme.safeBottom - 72,
          maxWidth: 952,
          width: "100%",
          background: theme.captionBackground,
          border: `2px solid ${theme.cardBorder}`,
          boxShadow: theme.cardShadow,
          borderRadius: 20,
          padding: "22px 30px",
          boxSizing: "border-box",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: theme.fontFamily,
            fontSize: 40,
            lineHeight: 1.4,
            textAlign: "center",
            // Xuống dòng trong khung; giữ khoảng trắng đầu token như caption gốc.
            whiteSpace: "pre-wrap",
            color: theme.textPrimary,
          }}
        >
          {activeGroup.tokens.map((token) => {
            const isActive = activeToken === token;
            return (
              <span
                key={`${token.startMs}-${token.text}`}
                style={{
                  color: isActive ? theme.accent : theme.textPrimary,
                  background: isActive ? theme.accentTint : "transparent",
                  borderRadius: 8,
                  fontWeight: isActive ? 800 : 500,
                }}
              >
                {token.text}
              </span>
            );
          })}
        </p>
      </div>
    </AbsoluteFill>
  );
};

/** Composition `EduLight` (P5-03): 1080×1920, 30 fps, timing và caption đọc từ props như EduVertical. */
export const EduLightComposition: FC<EduLightRenderProps> = (props) => {
  const { fps } = useVideoConfig();
  const framePlan = buildSceneFramePlan(props.scenes, fps);
  const audioSrc = resolveAudioSrc(props);

  return (
    <AbsoluteFill style={{ fontFamily: theme.fontFamily, background: theme.background }}>
      {audioSrc ? <Audio src={audioSrc} /> : null}
      {framePlan.map((plan, index) => {
        const scene = props.scenes[index];
        if (!scene) {
          return null;
        }
        return (
          <Sequence
            key={plan.sceneId}
            from={plan.startFrame}
            durationInFrames={plan.durationInFrames}
            name={plan.sceneId}
          >
            <SceneProgress
              index={index}
              sceneIds={framePlan.map((item) => item.sceneId)}
              durationInFrames={plan.durationInFrames}
            />
            <AbsoluteFill
              style={{
                paddingTop: theme.safeTop,
                paddingBottom: theme.safeBottom,
                paddingLeft: theme.safeHorizontal,
                paddingRight: theme.safeHorizontal,
                boxSizing: "border-box",
              }}
            >
              <LightSceneSlot scene={scene} />
            </AbsoluteFill>
            <LightCaptions
              captions={captionsForScene(props.captions, plan.fromMs, plan.durationMs)}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
