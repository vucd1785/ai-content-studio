import type { CSSProperties, FC } from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { captionFontStack } from "./caption-font";

/** Màu nhấn khi kênh chưa có `palette.accent`. */
const DEFAULT_ACCENT = "#f26b3a";
/** Thẻ kem viền mực (ADR-029): cùng nét vẽ với nhân vật và bảng minh họa, thay nền tối nặng nề. */
const PANEL = "#fff6e6";
const INK = "#1f2a44";
const FOLLOW_RED = "#e53935";
const FOLLOWED_GREY = "#3b4252";

/** Frame con trỏ bấm nút, tính từ đầu thẻ; thẻ ngắn thì bấm sớm hơn để kịp thấy "Đã follow". */
export function followTapFrame(durationInFrames: number): number {
  return Math.max(24, Math.min(58, durationInFrames - 36));
}

const clamp01 = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Chuông nhỏ trên nút, lắc theo `swing` độ. */
const Bell: FC<{ size: number; swing: number }> = ({ size, swing }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    style={{ transform: `rotate(${swing}deg)`, transformOrigin: "50% 12%" }}
    aria-hidden="true"
  >
    <path
      d="M12 2.5c-3.6 0-6 2.7-6 6.3v3.9L4.2 16c-.4.7.1 1.5.9 1.5h13.8c.8 0 1.3-.8.9-1.5L18 12.7V8.8c0-3.6-2.4-6.3-6-6.3z"
      fill="#ffffff"
    />
    <circle cx="12" cy="20" r="2.2" fill="#ffffff" />
  </svg>
);

/** Con trỏ chuột trắng viền đậm: hình quen thuộc của "bấm" trên mọi nền tảng. */
const Cursor: FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size * 1.4} viewBox="0 0 50 70" aria-hidden="true">
    <path
      d="M4 3 L4 58 L17 46 L27 67 L37 62 L27 41 L45 41 Z"
      fill="#ffffff"
      stroke="#11141a"
      strokeWidth={4}
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Thẻ kết mời theo dõi chuyển động (ADR-026, Director 2026-11-12: "nên thiết kế hiệu ứng động … làm nổi bật kênh").
 *
 * - Tên kênh: chữ to màu nhấn của kênh, viền trắng, từng chữ cái bật lên rồi nhấp nhô.
 * - Lời mời: từng từ hiện dần.
 * - Nút Follow có chuông lắc; con trỏ bay vào bấm, nút đổi sang "✓ Đã follow", vòng sáng và sao bung ra.
 *
 * Mọi thứ là hàm thuần của frame. Khung ngang xếp lời mời cạnh nút để thẻ thấp, không che đầu nhân vật.
 */
