/**
 * Spike P6-03: 30 giây, 10 cảnh (20 cắt mỗi phút), hai nhân vật nói qua lại, cỡ cảnh luân phiên.
 * Dùng để đo thời gian render theo mức chi tiết bối cảnh. Không đăng ký vào workflow.
 */
import type { FC } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import {
  Character,
  type Expression,
  mixPose,
  POSES,
  type PoseKey,
  type SkinKey,
} from "./characters";
import { type DetailLevel, Foreground, Room } from "./room";

export const P603_FPS = 30;
export const P603_SHOT_FRAMES = 90;
export const P603_SHOTS = 10;
export const P603_DURATION = P603_SHOT_FRAMES * P603_SHOTS;

type ShotSize = "wide" | "medium" | "close" | "high";
type Shot = {
  size: ShotSize;
  speaker: SkinKey;
  focus: SkinKey;
  ti: { pose: PoseKey; expr: Expression };
  bit: { pose: PoseKey; expr: Expression };
  caption: string;
};

const SHOTS: Shot[] = [
  {
    size: "wide",
    speaker: "ti",
    focus: "ti",
    ti: { pose: "wave", expr: "vui" },
    bit: { pose: "idle", expr: "vui" },
    caption: "Bit ơi, nếu mình không cần ngủ thì sao?",
  },
  {
    size: "close",
    speaker: "bit",
    focus: "bit",
    ti: { pose: "idle", expr: "vui" },
    bit: { pose: "idle", expr: "nghingo" },
    caption: "Nghe hấp dẫn đấy. Nhưng khoan đã.",
  },
  {
    size: "medium",
    speaker: "ti",
    focus: "ti",
    ti: { pose: "point", expr: "dacy" },
    bit: { pose: "idle", expr: "nghingo" },
    caption: "Thêm tám tiếng mỗi ngày để chơi game!",
  },
  {
    size: "close",
    speaker: "bit",
    focus: "ti",
    ti: { pose: "idle", expr: "ngacnhien" },
    bit: { pose: "point", expr: "nghingo" },
    caption: "Thức 24 giờ là phản xạ chậm như người say.",
  },
  {
    size: "wide",
    speaker: "ti",
    focus: "ti",
    ti: { pose: "celebrate", expr: "vui" },
    bit: { pose: "hero", expr: "dacy" },
    caption: "Kệ, cứ thử một đêm thôi!",
  },
  {
    size: "medium",
    speaker: "bit",
    focus: "bit",
    ti: { pose: "idle", expr: "vui" },
    bit: { pose: "point", expr: "nghingo" },
    caption: "Đó là sự thật đã được đo trong nghiên cứu.",
  },
  {
    size: "close",
    speaker: "ti",
    focus: "ti",
    ti: { pose: "scared", expr: "hoang" },
    bit: { pose: "idle", expr: "nghingo" },
    caption: "Đêm thứ chín… sao mọi thứ quay vòng vậy?",
  },
  {
    size: "high",
    speaker: "bit",
    focus: "bit",
    ti: { pose: "scared", expr: "hoang" },
    bit: { pose: "wave", expr: "buon" },
    caption: "Não của cậu đang đòi lại món nợ.",
  },
  {
    size: "medium",
    speaker: "ti",
    focus: "ti",
    ti: { pose: "idle", expr: "buon" },
    bit: { pose: "idle", expr: "buon" },
    caption: "Thôi, mình đi ngủ đây.",
  },
  {
    size: "close",
    speaker: "bit",
    focus: "bit",
    ti: { pose: "idle", expr: "buon" },
    bit: { pose: "wave", expr: "vui" },
    caption: "Ngủ ngon nhé. Hẹn tập sau!",
  },
];

const POS: Record<SkinKey, { x: number; y: number; s: number }> = {
  ti: { x: 380, y: 1580, s: 1.7 },
  bit: { x: 730, y: 1580, s: 1.7 },
};

/** Điểm nhìn và độ phóng của camera theo cỡ cảnh; trong cảnh camera đẩy vào nhẹ 4%. */
function camera(shot: Shot, t: number) {
  const p = POS[shot.focus];
  const base = {
    wide: { s: 1, cx: 540, cy: 1150 },
    high: { s: 1.12, cx: 560, cy: 1250 },
    medium: { s: 1.55, cx: p.x, cy: p.y - 330 },
    close: { s: 2.5, cx: p.x, cy: p.y - (shot.focus === "ti" ? 560 : 520) },
  }[shot.size];
  const s = base.s * (1 + 0.04 * t);
  return `translate(${540 - base.cx * s} ${960 - base.cy * s}) scale(${s})`;
}

const Actor: FC<{
  skin: SkinKey;
  shot: Shot;
  prev: Shot | undefined;
  local: number;
  frame: number;
}> = ({ skin, shot, prev, local, frame }) => {
  const target = POSES[shot[skin].pose];
  const from = POSES[prev ? prev[skin].pose : "idle"];
  // Chuyển tư thế trong 10 frame đầu cảnh, có quá đà nhẹ (overshoot) rồi giữ.
  const t = interpolate(local, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.6)),
  });
  const speaking = shot.speaker === skin;
  const mouthOpen = speaking
    ? Math.abs(Math.sin(frame * 0.9) * 0.6 + Math.sin(frame * 0.37) * 0.4)
    : null;
  const blinkPhase = (frame + (skin === "ti" ? 0 : 47)) % 105;
  const p = POS[skin];
  return (
    <g transform={`translate(${p.x} ${p.y}) scale(${p.s})`}>
      <Character
        skin={skin}
        pose={mixPose(from, target, t)}
        expr={shot[skin].expr}
        blink={blinkPhase < 4}
        mouthOpen={mouthOpen}
        breathe={Math.sin(frame / 12) * 2}
      />
    </g>
  );
};

export const P603Scene: FC<{ level: DetailLevel; blur?: boolean }> = ({ level, blur = true }) => {
  const frame = useCurrentFrame();
  const index = Math.min(Math.floor(frame / P603_SHOT_FRAMES), P603_SHOTS - 1);
  const shot = SHOTS[index] as Shot;
  const local = frame - index * P603_SHOT_FRAMES;
  const prev = SHOTS[index - 1];
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920} role="img" aria-label="Cảnh thử">
        <title>Spike P6-03</title>
        <g transform={camera(shot, local / P603_SHOT_FRAMES)}>
          <Room level={level} frame={frame} />
          <Actor skin="ti" shot={shot} prev={prev} local={local} frame={frame} />
          <Actor skin="bit" shot={shot} prev={prev} local={local} frame={frame} />
          <Foreground level={level} blur={blur} />
        </g>
        <rect x={60} y={1700} width={960} height={110} rx={22} fill="rgba(11,13,18,0.78)" />
        <text
          x={540}
          y={1768}
          fill={shot.speaker === "ti" ? "#ffb08a" : "#8fe9ff"}
          fontSize={40}
          fontWeight={700}
          textAnchor="middle"
          fontFamily="system-ui, 'Segoe UI', sans-serif"
        >
          {shot.caption}
        </text>
      </svg>
    </AbsoluteFill>
  );
};
