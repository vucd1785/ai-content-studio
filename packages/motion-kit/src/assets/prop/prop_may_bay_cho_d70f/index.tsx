import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";

const ink = PALETTE.ink;
const blue = "#3D8BE0";
const blueDark = "#2A63A8";
const blueLight = "#8FC3F5";

/** Máy bay chở khách bay ngang trên trời: thân trắng, cánh xanh, nhấp nhô và nghiêng cánh nhẹ. */
const PassengerPlane: FC<PropProps> = ({ frame, seed }) => {
  const cycle = (frame % 96) / 96;
  const tri = cycle < 0.5 ? cycle * 2 : 2 - cycle * 2;
  const bank = (easing.inOut(tri) - 0.5) * 7;
  const bob = 4 * Math.sin((frame / 96) * Math.PI * 2 + 1.2) + 1.2 * wobble(frame, seed, 60);
  const flex = (easing.inOut(tri) - 0.5) * 4;
  const blink = frame % 40 < 6 ? 1 : 0.25;
  const speed = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(frame * 0.3));
  return (
    <g transform={`translate(0 ${bob.toFixed(2)}) rotate(${bank.toFixed(2)} 0 -150)`}>
      <defs>
        <linearGradient id="mk-gen-plane-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.6" stopColor="#EEF3F8" />
          <stop offset="1" stopColor="#C9D4E0" />
        </linearGradient>
        <linearGradient id="mk-gen-plane-wing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={blueLight} />
          <stop offset="1" stopColor={blue} />
        </linearGradient>
      </defs>
      {/* speed lines */}
      <line x1={-88} y1={-142} x2={-76} y2={-142} stroke={blueLight} strokeWidth={4} strokeLinecap="round" opacity={speed} />
      <line x1={-86} y1={-128} x2={-66} y2={-128} stroke={blueLight} strokeWidth={4} strokeLinecap="round" opacity={speed * 0.8} />
      {/* far wing */}
      <path
        d={`M 8 -160 L ${-14 - flex} ${-180 + flex} L ${-2 - flex} ${-180 + flex} L 26 -162 Z`}
        fill={blueDark}
        stroke={ink}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      {/* tail fin */}
      <path
        d="M -56 -162 L -78 -206 L -64 -206 L -32 -164 Z"
        fill="url(#mk-gen-plane-wing)"
        stroke={ink}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <path d="M -70 -200 L -62 -200 L -48 -178" stroke="#FFFFFF" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.6} />
      {/* fuselage */}
      <path
        d="M -80 -164 L 56 -166 C 76 -166 84 -156 84 -148 C 84 -140 76 -134 62 -134 L -48 -134 C -64 -136 -74 -150 -80 -164 Z"
        fill="url(#mk-gen-plane-body)"
        stroke={ink}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* belly shade */}
      <path d="M -60 -140 L 66 -140 C 74 -140 78 -138 80 -140 C 76 -136 70 -135 62 -135 L -48 -135 Z" fill={PALETTE.metalDark} opacity={0.25} />
      {/* top highlight */}
      <path d="M -60 -161 L 54 -162 C 64 -162 70 -160 74 -157" stroke="#FFFFFF" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.9} />
      {/* blue cheat line */}
      <path d="M -66 -146 L 82 -146" stroke={blue} strokeWidth={4} strokeLinecap="round" />
      {/* windows */}
      {[-40, -29, -18, -7, 4, 15, 26, 37, 48].map((x) => (
        <circle key={x} cx={x} cy={-154} r={3.4} fill={PALETTE.screen} stroke={ink} strokeWidth={1.5} />
      ))}
      {/* cockpit */}
      <path d="M 66 -160 C 74 -160 79 -156 80 -152 L 68 -152 Z" fill={blueDark} stroke={ink} strokeWidth={3} strokeLinejoin="round" />
      <path d="M 69 -158 L 73 -158" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.8} />
      {/* door */}
      <rect x={55} y={-162} width={7} height={13} rx={3} fill="none" stroke={PALETTE.metalDark} strokeWidth={2} />
      {/* horizontal stabilizer */}
      <path d="M -54 -152 L -76 -142 L -66 -140 L -44 -150 Z" fill={blue} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
      {/* near wing */}
      <path
        d={`M 22 -144 L ${-20 + flex} ${-110 - flex} L ${-4 + flex} ${-110 - flex} L 40 -144 Z`}
        fill="url(#mk-gen-plane-wing)"
        stroke={ink}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <path d={`M 26 -142 L ${-10 + flex} ${-114 - flex}`} stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.55} />
      {/* engine */}
      <rect x={10} y={-138} width={26} height={13} rx={6.5} fill={PALETTE.metal} stroke={ink} strokeWidth={4} />
      <ellipse cx={34} cy={-131.5} rx={3} ry={5} fill={PALETTE.metalDark} />
      <rect x={14} y={-136} width={14} height={3} rx={1.5} fill="#FFFFFF" opacity={0.6} />
      {/* wingtip light */}
      <circle cx={-12 + flex} cy={-110 - flex} r={7} fill={PALETTE.alert} opacity={0.3 * blink} />
      <circle cx={-12 + flex} cy={-110 - flex} r={3} fill={PALETTE.alert} opacity={blink} />
      {/* tail light */}
      <circle cx={-76} cy={-206} r={3} fill={PALETTE.ok} opacity={1.25 - blink} />
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 220,
  Component: PassengerPlane,
};