export const FollowCard: FC<{
  channel: string | null;
  cta: string;
  button: string;
  fontFamily: string;
  durationInFrames: number;
  accent?: string;
  /** Khóa `staticFile` của avatar kênh (ADR-028); có thì thay chữ tên kênh. */
  avatar?: string;
  top: number;
}> = ({ channel, cta, button, fontFamily, durationInFrames, accent, avatar, top }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const wide = width > height;
  const color = accent ?? DEFAULT_ACCENT;
  const font = captionFontStack(fontFamily);

  const fadeOut = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], clamp01);
  const panelIn = spring({ frame, fps, config: { damping: 13, stiffness: 150 } });

  const letters = avatar === undefined ? [...(channel ?? "")] : [];
  const lettersDone = 4 + letters.length * 2;
  const words = cta.split(/\s+/u).filter((w) => w !== "");
  const wordsFrom = avatar !== undefined ? 12 : channel === null ? 4 : lettersDone + 2;
  const buttonFrom = wordsFrom + Math.min(words.length * 2, 18);
  const buttonIn = spring({
    frame: frame - buttonFrom,
    fps,
    config: { damping: 9, stiffness: 170 },
  });
  const tapAt = Math.max(followTapFrame(durationInFrames), buttonFrom + 14);
  const followed = frame >= tapAt;
  const press = interpolate(frame, [tapAt - 3, tapAt, tapAt + 4], [1, 0.88, 1], clamp01);
  const pulse = followed ? 1 : 1 + 0.05 * Math.sin((frame / fps) * Math.PI * 2 * 1.4);
  const bellSwing = followed
    ? 22 * Math.sin((frame - tapAt) * 0.9) * Math.exp(-(frame - tapAt) / 14)
    : 10 * Math.sin(frame * 0.5) * (frame % 40 < 14 ? 1 : 0.15);

  // Con trỏ bay từ góc dưới phải vào nút trong 14 frame trước khi bấm, rồi lùi ra.
  const cursorIn = interpolate(frame, [tapAt - 16, tapAt - 2], [0, 1], clamp01);
  const cursorOut = interpolate(frame, [tapAt + 10, tapAt + 22], [0, 1], clamp01);
  const cursorShow = frame >= tapAt - 16 && cursorOut < 1;
  const ring = interpolate(frame, [tapAt, tapAt + 16], [0, 1], clamp01);

  const nameSize = wide ? 74 : 92;
  const ctaSize = wide ? 40 : 48;
  const buttonSize = wide ? 42 : 50;

  // Avatar kênh (ADR-028): bật ra xoay nhẹ, lơ lửng, vòng sáng màu nhấn nhịp theo; nảy lên khi người xem bấm Follow.
  const avatarIn = spring({ frame: frame - 2, fps, config: { damping: 10, stiffness: 130 } });
  const avatarHop = followed ? 1 + 0.1 * Math.exp(-(frame - tapAt) / 6) : 1;
  const avatarSize = wide ? 300 : 320;
  const avatarView =
    avatar === undefined ? null : (
      <div
        style={{
          width: avatarSize,
          height: avatarSize,
          flexShrink: 0,
          borderRadius: "50%",
          overflow: "hidden",
          border: "6px solid #ffffff",
          boxShadow: `0 0 0 ${6 + 4 * Math.sin(frame * 0.2)}px ${color}, 0 10px 24px rgba(0,0,0,0.35)`,
          transform: `translateY(${6 * Math.sin(frame * 0.12)}px) scale(${Math.max(0, avatarIn) * avatarHop}) rotate(${(1 - Math.min(1, avatarIn)) * -25}deg)`,
          background: "#fff6e6",
        }}
      >
        <Img
          src={staticFile(avatar)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
    );
  const name =
    channel === null || avatar !== undefined ? null : (
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center" }}>
        {letters.map((ch, i) => {
          const s = spring({
            frame: frame - 4 - i * 2,
            fps,
            config: { damping: 8, stiffness: 190 },
          });
          const bob = 6 * Math.sin(frame * 0.18 - i * 0.6) * Math.min(1, s);
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: chữ cái lặp được, vị trí là định danh.
              key={i}
              style={{
                display: "inline-block",
                whiteSpace: "pre",
                fontSize: nameSize,
                fontWeight: 900,
                lineHeight: 1.1,
                color,
                WebkitTextStroke: `${wide ? 7 : 8}px #ffffff`,
                paintOrder: "stroke fill",
                textShadow: "0 6px 0 rgba(0,0,0,0.35)",
                transform: `translateY(${(1 - s) * 60 - bob}px) scale(${0.4 + 0.6 * s})`,
                opacity: Math.min(1, s * 1.5),
              }}
            >
              {ch}
            </span>
          );
        })}
      </div>
    );

  const ctaLine = (
    <p
      style={{
        margin: 0,
        fontSize: ctaSize,
        fontWeight: 800,
        lineHeight: 1.2,
        color: INK,
        textAlign: "center",
        maxWidth: wide ? 640 : 900,
      }}
    >
      {words.map((w, i) => {
        const s = interpolate(frame, [wordsFrom + i * 2, wordsFrom + i * 2 + 6], [0, 1], clamp01);
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: từ lặp được, vị trí là định danh.
            key={i}
            style={{
              display: "inline-block",
              marginRight: "0.28em",
              opacity: s,
              transform: `translateY(${(1 - s) * 14}px)`,
            }}
          >
            {w}
          </span>
        );
      })}
    </p>
  );

  const pill: CSSProperties = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 12,
    margin: 0,
    padding: wide ? "10px 30px" : "14px 38px",
    borderRadius: 999,
    background: followed ? FOLLOWED_GREY : FOLLOW_RED,
    color: "#ffffff",
    fontSize: buttonSize,
    fontWeight: 900,
    boxShadow: followed ? "none" : "0 6px 0 #9e1f1c",
    transform: `scale(${Math.max(0, buttonIn) * pulse * press})`,
    whiteSpace: "nowrap",
  };
  const followButton = (
    <div style={{ position: "relative" }}>
      {ring > 0 && ring < 1 ? (
        <div
          style={{
            position: "absolute",
            inset: -18 - 50 * ring,
            borderRadius: 999,
            border: `${6 * (1 - ring)}px solid ${color}`,
            opacity: 1 - ring,
          }}
        />
      ) : null}
      {followed
        ? [0, 1, 2, 3, 4, 5].map((k) => {
            const a = (k / 6) * Math.PI * 2 + 0.4;
            const d = 40 + 110 * ring;
            return (
              <span
                key={k}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  fontSize: 30,
                  color: k % 2 === 0 ? color : "#ffd54a",
                  transform: `translate(${Math.cos(a) * d * 1.6 - 15}px, ${Math.sin(a) * d - 18}px) scale(${1 - ring * 0.6})`,
                  opacity: 1 - ring,
                }}
              >
                ★
              </span>
            );
          })
        : null}
      <p style={pill}>
        {followed ? (
          <span>✓ Đã follow</span>
        ) : (
          <>
            <Bell size={buttonSize} swing={bellSwing} />
            <span>{button}</span>
          </>
        )}
      </p>
      {cursorShow ? (
        <div
          style={{
            position: "absolute",
            left: "62%",
            top: "48%",
            transform: `translate(${(1 - cursorIn) * 220 + cursorOut * 140}px, ${(1 - cursorIn) * 180 + cursorOut * 120}px) scale(${frame >= tapAt && frame < tapAt + 4 ? 0.86 : 1})`,
            opacity: 1 - cursorOut,
          }}
        >
          <Cursor size={wide ? 46 : 54} />
        </div>
      ) : null}
    </div>
  );

  // Khung ngang (ADR-029): thẻ hồ sơ kênh đứng bên trái, giữa chiều cao; nhân vật đứng bên phải chỉ sang thẻ.
  // Khung dọc: thẻ ở nửa trên, nhân vật bên dưới chỉ lên.
  const tilt = -1.2 + 0.4 * Math.sin(frame * 0.05);
  return (
    <AbsoluteFill
      style={{
        alignItems: wide ? "flex-start" : "center",
        justifyContent: wide ? "center" : "flex-start",
        paddingLeft: wide ? 90 : 0,
        opacity: fadeOut,
      }}
    >
      <div
        data-card="outro"
        style={{
          position: "relative",
          marginTop: wide ? -40 : avatar !== undefined ? Math.min(top, 130) : top,
          width: wide ? 720 : undefined,
          maxWidth: wide ? 720 : 940,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: wide ? 16 : 18,
          padding: wide ? "34px 40px 36px" : "30px 40px 34px",
          borderRadius: 36,
          background: PANEL,
          border: `7px solid ${INK}`,
          boxShadow: `0 0 0 ${4 + 3 * Math.sin(frame * 0.2)}px ${color}66, 12px 16px 0 rgba(11,13,18,0.18)`,
          transform: `translateY(${(1 - panelIn) * -60}px) scale(${0.9 + 0.1 * panelIn}) rotate(${tilt}deg)`,
          fontFamily: font,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -24,
            left: "50%",
            width: 150,
            height: 46,
            marginLeft: -75,
            borderRadius: 6,
            background: color,
            opacity: 0.85,
            transform: "rotate(3deg)",
          }}
        />
        {avatarView}
        {name}
        {ctaLine}
        {followButton}
      </div>
    </AbsoluteFill>
  );
};
