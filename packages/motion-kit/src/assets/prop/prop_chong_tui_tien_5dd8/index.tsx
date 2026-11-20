import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const gold = "#F2B632";
const goldLight = "#FFE38A";
const goldDark = "#B9791A";
const green = "#3DBB6C";
const greenLight = "#8FE3A8";
const greenDark = "#23874A";

const bodyPath = (k: number): string => {
  const p = (x: number, y: number) => `${(x * k).toFixed(2)} ${(y * k).toFixed(2)}`;
  return (
    `M ${p(-12, -76)} C ${p(-36, -66)} ${p(-38, -20)} ${p(-31, -8)} ` +
    `Q ${p(-28, 0)} ${p(-16, 0)} L ${p(16, 0)} Q ${p(28, 0)} ${p(31, -8)} ` +
    `C ${p(38, -20)} ${p(36, -66)} ${p(12, -76)} Z`
  );
};

const topPath = (k: number): string => {
  const p = (x: number, y: number) => `${(x * k).toFixed(2)} ${(y * k).toFixed(2)}`;
  return (
    `M ${p(-11, -80)} L ${p(-20, -97)} L ${p(-7, -90)} L ${p(0, -101)} ` +
    `L ${p(7, -90)} L ${p(20, -97)} L ${p(11, -80)} Z`
  );
};

const Bag: FC<{ cx: number; k: number; frame: number; phase: number }> = ({
  cx,
  k,
  frame,
  phase,
}) => {
  const c = (frame + phase) % 48;
  const u = c < 12 ? easing.inOut(c / 12) : c < 30 ? 1 - easing.outBack(1.8)((c - 12) / 18) : 0;
  const sy = 1 - 0.06 * u;
  const sx = 1 + 0.05 * u;
  return (
    <g transform={`translate(${cx} 0) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`}>
      <path d={bodyPath(k)} fill="url(#mk-gen-bag-gold)" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
      <path
        d={`M ${-24 * k} ${-50 * k} C ${-26 * k} ${-34 * k} ${-24 * k} ${-18 * k} ${-18 * k} ${-10 * k}`}
        fill="none"
        stroke={goldLight}
        strokeWidth={6 * k}
        strokeLinecap="round"
        opacity={0.8}
      />
      <ellipse cx={18 * k} cy={-26 * k} rx={9 * k} ry={20 * k} fill={goldDark} opacity={0.3} />
      <circle cx={0} cy={-34 * k} r={13 * k} fill={goldLight} stroke={ink} strokeWidth={3.5} />
      <circle cx={0} cy={-34 * k} r={7 * k} fill="none" stroke={goldDark} strokeWidth={3} />
      <path d={topPath(k)} fill={gold} stroke={ink} strokeWidth={4.5} strokeLinejoin="round" />
      <rect
        x={-15 * k}
        y={-83 * k}
        width={30 * k}
        height={8 * k}
        rx={4 * k}
        fill={PALETTE.alert}
        stroke={ink}
        strokeWidth={3.5}
      />
    </g>
  );
};

const Sparkle: FC<{ x: number; y: number; s: number; o: number }> = ({ x, y, s, o }) => (
  <path
    d={`M ${x} ${y - 9 * s} Q ${x + 1.5 * s} ${y - 1.5 * s} ${x + 9 * s} ${y} Q ${x + 1.5 * s} ${y + 1.5 * s} ${x} ${y + 9 * s} Q ${x - 1.5 * s} ${y + 1.5 * s} ${x - 9 * s} ${y} Q ${x - 1.5 * s} ${y - 1.5 * s} ${x} ${y - 9 * s} Z`}
    fill="#FFF6C9"
    stroke={goldDark}
    strokeWidth={1.5}
    opacity={o}
  />
);

/** Chồng túi tiền vàng nhỏ dần cạnh mũi tên xanh đi xuống, đồng xu lấp lánh: chi phí giảm mạnh. */
const MoneyBagsDown: FC<PropProps> = ({ frame, seed }) => {
  const ac = (frame % 40) / 40;
  const drop = ac < 0.5 ? easing.inOut(ac * 2) : 1 - easing.inOut((ac - 0.5) * 2);
  const ay = drop * 9;
  const tw = (i: number) => {
    const v = Math.sin(frame * 0.18 + i * 2.1);
    return v > 0 ? v : 0;
  };
  const coinSpin = 0.55 + 0.45 * Math.abs(Math.cos(frame * 0.08));
  const sway = wobble(frame, seed, 90) * 1.5;
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-bag-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={goldLight} />
          <stop offset="0.5" stopColor={gold} />
          <stop offset="1" stopColor={goldDark} />
        </linearGradient>
        <linearGradient id="mk-gen-arrow-green" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={greenLight} />
          <stop offset="0.45" stopColor={green} />
          <stop offset="1" stopColor={greenDark} />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={86} />
      <Bag cx={-50} k={1.18} frame={frame} phase={0} />
      <Bag cx={4} k={0.86} frame={frame} phase={8} />
      <Bag cx={42} k={0.6} frame={frame} phase={16} />
      <g transform={`translate(${sway.toFixed(2)} ${ay.toFixed(2)})`}>
        <path
          d="M 62 -192 L 78 -192 L 78 -108 L 87 -108 L 70 -76 L 53 -108 L 62 -108 Z"
          fill="url(#mk-gen-arrow-green)"
          stroke={ink}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        <line x1={66} y1={-184} x2={66} y2={-116} stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.55} />
      </g>
      <g transform={`translate(-14 -6) scale(${coinSpin.toFixed(3)} 1)`}>
        <ellipse cx={0} cy={0} rx={11} ry={6} fill={gold} stroke={ink} strokeWidth={3.5} />
        <ellipse cx={-2} cy={-1.5} rx={5} ry={2.5} fill={goldLight} opacity={0.85} />
      </g>
      <ellipse cx={26} cy={-5} rx={10} ry={5} fill={gold} stroke={ink} strokeWidth={3.5} />
      <ellipse cx={24} cy={-6} rx={4.5} ry={2} fill={goldLight} opacity={0.85} />
      <ellipse cx={68} cy={-6} rx={9} ry={4.5} fill={goldDark} stroke={ink} strokeWidth={3.5} />
      <Sparkle x={-74} y={-150} s={0.6 + 0.6 * tw(0)} o={0.3 + 0.7 * tw(0)} />
      <Sparkle x={-14} y={-112} s={0.5 + 0.5 * tw(1)} o={0.3 + 0.7 * tw(1)} />
      <Sparkle x={30} y={-24} s={0.5 + 0.5 * tw(2)} o={0.3 + 0.7 * tw(2)} />
      <Sparkle x={36} y={-92} s={0.4 + 0.5 * tw(3)} o={0.3 + 0.7 * tw(3)} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 205,
  Component: MoneyBagsDown,
};
