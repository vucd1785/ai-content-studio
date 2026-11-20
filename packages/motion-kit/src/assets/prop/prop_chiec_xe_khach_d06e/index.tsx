import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const yellow = "#FFC83D";
const yellowLight = "#FFE38A";
const yellowDark = "#E0A21E";
const glass = "#BFE8F7";

/** Xe khách vàng nhìn ngang: thân nảy nhẹ có co giãn, bánh quay, đèn pha nhấp nháy, ống xả phả khói. */
const BusYellow: FC<PropProps> = ({ frame, seed }) => {
  const cycle = (frame % 18) / 18;
  const up = easing.inOut(Math.abs(Math.sin(cycle * Math.PI)));
  const lift = up * 4;
  const squash = 1 - up;
  const sx = 1 + 0.012 * squash;
  const sy = 1 - 0.025 * squash;
  const tilt = 0.6 * wobble(frame, seed, 40);
  const spin = (frame * 9) % 360;
  const glow = 0.5 + 0.5 * wobble(frame, seed + 3, 24);
  const gid = `mk-gen-bus-body-${seed}`;
  const windows = [-54, -22, 8];
  const puffs = [0, 0.5].map((o) => ((frame / 30 + o) % 1));

  const wheel = (cx: number) => (
    <g transform={`translate(${cx} -18)`}>
      <circle cx={0} cy={0} r={17} fill="#3A3F4B" stroke={ink} strokeWidth={5} />
      <g transform={`rotate(${spin})`}>
        <circle cx={0} cy={0} r={8} fill={PALETTE.metal} stroke={ink} strokeWidth={3} />
        <line x1={-8} y1={0} x2={8} y2={0} stroke={ink} strokeWidth={2.5} />
        <line x1={0} y1={-8} x2={0} y2={8} stroke={ink} strokeWidth={2.5} />
      </g>
      <circle cx={-5} cy={-6} r={3} fill="#FFFFFF" opacity={0.35} />
    </g>
  );

  return (
    <g>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={yellowLight} />
          <stop offset="0.45" stopColor={yellow} />
          <stop offset="1" stopColor={yellowDark} />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={84} />
      <g
        transform={`translate(0 ${(-lift).toFixed(2)}) rotate(${tilt.toFixed(2)} 0 -26) translate(0 -26) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(0 26)`}
      >
        <path
          d="M -80 -28 L -80 -100 Q -80 -116 -64 -116 L 58 -116 Q 76 -116 79 -98 L 82 -50 L 82 -32 Q 82 -26 76 -26 L -76 -26 Q -80 -26 -80 -28 Z"
          fill={`url(#${gid})`}
          stroke={ink}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        <path
          d="M -72 -106 Q -72 -110 -64 -110 L 40 -110"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.55}
        />
        <rect x={-80} y={-44} width={162} height={16} fill={yellowDark} opacity={0.35} />
        <rect x={-80} y={-60} width={162} height={7} fill="#E07A1E" stroke={ink} strokeWidth={3} />
        {windows.map((x) => (
          <g key={x}>
            <circle cx={x} cy={-84} r={14} fill={glass} stroke={ink} strokeWidth={5} />
            <path
              d={`M ${x - 8} ${-88} A 9 9 0 0 1 ${x - 1} ${-94}`}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={3.5}
              strokeLinecap="round"
            />
          </g>
        ))}
        <rect x={27} y={-100} width={22} height={70} rx={4} fill={yellowDark} stroke={ink} strokeWidth={4} />
        <rect x={31} y={-94} width={14} height={26} rx={3} fill={glass} stroke={ink} strokeWidth={3} />
        <line x1={38} y1={-64} x2={38} y2={-34} stroke={ink} strokeWidth={2.5} />
        <path
          d="M 55 -106 L 72 -106 Q 77 -106 78 -100 L 80 -72 L 55 -72 Z"
          fill={glass}
          stroke={ink}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <line x1={60} y1={-80} x2={66} y2={-100} stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.8} />
        <circle cx={78} cy={-42} r={10} fill={PALETTE.warn} opacity={0.25 * glow} />
        <circle cx={78} cy={-42} r={5} fill="#FFF6C8" stroke={ink} strokeWidth={3} />
        <rect x={-82} y={-46} width={6} height={10} rx={2} fill={PALETTE.alert} stroke={ink} strokeWidth={2.5} />
        <rect x={64} y={-32} width={22} height={8} rx={4} fill={PALETTE.metal} stroke={ink} strokeWidth={3} />
        <rect x={-84} y={-32} width={16} height={8} rx={4} fill={PALETTE.metal} stroke={ink} strokeWidth={3} />
        <circle cx={-66} cy={-104} r={2.5} fill="#FFFFFF" opacity={0.8} />
      </g>
      {wheel(-50)}
      {wheel(50)}
      {puffs.map((p, i) => (
        <circle
          key={i}
          cx={-72 - p * 6}
          cy={-22 - p * 18}
          r={3 + p * 5}
          fill={PALETTE.smoke}
          stroke={ink}
          strokeWidth={2}
          opacity={0.7 * (1 - p)}
        />
      ))}
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 88,
  height: 126,
  Component: BusYellow,
};
