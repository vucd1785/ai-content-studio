import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, lerp, rnd, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;
const ROWS = [0, 1, 2, 3, 4];
const rowY = (i: number): number => -146 + i * 22;

/** Cuốn danh bạ mở: mỗi dòng có nhà nhỏ và biển số nhà, kính lúp lướt dọc các dòng. */
const PhoneBook: FC<PropProps> = ({ frame, seed }) => {
  const stepLen = 30;
  const step = Math.floor(frame / stepLen) % 5;
  const local = (frame % stepLen) / stepLen;
  const move = easing.inOut(Math.min(1, local / 0.45));
  const fromY = rowY(step === 0 ? 4 : step - 1);
  const toY = rowY(step);
  const travel = step === 0 ? easing.inOut(Math.min(1, local / 0.6)) : move;
  const lensY = lerp(fromY, toY, travel) - 2 + 1.5 * Math.sin(frame * 0.2);
  const lensX = 42 + 3 * wobble(frame, seed + 3, 50);
  const settle = local > 0.45 ? 1 : 0.3;
  const flap = 3 * wobble(frame, seed + 11, 70);
  const glint = 0.5 + 0.5 * Math.sin(frame * 0.25);

  const renderRow = (i: number, side: number) => {
    const y = rowY(i);
    const pick = rnd(seed + side * 13, i);
    const roof = pick < 0.33 ? PALETTE.alert : pick < 0.66 ? PALETTE.leaf : PALETTE.accent;
    const x0 = side < 0 ? -72 : 10;
    const lineW = 14 + Math.round(rnd(seed + 5 + side, i) * 10);
    return (
      <g key={`r${side}${i}`}>
        <rect x={x0} y={y - 2} width={10} height={9} fill={PALETTE.paper} stroke={ink} strokeWidth={2} />
        <path d={`M ${x0 - 2} ${y - 1} L ${x0 + 5} ${y - 8} L ${x0 + 12} ${y - 1} Z`} fill={roof} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
        <rect x={x0 + 4} y={y + 2} width={3} height={5} fill={PALETTE.woodDark} />
        <rect x={x0 + 15} y={y - 4} width={14} height={10} rx={3} fill={PALETTE.warn} stroke={ink} strokeWidth={2} />
        <circle cx={x0 + 19} cy={y + 1} r={1.6} fill={ink} />
        <circle cx={x0 + 25} cy={y + 1} r={1.6} fill={ink} />
        <rect x={x0 + 33} y={y - 1} width={lineW} height={4} rx={2} fill={PALETTE.metal} />
      </g>
    );
  };

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-book-page" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFDF4" />
          <stop offset="1" stopColor="#EADFC4" />
        </linearGradient>
        <radialGradient id="mk-gen-book-lens" cx="0.35" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.7} />
          <stop offset="1" stopColor="#BFE6FF" stopOpacity={0.25} />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={84} />
      {/* bìa sau */}
      <rect x={-86} y={-180} width={172} height={160} rx={12} fill="#3E7CC9" stroke={ink} strokeWidth={6} />
      <rect x={-80} y={-174} width={20} height={146} rx={6} fill="#6FA3E0" opacity={0.5} />
      {/* gáy dày: các lớp mép giấy */}
      <rect x={-80} y={-46} width={160} height={20} rx={4} fill={PALETTE.paper} stroke={ink} strokeWidth={4} />
      <line x1={-76} y1={-40} x2={76} y2={-40} stroke={PALETTE.metal} strokeWidth={2} />
      <line x1={-76} y1={-34} x2={76} y2={-34} stroke={PALETTE.metal} strokeWidth={2} />
      <line x1={-76} y1={-29} x2={76} y2={-29} stroke={PALETTE.metal} strokeWidth={2} opacity={0.6} />
      {/* trang trái */}
      <path d={`M -2 -166 Q -40 ${-176 + flap} -78 -168 L -78 -50 Q -40 -58 -2 -48 Z`} fill="url(#mk-gen-book-page)" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
      {/* trang phải */}
      <path d="M 2 -166 Q 40 -176 78 -168 L 78 -50 Q 40 -58 2 -48 Z" fill="url(#mk-gen-book-page)" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
      {/* bóng gáy giữa */}
      <rect x={-10} y={-166} width={20} height={118} fill={PALETTE.woodDark} opacity={0.15} />
      <line x1={0} y1={-166} x2={0} y2={-48} stroke={ink} strokeWidth={4} />
      {/* dòng đang đọc phát sáng */}
      <rect x={8} y={lensY - 9} width={66} height={18} rx={5} fill={PALETTE.warn} opacity={0.3 * settle} />
      {ROWS.map((i) => renderRow(i, -1))}
      {ROWS.map((i) => renderRow(i, 1))}
      {/* kính lúp */}
      <g transform={`translate(${lensX.toFixed(2)} ${lensY.toFixed(2)})`}>
        <line x1={13} y1={13} x2={34} y2={34} stroke={ink} strokeWidth={12} strokeLinecap="round" />
        <line x1={14} y1={14} x2={33} y2={33} stroke={PALETTE.wood} strokeWidth={6} strokeLinecap="round" />
        <circle cx={0} cy={0} r={19} fill="url(#mk-gen-book-lens)" stroke={PALETTE.metalDark} strokeWidth={6} />
        <circle cx={0} cy={0} r={19} fill="none" stroke={ink} strokeWidth={2.5} />
        <path d="M -11 -5 Q -9 -11 -3 -13" fill="none" stroke="#FFFFFF" strokeWidth={3.5} strokeLinecap="round" opacity={0.6 + 0.4 * glint} />
        <circle cx={-14} cy={-17} r={2.5 + 1.5 * glint} fill="#FFFFFF" opacity={glint} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 186,
  Component: PhoneBook,
};
