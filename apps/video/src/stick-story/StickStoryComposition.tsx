import { AUDIO_KIT_PUBLIC_DIR, audioKitFile, isSfxId, SFX_CLIPS } from "@studio/audio-kit";
import type { RemotionCaption } from "@studio/contracts";
import { actorPoseAt, getMotion, type Pose, type StageActor, StageShot } from "@studio/motion-kit";
import { type FC, useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  findActiveToken,
  findDisplayedGroup,
  groupCaptionPhrases,
} from "../captions/group-caption-tokens";
import { musicVolumeAt, speechRanges } from "./audio-mix";
import { captionFontStack } from "./caption-font";
import { FollowCard } from "./follow-card";
import {
  INTRO_CARD_FRAMES,
  OUTRO_CARD_FRAMES,
  type StickStoryRenderProps,
  type StickStoryShot,
  stickStoryDurationInFrames,
} from "./stick-story-props";

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
  const { width, height } = useVideoConfig();
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
      ...(a.outfit === undefined ? {} : { outfit: a.outfit }),
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
      props={shot.props}
      ambience={shot.ambience}
      frameSize={{ width, height }}
      {...(shot.mood === undefined ? {} : { mood: shot.mood })}
      {...(shot.effects === undefined ? {} : { effects: shot.effects })}
      {...(shot.illustration === undefined
        ? {}
        : {
            illustration: {
              style: shot.illustration.style,
              items: shot.illustration.items,
              owner: Math.max(
                0,
                shot.actors.findIndex((a) => a.character === shot.illustration?.owner),
              ),
            },
          })}
    />
  );
};

/**
 * Phụ đề theo người nói: một khung là một cụm nghĩa, không vắt qua hai người nói; mỗi từ tô màu của người nói.
 * Từ đang đọc được gạch chân (P6-21): giữ nguyên độ đậm để dòng chữ không xô lệch khi đọc.
 */
export const SpeakerCaptions: FC<{
  captions: RemotionCaption[];
  brand: StickStoryRenderProps["brand"];
}> = ({ captions, brand }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const wide = width > height;
  const timeMs = (frame / fps) * 1000;
  // Cụm nghĩa, không vắt qua hai người nói (ADR-014 bổ sung 2026-11-12).
  const groups = useMemo(() => groupCaptionPhrases(captions), [captions]);
  const active = findDisplayedGroup(groups, timeMs);
  const activeToken = findActiveToken(captions, timeMs);
  if (active === undefined || active === null) {
    return null;
  }
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center" }}>
      <div
        style={{
          // Khung ngang (ADR-022): đáy khung thấp hơn, phụ đề sát đáy và nhỏ hơn để không che nhân vật.
          marginBottom: wide ? 36 : 130,
          maxWidth: wide ? 1500 : 980,
          width: "100%",
          boxSizing: "border-box",
          padding: wide ? "14px 30px 18px" : "22px 34px 26px",
          borderRadius: 22,
          background: brand.captionBackground,
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: captionFontStack(brand.fontFamily),
            fontSize: wide ? 50 : 58,
            fontWeight: 700,
            lineHeight: 1.3,
            letterSpacing: 0.2,
            textAlign: "center",
            whiteSpace: "pre-wrap",
            textShadow: "0 2px 6px rgba(0,0,0,0.55)",
          }}
        >
          {active.tokens.map((token, i) => {
            const color =
              (token.speaker === undefined ? undefined : brand.speakerColors[token.speaker]) ??
              brand.textColor;
            // Nhóm đã tách theo người nói: từ đầu nhóm không có khoảng trắng dẫn.
            // Khoảng trắng dẫn nằm ngoài phần gạch chân để vạch chỉ nằm dưới chữ.
            const lead = i === 0 ? "" : (/^\s*/.exec(token.text)?.[0] ?? "");
            const word = token.text.slice(lead.length).replace(/^\s+/, "");
            return (
              <span key={`${token.startMs}-${token.text}`} style={{ color }}>
                {lead}
                <span
                  style={{
                    textDecorationLine: activeToken === token ? "underline" : "none",
                    textDecorationThickness: 5,
                    textUnderlineOffset: 10,
                  }}
                >
                  {word}
                </span>
              </span>
            );
          })}
        </p>
      </div>
    </AbsoluteFill>
  );
};

