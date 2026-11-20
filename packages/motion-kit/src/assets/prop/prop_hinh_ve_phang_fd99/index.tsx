import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

/** Bàn tay mở giữ thăng bằng cây bút chì vàng dựng đứng, bút chao nghiêng qua lại. */
const HandBalancePencil: FC<PropProps> = ({ frame, seed }) => {
  const phase = (frame / 56) * Math.PI * 2;
  const s = Math.sin(phase);
  const eased = s * Math.abs(s) * 0.55 + s * 0.45;
  const angle = 12 * eased + 2.5 * wobble(frame, seed, 23);
  const handX = -angle * 0.7;
  const lag = Math.sin(phase - 0.6);
  const handTilt = -2.5 * lag;
  const sweat = 0.5 + 0.5 * Math.sin(phase * 2);
  const lineOp = Math.min(1, Math.abs(s) * 1.3);
  const side = s >= 0 ? 1 : -1;

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-pencil-fd99" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFE680" />
          <stop offset="0.45" stopColor="#FFC93C" />
          <stop offset="1" stopColor="#E09A12" />
        </linearGradient>
        <linearGradient id="mk-gen-sleeve-fd99" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6FA8E8" />
          <stop offset="1" stopColor="#3A6FB8" />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={56} />
      {/* base block */}
      <rect x={-48} y={-22} width={96} height={22} rx={8} fill={PALETTE.wood} stroke={ink} strokeWidth={5} />
      <rect x={-40} y={-18} width={40} height={5} rx={2.5} fill="#FFFFFF" opacity={0.3} />
      <g transform={`translate(${handX.toFixed(2)} 0) rotate(${handTilt.toFixed(2)} 0 -22)`}>
        {/* sleeve */}
        <path
          d="M -24 -22 L -22 -92 Q 0 -100 22 -92 L 24 -22 Z"
          fill="url(#mk-gen-sleeve-fd99)"
          stroke={ink}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        <rect x={-27} y={-100} width={54} height={14} rx={7} fill="#2F5C9E" stroke={ink} strokeWidth={5} />
        {/* forearm */}
        <path
          d="M -15 -100 L -16 -126 Q 0 -132 16 -126 L 15 -100 Z"
          fill={PALETTE.tiSkin}
          stroke={ink}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        {/* palm */}
        <path
          d="M -44 -134 Q -52 -150 -38 -156 L 40 -156 Q 60 -156 62 -146 Q 60 -134 40 -134 Q 18 -124 0 -122 Q -26 -118 -44 -134 Z"
          fill={PALETTE.tiSkin}
          stroke={ink}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        {/* palm shade */}
        <path d="M -30 -128 Q 0 -120 36 -136 Q 10 -130 -30 -128 Z" fill="#B9764A" opacity={0.35} />
        {/* finger creases */}
        <path d="M 22 -156 Q 26 -148 24 -140" fill="none" stroke={ink} strokeWidth={3} strokeLinecap="round" />
        <path d="M 36 -156 Q 40 -148 38 -140" fill="none" stroke={ink} strokeWidth={3} strokeLinecap="round" />
        <path d="M 48 -155 Q 52 -148 50 -141" fill="none" stroke={ink} strokeWidth={3} strokeLinecap="round" />
        {/* thumb */}
        <ellipse
          cx={-46}
          cy={-160}
          rx={8}
          ry={14}
          transform="rotate(-25 -46 -160)"
          fill={PALETTE.tiSkin}
          stroke={ink}
          strokeWidth={5}
        />
        {/* palm highlight */}
        <ellipse cx={-14} cy={-150} rx={20} ry={3} fill="#FFFFFF" opacity={0.35} />
        {/* pencil */}
        <g transform={`translate(0 -156) rotate(${angle.toFixed(2)})`}>
          <rect x={-10} y={-20} width={20} height={20} rx={6} fill="#F59AB0" stroke={ink} strokeWidth={5} />
          <rect x={-11} y={-34} width={22} height={16} fill={PALETTE.metal} stroke={ink} strokeWidth={4} />
          <line x1={-10} y1={-26} x2={10} y2={-26} stroke={PALETTE.metalDark} strokeWidth={3} />
          <rect x={-10} y={-126} width={20} height={92} fill="url(#mk-gen-pencil-fd99)" stroke={ink} strokeWidth={5} />
          <rect x={-6} y={-122} width={4} height={84} rx={2} fill="#FFFFFF" opacity={0.45} />
          <rect x={3} y={-124} width={5} height={88} fill="#B8780A" opacity={0.3} />
          <path d="M -10 -126 L 0 -150 L 10 -126 Z" fill="#F2D2A0" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
          <path d="M -4 -141 L 0 -150 L 4 -141 Z" fill={PALETTE.ink} />
        </g>
      </g>
      {/* motion lines */}
      <g opacity={lineOp} stroke={ink} strokeWidth={4} strokeLinecap="round" fill="none">
        <path d={`M ${(side * 50).toFixed(1)} -270 Q ${(side * 60).toFixed(1)} -255 ${(side * 56).toFixed(1)} -238`} />
        <path d={`M ${(side * 64).toFixed(1)} -250 Q ${(side * 72).toFixed(1)} -238 ${(side * 68).toFixed(1)} -224`} />
      </g>
      {/* sweat drop / sparkle */}
      <path
        d="M -62 -196 Q -68 -186 -62 -182 Q -56 -186 -62 -196 Z"
        fill="#8FD3FF"
        stroke={ink}
        strokeWidth={3}
        opacity={sweat}
      />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 300,
  Component: HandBalancePencil,
};
