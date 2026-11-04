import type { RemotionCaption } from "@studio/contracts";
import { actorPoseAt, getMotion, type Pose, type StageActor, StageShot } from "@studio/motion-kit";
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
import type { StickStoryRenderProps, StickStoryShot } from "./stick-story-props";

/** Hạt giống ổn định theo nhân vật: chớp mắt, thở, miệng khác nhau nhưng render lại giống hệt. */
export function characterSeed(characterKey: string): number {
  let h = 7;
  for (const ch of characterKey) {
    h = (h * 31 + ch.charCodeAt(0)) % 997;
  }
  return h + 1;
}

/**
 * Tư thế cuối của nhân vật ở shot liền trước trong cùng cảnh, để chuyển liền mạch qua cú cắt.
 * Sang cảnh mới thì nhân vật bắt đầu lại từ khóa đầu của hành động.
 */
export function previousPose(
  shots: readonly StickStoryShot[],
  index: number,
  character: string,
): Pose | undefined {
  const shot = shots[index];
  const prev = shots[index - 1];
  if (shot === undefined || prev === undefined || prev.sceneId !== shot.sceneId) {
    return undefined;
  }
  const actor = prev.actors.find((a) => a.character === character);
  if (actor === undefined) {
    return undefined;
  }
  return actorPoseAt(
    getMotion(actor.action),
    prev.fromFrame + prev.durationInFrames - 1,
    prev.fromFrame,
  );
}

function resolveAudioSrc(src: string | undefined): string | undefined {
  const raw = src?.trim();
  if (!raw) {
    return undefined;
  }
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("/")) {
    return raw;
  }
  return staticFile(raw);
}

const ShotView: FC<{ props: StickStoryRenderProps; index: number }> = ({ props, index }) => {
  const shot = props.shots[index] as StickStoryShot;
  const local = useCurrentFrame();
  const frame = shot.fromFrame + local;
  const focus = Math.max(
    0,
    shot.actors.findIndex((a) => a.character === shot.focus),
  );
  const actors: StageActor[] = shot.actors.map((a) => {
    const fromPose = previousPose(props.shots, index, a.character);
    return {
      skin: a.skin,
      action: a.action,
      expression: a.expression,
      slot: a.slot,
      speakingRanges: a.speakingRanges,
      seed: characterSeed(a.character),
      ...(fromPose === undefined ? {} : { fromPose }),
    };
  });
  return (
    <StageShot
      frame={frame}
      startFrame={shot.fromFrame}
      durationInFrames={shot.durationInFrames}
      background={shot.background}
      shotSize={shot.shotSize}
      camera={shot.camera}
      focus={focus}
      actors={actors}
      ambience={shot.ambience}
    />
  );
};

/**
 * Phụ đề theo người nói: một nhóm không vắt qua hai người nói; mỗi từ tô màu của người nói,
 * từ đang đọc đậm hơn.
 */
export const SpeakerCaptions: FC<{
  captions: RemotionCaption[];
  brand: StickStoryRenderProps["brand"];
}> = ({ captions, brand }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeMs = (frame / fps) * 1000;
  const groups = groupCaptionTokens(captions, 1200).flatMap((group) => {
    const out: { startMs: number; endMs: number; tokens: RemotionCaption[] }[] = [];
    for (const token of group.tokens) {
      const last = out[out.length - 1];
      if (last !== undefined && last.tokens[0]?.speaker === token.speaker) {
        last.tokens.push(token);
        last.endMs = token.endMs;
      } else {
        out.push({ startMs: token.startMs, endMs: token.endMs, tokens: [token] });
      }
    }
    return out;
  });
  const active = findActiveGroup(groups, timeMs);
  const activeToken = findActiveToken(captions, timeMs);
  if (active === undefined || active === null) {
    return null;
  }
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center" }}>
      <div
        style={{
          marginBottom: 110,
          maxWidth: 960,
          width: "100%",
          boxSizing: "border-box",
          padding: "20px 28px",
          borderRadius: 22,
          background: brand.captionBackground,
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: brand.fontFamily,
            fontSize: 42,
            lineHeight: 1.35,
            textAlign: "center",
            whiteSpace: "pre",
          }}
        >
          {active.tokens.map((token, i) => {
            const color =
              (token.speaker === undefined ? undefined : brand.speakerColors[token.speaker]) ??
              brand.textColor;
            // Nhóm đã tách theo người nói: từ đầu nhóm không có khoảng trắng dẫn.
            const text = i === 0 ? token.text.replace(/^\s+/, "") : token.text;
            return (
              <span
                key={`${token.startMs}-${token.text}`}
                style={{ color, fontWeight: activeToken === token ? 800 : 600 }}
              >
                {text}
              </span>
            );
          })}
        </p>
      </div>
    </AbsoluteFill>
  );
};

export const StickStoryComposition: FC<StickStoryRenderProps> = (props) => {
  const audioSrc = resolveAudioSrc(props.audio.src);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {audioSrc ? <Audio src={audioSrc} /> : null}
      {props.shots.map((shot, index) => (
        <Sequence
          key={shot.shotId}
          from={shot.fromFrame}
          durationInFrames={shot.durationInFrames}
          name={`${shot.sceneId}/${shot.shotId}`}
        >
          <ShotView props={props} index={index} />
        </Sequence>
      ))}
      <SpeakerCaptions captions={props.captions} brand={props.brand} />
    </AbsoluteFill>
  );
};
