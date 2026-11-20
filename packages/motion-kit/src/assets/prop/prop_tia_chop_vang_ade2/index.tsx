import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, clamp } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";

const ink = PALETTE.ink;

const BOLT = "M -14 -236 L 32 -236 L 12 -176 L 42 -176 L -22 -48 L -4 -140 L -34 -140 Z";
const BOLT_HI = "M -8 -230 L 20 -230 L 2 -170 L 28 -170 L -10 -92 L 2 -146 L -24 -146 Z";
const CLOUD =
  "M -72 -228 C -92 -230 -92 -262 -66 -264 C -64 -292 -28 -300 -14 -280 C -2 -306 44 -304 50 -274 C 78 -278 92 -248 72 -230 C 74 -214 56 -208 44 -214 C 24 -204 -6 -204 -22 -214 C -40 -206 -66 -212 -72 -228 Z";

const flashAt = (c: number): number => {
  if (c < 3) return c / 3;
  if (c < 8) return 1 - 0.65 * easing.out((c - 3) / 5);
  if (c < 11) return 0.35 + 0.65 * ((c - 8) / 3);
  if (c < 32) return 1 - easing.out((c - 11) / 21);
  return 0;
};

const Spark: FC<{ x: number; y: number; s: number; o: number }> = ({ x, y, s, o }) => (
  <path
    d={`M ${x} ${y - s} Q ${x} ${y} ${x + s} ${y} Q ${x} ${y} ${x} ${y + s} Q ${x} ${y} ${x - s} ${y} Q ${x} ${y} ${x} ${y - s} Z`}
    fill="#FFFBE0"
    opacity={o}
  />
);

/** Tia chớp vàng trắng lóe sáng nhấp nháy dưới đám mây giông rồi tắt. */
const TiaChopVang: FC<PropProps> = ({ frame, seed }) => {
  const c = (((frame + seed * 13) % 64) + 64) % 64;
  const flash = clamp(flashAt(c), 0, 1);
  const boltOpacity = 0.3 + 0.7 * flash;
  const stretch = 1 + 0.05 * flash;
  const bob = Math.sin((frame / 64) * Math.PI * 2) * 3;
  const cloudSquash = 1 + 0.015 * Math.sin((frame / 32) * Math.PI * 2);
  const cloudLit = 0.15 + 0.45 * flash;
  return (
    <g>
      <defs>
        <radialGradient id="mk-gen-flash-glow" cx="0.5" cy="0.45" r="0.5">
          <stop offset="0%" stopColor="#FFFBE0" stopOpacity={0.95} />
          <stop offset="55%" stopColor="#FFE066" stopOpacity={0.45} />
          <stop offset="100%" stopColor="#FFE066" stopOpacity={0} />
        </radialGradient>
        <linearGradient id="mk-gen-bolt-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFF6B8" />
          <stop offset="60%" stopColor="#FFD43B" />
          <stop offset="100%" stopColor="#F5A623" />
        </linearGradient>
        <linearGradient id="mk-gen-cloud-fill" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#B9C2D6" />
          <stop offset="100%" stopColor="#6B7590" />
        </linearGradient>
      </defs>

      <ellipse cx={4} cy={-140} rx={84} ry={100} fill="url(#mk-gen-flash-glow)" opacity={flash} />

      <g transform={`translate(0 -236) scale(1 ${stretch.toFixed(3)}) translate(0 236)`} opacity={boltOpacity}>
        <path d={BOLT} fill="url(#mk-gen-bolt-fill)" stroke={ink} strokeWidth={6} strokeLinejoin="round" />
        <path d={BOLT_HI} fill="#FFFDF0" opacity={0.55 + 0.45 * flash} />
        <path d="M 12 -176 L 42 -176 L -22 -48 L 18 -168 Z" fill="#E08A10" opacity={0.35} />
      </g>

      <Spark x={-52} y={-150} s={9 * (0.5 + flash)} o={flash} />
      <Spark x={54} y={-120} s={7 * (0.5 + flash)} o={flash * 0.9} />
      <Spark x={-36} y={-70} s={6 * (0.5 + flash)} o={flash * 0.8} />
      <Spark x={34} y={-196} s={5 * (0.5 + flash)} o={flash * 0.7} />

      <g transform={`translate(0 ${bob.toFixed(2)}) translate(0 -250) scale(${cloudSquash.toFixed(3)} ${(2 - cloudSquash).toFixed(3)}) translate(0 250)`}>
        <path d={CLOUD} fill="url(#mk-gen-cloud-fill)" stroke={ink} strokeWidth={6} strokeLinejoin="round" />
        <path
          d="M -66 -248 C -70 -262 -54 -268 -48 -262 C -44 -284 -18 -286 -12 -270"
          fill="none"
          stroke="#E6EBF5"
          strokeWidth={6}
          strokeLinecap="round"
          opacity={0.8}
        />
        <ellipse cx={14} cy={-218} rx={52} ry={9} fill="#4A536B" opacity={0.35} />
        <ellipse cx={8} cy={-226} rx={46} ry={16} fill="#FFF1A8" opacity={cloudLit} />
        <circle cx={-30} cy={-272} r={5} fill="#FFFFFF" opacity={0.6} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 310,
  Component: TiaChopVang,
};
