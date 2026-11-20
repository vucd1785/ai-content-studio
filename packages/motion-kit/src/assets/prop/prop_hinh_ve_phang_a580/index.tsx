import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

const RIVER = "M -30 -64 C 10 -58, -40 -46, 0 -38 S 40 -28, 20 -18 L 20 -6";

const LEAF_ANGLES = [-165, -125, -80, -40, -5, 35, 150];

/** Mảnh sa mạc với sông Nile uốn lượn, kim tự tháp và cây cọ; nước lấp lánh, lá cọ đung đưa. */
const NileDesert: FC<PropProps> = ({ frame, seed }) => {
  const raw = 0.5 + 0.5 * wobble(frame, seed, 80);
  const sway = (easing.inOut(raw) - 0.5) * 10;
  const lag = (easing.inOut(0.5 + 0.5 * wobble(frame + 6, seed, 80)) - 0.5) * 6;
  const flow = (-frame * 0.8).toFixed(2);
  const sparkles = [
    { x: -14, y: -57, p: 0 },
    { x: 4, y: -40, p: 2.1 },
    { x: 26, y: -27, p: 4.2 },
  ];
  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-nile-sand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FBE3A0" />
          <stop offset="1" stopColor="#E8B95A" />
        </linearGradient>
        <linearGradient id="mk-gen-nile-water" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6FD0F2" />
          <stop offset="1" stopColor="#2F86C8" />
        </linearGradient>
      </defs>
      <ContactShadow halfWidth={86} />
      {/* thân khối cát */}
      <path
        d="M -84 -42 L -84 -20 A 84 18 0 0 0 84 -20 L 84 -42 Z"
        fill="#D49A3C"
        stroke={ink}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <ellipse cx={0} cy={-42} rx={84} ry={26} fill="url(#mk-gen-nile-sand)" stroke={ink} strokeWidth={6} />
      <ellipse cx={-30} cy={-52} rx={40} ry={9} fill="#FFFFFF" opacity={0.25} />
      <path d="M -70 -36 Q -60 -40 -50 -36" fill="none" stroke="#C98F2E" strokeWidth={3} strokeLinecap="round" />
      <path d="M 44 -26 Q 54 -30 64 -26" fill="none" stroke="#C98F2E" strokeWidth={3} strokeLinecap="round" />
      <path d="M -40 -24 Q -30 -28 -20 -24" fill="none" stroke="#C98F2E" strokeWidth={3} strokeLinecap="round" />
      {/* dòng sông */}
      <path d={RIVER} fill="none" stroke={ink} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" />
      <path d={RIVER} fill="none" stroke="url(#mk-gen-nile-water)" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d={RIVER}
        fill="none"
        stroke="#D8F4FF"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray="6 14"
        strokeDashoffset={flow}
        opacity={0.85}
      />
      <path d="M 14 -16 L 14 -8" stroke="#1F5E96" strokeWidth={3} strokeLinecap="round" opacity={0.5} />
      {sparkles.map((s, i) => {
        const k = Math.max(0, Math.sin(frame * 0.12 + s.p + seed));
        const r = 2 + 5 * easing.out(k);
        return (
          <path
            key={i}
            d={`M ${s.x} ${s.y - r} Q ${s.x} ${s.y} ${s.x + r} ${s.y} Q ${s.x} ${s.y} ${s.x} ${s.y + r} Q ${s.x} ${s.y} ${s.x - r} ${s.y} Q ${s.x} ${s.y} ${s.x} ${s.y - r} Z`}
            fill="#FFFFFF"
            opacity={0.3 + 0.7 * k}
          />
        );
      })}
      {/* kim tự tháp */}
      <polygon points="30,-50 52,-118 56,-44" fill="#F6D88A" />
      <polygon points="56,-44 52,-118 76,-52" fill="#C68A2C" />
      <path d="M 40 -80 L 54 -78 M 35 -64 L 55 -61 M 55 -78 L 66 -82 M 55 -61 L 71 -66" stroke="#A8721F" strokeWidth={2.5} strokeLinecap="round" opacity={0.7} />
      <polygon
        points="30,-50 52,-118 76,-52 56,-44"
        fill="none"
        stroke={ink}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <path d="M 52 -118 L 56 -44" stroke={ink} strokeWidth={3} />
      <path d="M 36 -56 L 50 -104" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.45} />
      {/* cây cọ */}
      <ellipse cx={-58} cy={-40} rx={14} ry={4} fill={ink} opacity={0.18} />
      <g transform={`rotate(${(sway * 0.3).toFixed(2)} -58 -40)`}>
        <path d="M -58 -40 Q -64 -100 -50 -150" fill="none" stroke={ink} strokeWidth={15} strokeLinecap="round" />
        <path d="M -58 -40 Q -64 -100 -50 -150" fill="none" stroke={PALETTE.wood} strokeWidth={9} strokeLinecap="round" />
        <path d="M -66 -60 L -55 -62 M -66 -84 L -56 -85 M -64 -108 L -54 -108 M -60 -130 L -50 -129" stroke={PALETTE.woodDark} strokeWidth={2.5} strokeLinecap="round" />
        <g transform={`rotate(${sway.toFixed(2)} -50 -150)`}>
          {LEAF_ANGLES.map((a, i) => (
            <g key={i} transform={`translate(-50 -150) rotate(${(a + (i % 2 === 0 ? lag : -lag)).toFixed(2)})`}>
              <path d="M 0 0 Q 16 -13 34 -2 Q 18 -1 0 0 Z" fill={PALETTE.leaf} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
              <path d="M 4 -2 Q 16 -7 28 -3" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.4} />
            </g>
          ))}
          <circle cx={-55} cy={-145} r={5} fill={PALETTE.woodDark} stroke={ink} strokeWidth={3} />
          <circle cx={-45} cy={-144} r={5} fill={PALETTE.woodDark} stroke={ink} strokeWidth={3} />
          <circle cx={-57} cy={-147} r={1.6} fill="#FFFFFF" opacity={0.6} />
        </g>
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 190,
  Component: NileDesert,
};
