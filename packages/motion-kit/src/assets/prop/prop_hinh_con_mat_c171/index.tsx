import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const RAY = "#FFD23F";
const RAY_LIGHT = "#FFF3B0";
const PINK = "#F28BA8";
const PINK_DARK = "#C9587A";
const CORNEA = "#BFE8FF";
const IRIS = "#3A8FD6";

/** Mô hình mắt nhìn nghiêng: tia sáng vàng đi qua giác mạc, hội tụ thành điểm sáng ở đáy mắt, điểm sáng nhấp nháy. */
const EyeFocus: FC<PropProps> = ({ frame, seed }) => {
  const cyc = (frame % 40) / 40;
  const tri = cyc < 0.5 ? cyc * 2 : 2 - cyc * 2;
  const pulse = easing.inOut(tri);
  const sway = 1.5 * wobble(frame, seed, 90);
  const dashOff = (-frame * 1.6).toFixed(2);
  const sparkS = 0.75 + 0.45 * pulse;
  const fx = 66;
  const fy = -130;
  const rays: Array<[number, number, number]> = [
    [-82, -152, -57],
    [-82, -130, -61],
    [-82, -108, -57],
  ];
  return (
    <g>
      <defs>
        <radialGradient id="mk-gen-eye-sclera" cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.7" stopColor="#FCEFF1" />
          <stop offset="1" stopColor="#F3C9D3" />
        </radialGradient>
        <radialGradient id="mk-gen-eye-spark" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
          <stop offset="0.4" stopColor={RAY} stopOpacity={0.9} />
          <stop offset="1" stopColor={RAY} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={56} />
      {/* giá đỡ */}
      <rect x={-44} y={-16} width={88} height={16} rx={8} fill={PALETTE.metalDark} stroke={ink} strokeWidth={5} />
      <rect x={-36} y={-14} width={40} height={4} rx={2} fill="#FFFFFF" opacity={0.3} />
      <rect x={-7} y={-74} width={14} height={60} rx={5} fill={PALETTE.metalDark} stroke={ink} strokeWidth={5} />
      <g transform={`rotate(${sway.toFixed(2)} 0 -74)`}>
        {/* dây thần kinh thị giác */}
        <path d="M 60 -146 Q 80 -142 84 -124 Q 84 -112 74 -110 Q 64 -112 60 -116 Z" fill={PINK} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
        {/* lòng trắng */}
        <circle cx={6} cy={-130} r={60} fill="url(#mk-gen-eye-sclera)" stroke={ink} strokeWidth={6} />
        {/* bóng phía phải dưới */}
        <path d="M 52 -168 A 60 60 0 0 1 -10 -72 A 54 54 0 0 0 52 -168 Z" fill={PINK_DARK} opacity={0.18} />
        {/* mạch máu */}
        <path d="M 40 -172 q -8 10 -2 18 M 46 -92 q -10 -4 -14 4" stroke={PINK} strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.8} />
        {/* võng mạc */}
        <path d="M 40 -175 A 56 56 0 0 1 40 -85" stroke={PINK} strokeWidth={8} fill="none" strokeLinecap="round" />
        <path d="M 40 -175 A 56 56 0 0 1 40 -85" stroke={PINK_DARK} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.6} />
        {/* mống mắt */}
        <rect x={-46} y={-172} width={9} height={30} rx={4} fill={IRIS} stroke={ink} strokeWidth={4} />
        <rect x={-46} y={-118} width={9} height={30} rx={4} fill={IRIS} stroke={ink} strokeWidth={4} />
        {/* thủy tinh thể */}
        <ellipse cx={-30} cy={-130} rx={11} ry={24} fill={CORNEA} stroke={ink} strokeWidth={4} />
        <ellipse cx={-33} cy={-138} rx={3} ry={9} fill="#FFFFFF" opacity={0.8} />
        {/* tia sáng */}
        {rays.map(([x0, y0, xc], i) => {
          const d = `M ${x0} ${y0} L ${xc} ${y0} L -30 ${y0 + (fy - y0) * 0.35} L ${fx} ${fy}`;
          return (
            <g key={i}>
              <path d={d} stroke={ink} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d={d} stroke={RAY} strokeWidth={4.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path
                d={d}
                stroke={RAY_LIGHT}
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                strokeDasharray="8 14"
                strokeDashoffset={dashOff}
              />
            </g>
          );
        })}
        {/* giác mạc cong */}
        <path d="M -38 -177 Q -80 -130 -38 -83" fill={CORNEA} opacity={0.4} />
        <path d="M -38 -177 Q -80 -130 -38 -83" fill="none" stroke={ink} strokeWidth={5} strokeLinecap="round" />
        <path d="M -46 -160 Q -60 -144 -58 -128" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.85} />
        {/* điểm sáng hội tụ */}
        <circle cx={fx} cy={fy} r={18 * sparkS} fill="url(#mk-gen-eye-spark)" opacity={0.5 + 0.5 * pulse} />
        <g transform={`translate(${fx} ${fy}) scale(${sparkS.toFixed(3)})`}>
          <path d="M 0 -11 L 3 -3 L 11 0 L 3 3 L 0 11 L -3 3 L -11 0 L -3 -3 Z" fill={RAY} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />
          <circle cx={0} cy={0} r={2.5} fill="#FFFFFF" />
        </g>
        {/* điểm sáng phản chiếu trên trái */}
        <ellipse cx={-6} cy={-170} rx={16} ry={7} fill="#FFFFFF" opacity={0.7} transform="rotate(-25 -6 -170)" />
        <circle cx={14} cy={-178} r={3.5} fill="#FFFFFF" opacity={0.8} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 200,
  Component: EyeFocus,
};
