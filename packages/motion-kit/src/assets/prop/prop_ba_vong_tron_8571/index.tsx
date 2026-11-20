import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { clamp, easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

const PX = 0;
const PY = -160;

const CIRCLES = [
  { cx: -40, cy: -195, r: 53, color: "#ff6b6b", start: 0 },
  { cx: 36, cy: -204, r: 57, color: "#7ee081", start: 26 },
  { cx: -6, cy: -120, r: 40, color: "#6cb8ff", start: 52 },
];

const CYCLE = 160;

/** Bảng phấn trên giá: ba vòng tròn phấn lần lượt lớn dần, giao nhau tại một điểm, điểm đó lóe sáng thành ghim định vị. */
const BaVongTron: FC<PropProps> = ({ frame, seed }) => {
  const f = ((frame % CYCLE) + CYCLE) % CYCLE;
  const fadeOut = 1 - clamp((f - 145) / 15, 0, 1);
  const flashP = clamp((f - 82) / 14, 0, 1);
  const flash = Math.sin(flashP * Math.PI);
  const pinP = clamp((f - 88) / 16, 0, 1);
  const pinS = pinP > 0 ? easing.outBack(2)(pinP) : 0;
  const bob = f > 104 ? Math.sin((f - 104) * 0.18) * 2.5 : 0;
  const sway = wobble(frame, seed, 90) * 0.8;
  const pulse = 0.5 + 0.5 * wobble(frame, seed + 3, 24);

  return (
    <g>
      <ContactShadow halfWidth={78} />
      <defs>
        <linearGradient id="mk-gen-chalkboard-8571" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3f6b55" />
          <stop offset="1" stopColor="#24402f" />
        </linearGradient>
        <radialGradient id="mk-gen-pinglow-8571" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff6c2" stopOpacity="1" />
          <stop offset="1" stopColor="#fff6c2" stopOpacity="0" />
        </radialGradient>
        <clipPath id="mk-gen-boardclip-8571">
          <rect x={-70} y={-266} width={140} height={152} rx={6} />
        </clipPath>
      </defs>

      {/* back leg */}
      <line x1={0} y1={-120} x2={0} y2={-4} stroke={PALETTE.woodDark} strokeWidth={8} strokeLinecap="round" />
      {/* front legs */}
      <line x1={-52} y1={-110} x2={-66} y2={-4} stroke={ink} strokeWidth={13} strokeLinecap="round" />
      <line x1={-52} y1={-110} x2={-66} y2={-4} stroke={PALETTE.wood} strokeWidth={7} strokeLinecap="round" />
      <line x1={52} y1={-110} x2={66} y2={-4} stroke={ink} strokeWidth={13} strokeLinecap="round" />
      <line x1={52} y1={-110} x2={66} y2={-4} stroke={PALETTE.wood} strokeWidth={7} strokeLinecap="round" />

      <g transform={`rotate(${sway.toFixed(2)} 0 -100)`}>
        {/* frame */}
        <rect x={-80} y={-276} width={160} height={172} rx={12} fill={PALETTE.wood} stroke={ink} strokeWidth={6} />
        <rect x={-74} y={-272} width={60} height={6} rx={3} fill="#ffffff" opacity={0.3} />
        {/* board */}
        <rect x={-70} y={-266} width={140} height={152} rx={6} fill="url(#mk-gen-chalkboard-8571)" stroke={PALETTE.woodDark} strokeWidth={4} />
        <path d="M -62 -258 L -20 -258 L -62 -216 Z" fill="#ffffff" opacity={0.1} />
        <rect x={-70} y={-130} width={140} height={16} fill="#000000" opacity={0.15} />
        {/* chalk smudges */}
        <ellipse cx={42} cy={-130} rx={18} ry={5} fill="#ffffff" opacity={0.08} />
        <ellipse cx={-48} cy={-238} rx={14} ry={4} fill="#ffffff" opacity={0.07} />

        <g clipPath="url(#mk-gen-boardclip-8571)" opacity={fadeOut}>
          {CIRCLES.map((c, i) => {
            const p = clamp((f - c.start) / 30, 0, 1);
            if (p <= 0) return null;
            const r = c.r * easing.outBack(1.3)(p);
            return (
              <g key={i}>
                <circle cx={c.cx} cy={c.cy} r={r} fill="none" stroke={c.color} strokeWidth={9} opacity={0.18} />
                <circle cx={c.cx} cy={c.cy} r={r} fill="none" stroke={c.color} strokeWidth={4.5} strokeLinecap="round" strokeDasharray="14 3 22 2" opacity={0.92} />
                <circle cx={c.cx} cy={c.cy} r={3.5} fill={c.color} />
              </g>
            );
          })}
          {/* flash at intersection */}
          {flash > 0 ? (
            <g>
              <circle cx={PX} cy={PY} r={8 + 30 * flashP} fill="url(#mk-gen-pinglow-8571)" opacity={flash} />
              {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
                const a = (k * Math.PI) / 4;
                const r1 = 8 + 10 * flashP;
                const r2 = 14 + 22 * flashP;
                return (
                  <line
                    key={k}
                    x1={PX + Math.cos(a) * r1}
                    y1={PY + Math.sin(a) * r1}
                    x2={PX + Math.cos(a) * r2}
                    y2={PY + Math.sin(a) * r2}
                    stroke="#fff6c2"
                    strokeWidth={3}
                    strokeLinecap="round"
                    opacity={flash}
                  />
                );
              })}
            </g>
          ) : null}
        </g>

        {/* location pin */}
        {pinS > 0 ? (
          <g opacity={fadeOut}>
            <circle cx={PX} cy={PY - 2} r={14} fill="url(#mk-gen-pinglow-8571)" opacity={0.4 + 0.4 * pulse} />
            <ellipse cx={PX} cy={PY} rx={7} ry={2.5} fill="#000000" opacity={0.3} />
            <g transform={`translate(${PX} ${(PY + bob).toFixed(2)}) scale(${(pinS * 0.85).toFixed(3)})`}>
              <path
                d="M 0 0 C -5 -10 -13 -17 -13 -27 A 13 13 0 1 1 13 -27 C 13 -17 5 -10 0 0 Z"
                fill={PALETTE.alert}
                stroke={ink}
                strokeWidth={5}
                strokeLinejoin="round"
              />
              <path d="M 8 -34 A 10 10 0 0 1 9 -18 L 4 -12 Z" fill="#000000" opacity={0.18} />
              <circle cx={0} cy={-27} r={5.5} fill={PALETTE.paper} stroke={ink} strokeWidth={3} />
              <ellipse cx={-6} cy={-34} rx={3} ry={4.5} fill="#ffffff" opacity={0.55} />
            </g>
          </g>
        ) : null}

        {/* chalk tray */}
        <rect x={-76} y={-112} width={152} height={12} rx={5} fill={PALETTE.woodDark} stroke={ink} strokeWidth={5} />
        <rect x={-50} y={-120} width={22} height={7} rx={3} fill={PALETTE.paper} stroke={ink} strokeWidth={2.5} />
        <rect x={20} y={-120} width={16} height={7} rx={3} fill="#ff6b6b" stroke={ink} strokeWidth={2.5} />
        <rect x={40} y={-120} width={14} height={7} rx={3} fill="#6cb8ff" stroke={ink} strokeWidth={2.5} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 86,
  height: 284,
  Component: BaVongTron,
};