/** File của thư viện âm thanh trong `publicDir` (worker chép vào `audio-kit/`). */
function audioKitSrc(assetId: string): string | null {
  const file = audioKitFile(assetId);
  return file === null ? null : staticFile(`${AUDIO_KIT_PUBLIC_DIR}/${file}`);
}

/** Nhạc nền lặp suốt video, hạ khi có lời (ADR-019). */
const MusicBed: FC<{ props: StickStoryRenderProps }> = ({ props }) => {
  const total = stickStoryDurationInFrames(props);
  const ranges = useMemo(() => speechRanges(props.shots), [props.shots]);
  const src = props.music === undefined ? null : audioKitSrc(props.music.assetId);
  if (src === null) {
    return null;
  }
  return <Audio src={src} loop volume={(f) => musicVolumeAt(f, ranges, total)} />;
};

/** Độ mờ của thẻ: hiện trong `fadeIn` frame đầu, tắt trong `fadeOut` frame cuối. */
export function cardOpacity(local: number, duration: number, fadeIn = 8, fadeOut = 10): number {
  if (local < 0 || local >= duration) {
    return 0;
  }
  return Math.min(1, (local + 1) / fadeIn, (duration - local) / fadeOut);
}

/** Khung dọc: thẻ nằm giữa vùng trời trống ở nửa trên, trên đầu nhân vật (ADR-026). */
const CARD_TOP = 300;
/** Khung ngang (ADR-022): thẻ sát mép trên hơn vì khung thấp. */
const CARD_TOP_WIDE = 60;

const useCardTop = () => {
  const { width, height } = useVideoConfig();
  return width > height ? CARD_TOP_WIDE : CARD_TOP;
};

/**
 * Thẻ tiêu đề ở đầu video (ADR-021, ADR-032): nằm ở vùng phụ đề dưới đáy khung. Phụ đề của cảnh đọc tiêu đề đã
 * bị bỏ (ADR-026), nên thẻ không che hình tượng trưng và bối cảnh phía trên.
 */
const IntroCard: FC<{ title: string; fontFamily: string; durationInFrames: number }> = ({
  title,
  fontFamily,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 160 } });
  const { width, height } = useVideoConfig();
  const wide = width > height;
  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        opacity: cardOpacity(frame, durationInFrames),
      }}
    >
      <div
        data-card="intro"
        style={{
          // Cùng chỗ với hộp phụ đề (SpeakerCaptions).
          marginBottom: wide ? 36 : 120,
          maxWidth: wide ? 1600 : 980,
          padding: wide ? "16px 34px 20px" : "22px 36px 26px",
          borderRadius: 26,
          background: "rgba(11,13,18,0.78)",
          border: "4px solid rgba(255,255,255,0.9)",
          boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
          transform: `scale(${0.85 + 0.15 * pop}) rotate(${(1 - pop) * -2}deg)`,
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: captionFontStack(fontFamily),
            fontSize: wide ? 54 : 62,
            fontWeight: 800,
            lineHeight: 1.18,
            color: "#ffffff",
            textAlign: "center",
          }}
        >
          {title}
        </p>
      </div>
    </AbsoluteFill>
  );
};

/** Thẻ kênh ở cuối video (ADR-021): tên kênh (nếu đã đặt) và lời mời theo dõi trong nút đỏ. */
const OutroCard: FC<{
  channel: string | null;
  cta: string;
  fontFamily: string;
  durationInFrames: number;
}> = ({ channel, cta, fontFamily, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12, stiffness: 140 } });
  const pulse = 1 + 0.04 * Math.sin((frame / fps) * Math.PI * 2 * 1.2);
  const top = useCardTop();
  return (
    <AbsoluteFill
      style={{ alignItems: "center", opacity: cardOpacity(frame, durationInFrames, 10, 1) }}
    >
      <div
        data-card="outro"
        style={{
          marginTop: top,
          maxWidth: 940,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          padding: "26px 40px 30px",
          borderRadius: 30,
          background: "rgba(11,13,18,0.86)",
          border: "4px solid rgba(255,255,255,0.9)",
          transform: `translateY(${(1 - pop) * -40}px)`,
          fontFamily: captionFontStack(fontFamily),
        }}
      >
        {channel === null ? null : (
          <p style={{ margin: 0, fontSize: 64, fontWeight: 800, color: "#ffffff" }}>{channel}</p>
        )}
        <p
          style={{
            margin: 0,
            padding: "12px 34px",
            borderRadius: 999,
            background: "#e53935",
            color: "#ffffff",
            fontSize: 50,
            fontWeight: 800,
            transform: `scale(${pulse})`,
          }}
        >
          {cta}
        </p>
      </div>
    </AbsoluteFill>
  );
};

