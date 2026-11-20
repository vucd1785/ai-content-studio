import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { clamp, easing, lerp, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";

const ink = PALETTE.ink;

const SHELL_PATH = "M -22 0 C -30 -40 -20 -80 4 -100 C 0 -70 12 -32 20 0 Z";
const SHELL_HI = "M -14 -8 C -20 -40 -12 -72 0 -88 C -6 -66 -8 -36 -6 -8 Z";
const SHELL_SHADE = "M 8 -8 C 2 -36 0 -66 2 -90 C 6 -64 12 -34 16 -8 Z";
const CANOPY =
  "M -36 0 Q -34 -34 0 -38 Q 34 -34 36 0 Q 27 -7 18 -1 Q 9 -8 0 -1 Q -9 -8 -18 -1 Q -27 -7 -36 0 Z";

type HalfProps = { fx: number; lift: number; rot: number; bob: number; mirror: boolean };

const ShellHalf: FC<HalfProps> = ({ fx, lift, rot, bob, mirror }) => (
  <g transform={`translate(${fx} ${(-lift + bob).toFixed(2)}) rotate(${rot.toFixed(2)})`}>
    <g transform={mirror ? "scale(-1 1)" : undefined}>
      <path d={SHELL_PATH} fill="url(#mk-gen-fairing)" stroke={ink} strokeWidth={6} strokeLinejoin="round" />
      <path d={SHELL_HI} fill="#FFFFFF" opacity={0.75} />
      <path d={SHELL_SHADE} fill="#8FA3B8" opacity={0.35} />
      <path d="M -24 -22 Q -2 -20 18 -22" fill="none" stroke={ink} strokeWidth={3} opacity={0.6} />
      <circle cx={-16} cy={-30} r={2.5} fill={PALETTE.metalDark} />
      <circle cx={-12} cy={-56} r={2.5} fill={PALETTE.metalDark} />
      <circle cx={-6} cy={-78} r={2.2} fill={PALETTE.metalDark} />
      <rect x={-17} y={-48} width={7} height={12} rx={2} fill={PALETTE.accent} stroke={ink} strokeWidth={2} />
    </g>
  </g>
);

type ChuteProps = { cx: number; cy: number; sway: number; sag: number; tipX: number; tipY: number };

const Chute: FC<ChuteProps> = ({ cx, cy, sway, sag, tipX, tipY }) => {
  const x = cx + sway;
  const pts = [-34, -12, 12, 34];
  return (
    <g>
      {pts.map((p) => (
        <line
          key={p}
          x1={x + p}
          y1={cy - 1}
          x2={tipX}
          y2={tipY}
          stroke={ink}
          strokeWidth={2}
          opacity={0.8}
        />
      ))}
      <g transform={`translate(${x.toFixed(2)} ${cy.toFixed(2)}) rotate(${(sway * 1.2).toFixed(2)}) scale(1 ${sag.toFixed(3)})`}>
        <path d={CANOPY} fill="url(#mk-gen-chute)" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        <path d="M -12 -2 Q -10 -24 0 -37" fill="none" stroke="#B9420F" strokeWidth={3} opacity={0.7} />
        <path d="M 12 -2 Q 10 -24 0 -37" fill="none" stroke="#B9420F" strokeWidth={3} opacity={0.7} />
        <path d="M -28 -8 Q -26 -26 -8 -33" fill="none" stroke="#FFD2A8" strokeWidth={4} strokeLinecap="round" opacity={0.8} />
        <rect x={-4} y={-40} width={8} height={5} rx={2} fill={PALETTE.paper} stroke={ink} strokeWidth={2} />
      </g>
    </g>
  );
};

/** Hai nửa nắp mũi tên lửa hạ xuống biển dưới dù cam rồi lắc lư trên sóng. */
const FairingHalvesSplashdown: FC<PropProps> = ({ frame, t, seed }) => {
  const prog = clamp((t ?? 1) / 0.6, 0, 1);
  const landed = easing.inOut(prog);
  const lift = lerp(90, 0, landed);
  const rockAmt = lerp(0.3, 1, landed);
  const rotL = -6 + 6 * rockAmt * wobble(frame, seed, 64);
  const rotR = 6 + 6 * rockAmt * wobble(frame, seed + 3, 72);
  const bobL = 2.5 * landed * wobble(frame, seed + 5, 48);
  const bobR = 2.5 * landed * wobble(frame, seed + 9, 52);
  const sag = lerp(1, 0.82, landed) + 0.03 * wobble(frame, seed + 11, 40);
  const swayL = 3 * wobble(frame, seed + 13, 80);
  const swayR = 3 * wobble(frame, seed + 17, 90);
  const ripple = (frame % 60) / 60;
  const ripple2 = ((frame + 30) % 60) / 60;

  const tip = (fx: number, rot: number, bob: number, mirror: boolean) => {
    const lx = mirror ? -4 : 4;
    const a = (rot * Math.PI) / 180;
    return {
      x: fx + lx * Math.cos(a) + 100 * Math.sin(a),
      y: -lift + bob + lx * Math.sin(a) - 100 * Math.cos(a),
    };
  };
  const tl = tip(-36, rotL, bobL, false);
  const tr = tip(36, rotR, bobR, true);
  const chuteY = -205 - lift;

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-fairing" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.6" stopColor="#EEF2F6" />
          <stop offset="1" stopColor="#C3CFDB" />
        </linearGradient>
        <linearGradient id="mk-gen-chute" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFA552" />
          <stop offset="1" stopColor="#E0561B" />
        </linearGradient>
        <radialGradient id="mk-gen-sea" cx="0.4" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#6FC6F0" />
          <stop offset="1" stopColor="#2A86C4" />
        </radialGradient>
      </defs>

      <ellipse cx={0} cy={-2} rx={86} ry={16} fill="url(#mk-gen-sea)" stroke={ink} strokeWidth={5} />
      <ellipse
        cx={-36}
        cy={-2}
        rx={lerp(16, 40, ripple)}
        ry={lerp(4, 9, ripple)}
        fill="none"
        stroke="#DFF4FF"
        strokeWidth={2.5}
        opacity={(1 - ripple) * 0.8 * landed}
      />
      <ellipse
        cx={36}
        cy={-2}
        rx={lerp(16, 40, ripple2)}
        ry={lerp(4, 9, ripple2)}
        fill="none"
        stroke="#DFF4FF"
        strokeWidth={2.5}
        opacity={(1 - ripple2) * 0.8 * landed}
      />

      <Chute cx={-42} cy={chuteY} sway={swayL} sag={sag} tipX={tl.x} tipY={tl.y} />
      <Chute cx={42} cy={chuteY + 6} sway={swayR} sag={sag} tipX={tr.x} tipY={tr.y} />

      <ShellHalf fx={-36} lift={lift} rot={rotL} bob={bobL} mirror={false} />
      <ShellHalf fx={36} lift={lift} rot={rotR} bob={bobR} mirror />

      <path
        d={`M -74 2 Q -56 ${(-6 + 2 * wobble(frame, seed, 30)).toFixed(2)} -38 2 Q -20 ${(-6 - 2 * wobble(frame, seed, 30)).toFixed(2)} 0 2 Q 20 ${(-6 + 2 * wobble(frame, seed + 1, 34)).toFixed(2)} 38 2 Q 56 ${(-6 - 2 * wobble(frame, seed + 1, 34)).toFixed(2)} 74 2 Q 40 14 0 14 Q -40 14 -74 2 Z`}
        fill="#3FA2DC"
        opacity={0.9 * landed}
      />
      <path d="M -60 -1 Q -50 -5 -40 -1" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.8 * landed} />
      <path d="M 44 1 Q 54 -3 64 1" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.8 * landed} />
      <circle cx={-62} cy={-10 - 3 * ripple} r={2.5} fill="#FFFFFF" opacity={(1 - ripple) * landed} />
      <circle cx={62} cy={-10 - 3 * ripple2} r={2.5} fill="#FFFFFF" opacity={(1 - ripple2) * landed} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 310,
  Component: FairingHalvesSplashdown,
};
