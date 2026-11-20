import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

const VN_PATH =
  "M -38 -118 C -28 -128 -10 -124 2 -120 C 14 -122 26 -116 30 -104 C 24 -96 14 -92 8 -84 C 4 -76 2 -66 -2 -58 C -6 -48 -10 -38 -10 -30 C -6 -20 4 -10 14 0 C 24 10 32 24 34 40 C 36 54 32 66 22 76 C 12 84 2 88 -6 96 C -14 104 -20 112 -26 122 C -30 116 -32 106 -30 98 C -28 90 -22 84 -16 78 C -8 70 -6 56 -4 44 C -4 30 -12 18 -18 8 C -22 -4 -18 -20 -16 -32 C -18 -46 -28 -56 -34 -66 C -40 -78 -46 -96 -46 -106 C -46 -112 -42 -116 -38 -118 Z";

/** Bảng bản đồ dải đất Việt Nam hình chữ S bên biển xanh, viền nhấp nháy nhẹ. */
const VietnamMapBoard: FC<PropProps> = ({ frame, seed }) => {
  const phase = (frame % 48) / 48;
  const tri = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  const blink = easing.inOut(tri);
  const breathe = 1 + 0.015 * wobble(frame, seed, 60);
  const waveX = 4 * wobble(frame, seed + 3, 50);
  const spark1 = 0.5 + 0.5 * wobble(frame, seed + 11, 22);
  const spark2 = 0.5 + 0.5 * wobble(frame, seed + 17, 30);
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-vn-sea" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7FD3F5" />
          <stop offset="1" stopColor="#2E8BC9" />
        </linearGradient>
        <linearGradient id="mk-gen-vn-land" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#F2564B" />
          <stop offset="1" stopColor="#C62828" />
        </linearGradient>
        <clipPath id="mk-gen-vn-clip">
          <path d={VN_PATH} />
        </clipPath>
      </defs>
      <ContactShadow halfWidth={72} />
      {/* giá đỡ */}
      <line x1={-46} y1={-60} x2={-62} y2={-4} stroke={ink} strokeWidth={14} strokeLinecap="round" />
      <line x1={-46} y1={-60} x2={-62} y2={-4} stroke={PALETTE.wood} strokeWidth={7} strokeLinecap="round" />
      <line x1={46} y1={-60} x2={62} y2={-4} stroke={ink} strokeWidth={14} strokeLinecap="round" />
      <line x1={46} y1={-60} x2={62} y2={-4} stroke={PALETTE.woodDark} strokeWidth={7} strokeLinecap="round" />
      {/* khung bảng */}
      <rect x={-74} y={-296} width={148} height={252} rx={16} fill={PALETTE.wood} stroke={ink} strokeWidth={6} />
      <rect x={-74} y={-296} width={10} height={252} rx={5} fill="#FFFFFF" opacity={0.18} />
      <rect x={-62} y={-284} width={124} height={228} rx={10} fill="url(#mk-gen-vn-sea)" stroke={PALETTE.woodDark} strokeWidth={4} />
      {/* sóng biển */}
      <g transform={`translate(${waveX.toFixed(2)} 0)`} opacity={0.6}>
        <path d="M 24 -230 q 6 -5 12 0 q 6 5 12 0" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
        <path d="M 28 -100 q 6 -5 12 0 q 6 5 12 0" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
        <path d="M -52 -150 q 5 -4 10 0 q 5 4 10 0" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
      </g>
      {/* quần đảo */}
      <circle cx={44} cy={-178} r={3} fill={PALETTE.warn} stroke={ink} strokeWidth={1.5} />
      <circle cx={50} cy={-172} r={2.5} fill={PALETTE.warn} stroke={ink} strokeWidth={1.5} />
      <circle cx={48} cy={-128} r={2.5} fill={PALETTE.warn} stroke={ink} strokeWidth={1.5} />
      <circle cx={54} cy={-120} r={3} fill={PALETTE.warn} stroke={ink} strokeWidth={1.5} />
      {/* dải đất chữ S */}
      <g transform={`translate(0 -168) scale(${(0.95 * breathe).toFixed(4)})`}>
        <path d={VN_PATH} fill="none" stroke={PALETTE.warn} strokeWidth={14} strokeLinejoin="round" opacity={0.15 + 0.45 * blink} />
        <path d={VN_PATH} fill="url(#mk-gen-vn-land)" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        <g clipPath="url(#mk-gen-vn-clip)">
          <ellipse cx={-30} cy={-96} rx={14} ry={22} fill="#FFFFFF" opacity={0.25} />
          <ellipse cx={20} cy={40} rx={14} ry={30} fill="#7F0000" opacity={0.25} />
          <ellipse cx={-16} cy={14} rx={5} ry={18} fill="#FFFFFF" opacity={0.2} />
        </g>
        <path d={VN_PATH} fill="none" stroke="#FFE27A" strokeWidth={2.5} strokeLinejoin="round" opacity={blink} />
        <circle cx={-10} cy={-96} r={4} fill={PALETTE.warn} stroke={ink} strokeWidth={2} />
      </g>
      {/* lấp lánh */}
      <path d="M -44 -262 l 3 7 l 7 3 l -7 3 l -3 7 l -3 -7 l -7 -3 l 7 -3 Z" fill="#FFFFFF" opacity={spark1} />
      <path d="M 40 -74 l 2 5 l 5 2 l -5 2 l -2 5 l -2 -5 l -5 -2 l 5 -2 Z" fill="#FFFFFF" opacity={spark2} />
      {/* bóng đổ khung */}
      <rect x={60} y={-284} width={6} height={228} rx={3} fill={ink} opacity={0.15} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 80,
  height: 300,
  Component: VietnamMapBoard,
};