/** Thẻ kết chọn theo props: có `button` là thẻ mời theo dõi chuyển động (ADR-026), không thì thẻ ADR-021. */
const EndCard: FC<{
  outro: NonNullable<NonNullable<StickStoryRenderProps["cards"]>["outro"]>;
  fontFamily: string;
  durationInFrames: number;
}> = ({ outro, fontFamily, durationInFrames }) => {
  const top = useCardTop();
  if (outro.button === undefined) {
    return (
      <OutroCard
        channel={outro.channel}
        cta={outro.cta}
        fontFamily={fontFamily}
        durationInFrames={durationInFrames}
      />
    );
  }
  return (
    <FollowCard
      channel={outro.channel}
      cta={outro.cta}
      button={outro.button}
      fontFamily={fontFamily}
      durationInFrames={durationInFrames}
      top={top}
      {...(outro.accent === undefined ? {} : { accent: outro.accent })}
      {...(outro.avatar === undefined ? {} : { avatar: outro.avatar })}
    />
  );
};

const TitleCards: FC<{ props: StickStoryRenderProps }> = ({ props }) => {
  const total = stickStoryDurationInFrames(props);
  const intro = props.cards?.intro;
  const outro = props.cards?.outro;
  // Video quá ngắn thì bỏ thẻ kết thúc để hai thẻ không chồng nhau. Có cảnh mời theo dõi (ADR-026) thì thẻ hiện
  // từ đầu cảnh đó, nhưng không ngắn hơn 3 giây cuối.
  const introFrames = Math.max(INTRO_CARD_FRAMES, intro?.toFrame ?? 0);
  const outroFrom = Math.min(outro?.fromFrame ?? total, total - OUTRO_CARD_FRAMES);
  return (
    <>
      {intro === undefined ? null : (
        <Sequence from={0} durationInFrames={introFrames} name="intro-card">
          <IntroCard
            title={intro.title}
            fontFamily={props.brand.fontFamily}
            durationInFrames={introFrames}
          />
        </Sequence>
      )}
      {outro === undefined || outroFrom < introFrames ? null : (
        <Sequence from={outroFrom} durationInFrames={total - outroFrom} name="outro-card">
          <EndCard
            outro={outro}
            fontFamily={props.brand.fontFamily}
            durationInFrames={total - outroFrom}
          />
        </Sequence>
      )}
    </>
  );
};

/** Một SFX chỉ dài tối đa 2 giây; Sequence cắt phần thừa. */
const SFX_MAX_FRAMES = 60;

export const StickStoryComposition: FC<StickStoryRenderProps> = (props) => {
  const audioSrc = resolveAudioSrc(props.audio.src);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {audioSrc ? <Audio src={audioSrc} /> : null}
      <MusicBed props={props} />
      {props.sfx.map((cue) => {
        const src = audioKitSrc(cue.assetId);
        if (src === null || !isSfxId(cue.assetId)) {
          return null;
        }
        return (
          <Sequence
            key={`${cue.assetId}-${cue.fromFrame}`}
            from={cue.fromFrame}
            durationInFrames={SFX_MAX_FRAMES}
            name={cue.assetId}
          >
            <Audio src={src} volume={SFX_CLIPS[cue.assetId].volume} />
          </Sequence>
        );
      })}
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
      <TitleCards props={props} />
      <SpeakerCaptions captions={props.captions} brand={props.brand} />
    </AbsoluteFill>
  );
};
