import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

/** Khung ảnh phong cảnh trên giá vẽ và cuộn phim nhỏ: tượng trưng cho AI tạo ảnh, tạo video. */
const PhotoFrameFilm: FC<PropProps> = ({ frame, seed }) => {
  const sway = wobble(frame, seed, 90);
  const tilt = 3 * sway;
  const reelAngle = (frame * 1.2) % 360;
  const glow = 0.5 + 0.5 * wobble(frame, seed + 3, 40);
  const sp = (frame % 60) / 60;
  const sparkScale = 0.4 + 0.6 * easing.inOut(sp < 0.5 ? sp * 2 : (1 - sp) * 2);
  const cloudX = 4 * wobble(frame, seed + 11, 120);
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-sky-frame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7cc8f2" />
          <stop offset="1" stopColor="#d4f0ff" />
        </linearGradient>
        <radialGradient id="mk-gen-reel-shine" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#e6edf3" />
          <stop offset="1" stopColor={PALETTE.metal} />
        </radialGradient>
        <clipPath id="mk-gen-pic-clip">
          <rect x={-57} y={-170} width={90} height={70} rx={4} />
        </clipPath>
      </defs>
      <ContactShadow halfWidth={80} />

      {/* Giá vẽ + khung ảnh, khẽ lắc quanh chân */}
      <g transform={`rotate(${tilt.toFixed(2)} -12 0)`}>
        <line x1={-12} y1={-100} x2={-12} y2={-4} stroke={PALETTE.woodDark} strokeWidth={7} strokeLinecap="round" />
        <line x1={-12} y1={-100} x2={-50} y2={-3} stroke={ink} strokeWidth={10} strokeLinecap="round" />
        <line x1={-12} y1={-100} x2={-50} y2={-3} stroke={PALETTE.wood} strokeWidth={5} strokeLinecap="round" />
        <line x1={-12} y1={-100} x2={26} y2={-3} stroke={ink} strokeWidth={10} strokeLinecap="round" />
        <line x1={-12} y1={-100} x2={26} y2={-3} stroke={PALETTE.wood} strokeWidth={5} strokeLinecap="round" />
        <rect x={-42} y={-92} width={60} height={9} rx={4} fill={PALETTE.woodDark} stroke={ink} strokeWidth={4} />

        {/* Khung gỗ */}
        <rect x={-67} y={-180} width={110} height={90} rx={9} fill={PALETTE.wood} stroke={ink} strokeWidth={6} />
        <rect x={-63} y={-176} width={102} height={10} rx={4} fill="#ffffff" opacity={0.28} />
        <rect x={-63} y={-176} width={8} height={80} rx={4} fill="#ffffff" opacity={0.2} />
        <rect x={31} y={-176} width={8} height={82} rx={4} fill={PALETTE.woodDark} opacity={0.35} />

        {/* Tranh phong cảnh */}
        <g clipPath="url(#mk-gen-pic-clip)">
          <rect x={-57} y={-170} width={90} height={70} fill="url(#mk-gen-sky-frame)" />
          <circle cx={16} cy={-153} r={14} fill={PALETTE.warn} opacity={0.3 * glow} />
          <circle cx={16} cy={-153} r={8} fill={PALETTE.warn} stroke={ink} strokeWidth={2.5} />
          <g transform={`translate(${cloudX.toFixed(2)} 0)`}>
            <ellipse cx={-34} cy={-155} rx={11} ry={5} fill="#ffffff" />
            <circle cx={-36} cy={-158} r={5} fill="#ffffff" />
          </g>
          <path d="M-57 -100 L-36 -140 L-22 -122 L-4 -148 L33 -104 L33 -100 Z" fill="#8a9bb8" stroke={ink} strokeWidth={3} strokeLinejoin="round" />
          <path d="M-36 -140 L-30 -129 L-36 -131 L-41 -130 Z" fill="#ffffff" />
          <path d="M-4 -148 L4 -138 L-3 -140 L-10 -138 Z" fill="#ffffff" />
          <ellipse cx={-30} cy={-98} rx={44} ry={14} fill={PALETTE.leaf} stroke={ink} strokeWidth={3} />
          <ellipse cx={22} cy={-98} rx={30} ry={10} fill="#4f9a45" stroke={ink} strokeWidth={3} />
        </g>
        <rect x={-57} y={-170} width={90} height={70} rx={4} fill="none" stroke={ink} strokeWidth={4} />
      </g>

      {/* Dải phim trải trên đất */}
      <rect x={-22} y={-14} width={74} height={12} rx={2} fill="#3a3f4b" stroke={ink} strokeWidth={4} />
      {[-16, -4, 8, 20, 32].map((x) => (
        <rect key={x} x={x} y={-11} width={7} height={6} rx={1} fill="#c9e4ff" opacity={0.85} />
      ))}

      {/* Cuộn phim xoay chậm */}
      <g transform={`translate(52 -34) rotate(${reelAngle.toFixed(2)})`}>
        <circle cx={0} cy={0} r={28} fill="url(#mk-gen-reel-shine)" stroke={ink} strokeWidth={6} />
        {[0, 72, 144, 216, 288].map((a) => {
          const r = (a * Math.PI) / 180;
          return <circle key={a} cx={15 * Math.cos(r)} cy={15 * Math.sin(r)} r={6} fill={PALETTE.metalDark} stroke={ink} strokeWidth={2.5} />;
        })}
        <circle cx={0} cy={0} r={5} fill={PALETTE.accent} stroke={ink} strokeWidth={2.5} />
      </g>
      <path d="M33 -48 A22 22 0 0 1 46 -57" fill="none" stroke="#ffffff" strokeWidth={4} strokeLinecap="round" opacity={0.6} />

      {/* Lấp lánh */}
      <g transform={`translate(58 -150) scale(${sparkScale.toFixed(3)})`}>
        <path d="M0 -14 L4 -4 L14 0 L4 4 L0 14 L-4 4 L-14 0 L-4 -4 Z" fill={PALETTE.warn} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />
      </g>
      <circle cx={70} cy={-120} r={3.5} fill={PALETTE.warn} opacity={1 - sparkScale * 0.6} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 85,
  height: 190,
  Component: PhotoFrameFilm,
};
