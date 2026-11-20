import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { clamp, easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

/** Màn hình trò chơi: nhân vật đa giác chạy nhảy trên nền cuộn, tay cầm chơi game phía trước. */
const GameScreen: FC<PropProps> = ({ frame, seed }) => {
  const glow = 0.5 + 0.5 * wobble(frame, seed, 40);
  const scroll = (frame * 2) % 60;
  const hillScroll = (frame * 0.8) % 90;

  const cycle = 48;
  const u = (frame % cycle) / cycle;
  let jump = 0;
  let squash = 0;
  if (u >= 0.5) {
    const v = (u - 0.5) / 0.5;
    jump = 34 * Math.sin(Math.PI * easing.inOut(v));
    squash = -0.1 * Math.sin(Math.PI * v);
  } else {
    const land = clamp(1 - u / 0.12, 0, 1);
    squash = 0.16 * easing.out(land);
  }
  const airborne = u >= 0.5;
  const swing = airborne ? 0.5 : Math.sin(frame * 0.55);
  const sy = 1 - squash;
  const sx = 1 + squash * 0.6;
  const bodyBob = airborne ? 0 : Math.abs(Math.sin(frame * 0.55)) * 2;
  const press = airborne && u < 0.62 ? 1 : 0;
  const gemBob = 3 * Math.sin(frame * 0.15);
  const gemX = 60 - ((frame * 2 + 40) % 150);

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-gs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fd3ff" />
          <stop offset="1" stopColor="#d9f3ff" />
        </linearGradient>
        <linearGradient id="mk-gen-gs-frame" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a5568" />
          <stop offset="1" stopColor="#1f2633" />
        </linearGradient>
        <clipPath id="mk-gen-gs-clip">
          <rect x={-74} y={-254} width={148} height={114} rx={6} />
        </clipPath>
      </defs>
      <ContactShadow halfWidth={80} />

      {/* chân đế */}
      <rect x={-12} y={-128} width={24} height={60} fill={PALETTE.metalDark} stroke={ink} strokeWidth={5} />
      <rect x={-44} y={-76} width={88} height={14} rx={7} fill={PALETTE.metal} stroke={ink} strokeWidth={5} />

      {/* khung màn hình */}
      <rect x={-86} y={-266} width={172} height={138} rx={14} fill="url(#mk-gen-gs-frame)" stroke={ink} strokeWidth={6} />
      <rect x={-80} y={-261} width={60} height={5} rx={2.5} fill="#ffffff" opacity={0.25} />
      <circle cx={70} cy={-134} r={2.5} fill="#76b900" opacity={0.5 + 0.5 * glow} />

      {/* nội dung trò chơi */}
      <g clipPath="url(#mk-gen-gs-clip)">
        <rect x={-74} y={-254} width={148} height={114} fill="url(#mk-gen-gs-sky)" />
        <circle cx={-48} cy={-232} r={10} fill={PALETTE.warn} opacity={0.9} />
        {[0, 1, 2, 3].map((i) => {
          const hx = -90 + i * 90 - hillScroll;
          return (
            <g key={`h${i}`}>
              <polygon points={`${hx},-162 ${hx + 45},-206 ${hx + 90},-162`} fill="#5fb37a" />
              <polygon points={`${hx + 45},-206 ${hx + 90},-162 ${hx + 45},-162`} fill="#3f8f5c" />
            </g>
          );
        })}
        <rect x={-74} y={-162} width={148} height={22} fill="#8a5a3b" />
        {[0, 1, 2, 3, 4].map((i) => {
          const tx = -74 + i * 60 - scroll;
          return (
            <g key={`t${i}`}>
              <polygon points={`${tx},-162 ${tx + 30},-162 ${tx + 15},-150`} fill="#6fcf4f" />
              <polygon points={`${tx + 30},-162 ${tx + 60},-162 ${tx + 45},-150`} fill="#4fae3a" />
            </g>
          );
        })}
        <rect x={-74} y={-164} width={148} height={4} fill="#9be36b" />

        {/* viên ngọc */}
        <g transform={`translate(${gemX.toFixed(2)} ${(-212 + gemBob).toFixed(2)})`}>
          <polygon points="0,-9 7,0 0,9 -7,0" fill={PALETTE.warn} stroke={ink} strokeWidth={2.5} />
          <polygon points="0,-9 0,9 -7,0" fill="#fff3a6" />
          <circle cx={9} cy={-8} r={1.6 + glow * 1.4} fill="#ffffff" opacity={glow} />
        </g>

        {/* nhân vật đa giác */}
        <ellipse cx={-25} cy={-162} rx={11 - jump * 0.15} ry={2.5} fill={ink} opacity={0.25} />
        <g transform={`translate(-25 ${(-162 - jump).toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`}>
          <g transform={`rotate(${(swing * 35).toFixed(2)} -3 -13)`}>
            <polygon points="-6,-13 0,-13 -1,0 -7,0" fill="#2b4a8a" stroke={ink} strokeWidth={2} />
          </g>
          <g transform={`rotate(${(-swing * 35).toFixed(2)} 3 -13)`}>
            <polygon points="0,-13 6,-13 7,0 1,0" fill="#3c63b5" stroke={ink} strokeWidth={2} />
          </g>
          <g transform={`translate(0 ${(-bodyBob).toFixed(2)})`}>
            <polygon points="-9,-14 9,-14 10,-28 -10,-28" fill={PALETTE.alert} stroke={ink} strokeWidth={2.5} />
            <polygon points="0,-14 9,-14 10,-28 0,-28" fill="#b8322f" opacity={0.6} />
            <polygon points="-10,-28 0,-28 -9,-14" fill="#ffffff" opacity={0.2} />
            <g transform={`rotate(${(-swing * 40).toFixed(2)} -10 -26)`}>
              <polygon points="-10,-27 -14,-26 -15,-16 -11,-16" fill={PALETTE.tiSkin} stroke={ink} strokeWidth={2} />
            </g>
            <polygon points="-8,-29 -4,-40 6,-40 9,-32 6,-28 -4,-28" fill={PALETTE.tiSkin} stroke={ink} strokeWidth={2.5} />
            <polygon points="1,-40 6,-40 9,-32 6,-28 1,-28" fill="#d99a6c" opacity={0.7} />
            <polygon points="-6,-38 -3,-44 7,-43 8,-38" fill="#3a2a1e" stroke={ink} strokeWidth={2} />
            <rect x={3} y={-36} width={2.5} height={3.5} fill={ink} />
            <g transform={`rotate(${(swing * 40).toFixed(2)} 10 -26)`}>
              <polygon points="10,-27 14,-26 15,-16 11,-16" fill="#e8a979" stroke={ink} strokeWidth={2} />
            </g>
          </g>
        </g>
        {/* lớp phản chiếu kính */}
        <polygon points="-74,-254 -30,-254 -74,-200" fill="#ffffff" opacity={0.18} />
      </g>
      <rect x={-74} y={-254} width={148} height={114} rx={6} fill="none" stroke={ink} strokeWidth={4} />

      {/* tay cầm chơi game */}
      <g transform="translate(0 -30)">
        <path
          d="M -46 -18 Q -60 -20 -64 2 Q -66 22 -52 22 Q -42 22 -34 10 L 34 10 Q 42 22 52 22 Q 66 22 64 2 Q 60 -20 46 -18 Z"
          fill="#2f3a4c"
          stroke={ink}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        <path d="M -46 -14 Q -56 -14 -58 0" fill="none" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" opacity={0.3} />
        <path d="M 34 10 Q 42 20 52 20 Q 62 20 62 4" fill="none" stroke="#141a24" strokeWidth={3} opacity={0.5} />
        <rect x={-48} y={-7} width={18} height={6} rx={2} fill={PALETTE.metal} stroke={ink} strokeWidth={2} />
        <rect x={-42} y={-13} width={6} height={18} rx={2} fill={PALETTE.metal} stroke={ink} strokeWidth={2} />
        <circle cx={-12} cy={2} r={5} fill={PALETTE.metalDark} stroke={ink} strokeWidth={2} />
        <circle cx={12} cy={2} r={5} fill={PALETTE.metalDark} stroke={ink} strokeWidth={2} />
        <circle cx={40} cy={-11} r={4.5} fill={PALETTE.ok} stroke={ink} strokeWidth={2} />
        <circle cx={48} cy={-3} r={4.5} fill={PALETTE.alert} stroke={ink} strokeWidth={2} />
        <circle cx={32} cy={-3} r={4.5} fill={PALETTE.screen} stroke={ink} strokeWidth={2} />
        <circle
          cx={40}
          cy={5 + press}
          r={4.5 - press * 0.6}
          fill={press ? "#fff3a6" : PALETTE.warn}
          stroke={ink}
          strokeWidth={2}
        />
        <circle cx={40} cy={5} r={9} fill={PALETTE.warn} opacity={press * 0.35} />
        <circle cx={0} cy={-10} r={3} fill="#76b900" opacity={0.4 + 0.6 * glow} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 268,
  Component: GameScreen,
};
