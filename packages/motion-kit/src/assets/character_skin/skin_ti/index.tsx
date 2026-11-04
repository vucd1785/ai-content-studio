import { PALETTE } from "../../../palette.js";
import type { SkinSpec } from "../../../rig/skin.js";

const ink = PALETTE.ink;

/** Tí: người que nâng cấp, đầu tròn to, cọng tóc dựng, khăn quàng cam. */
export const skinTi: SkinSpec = {
  characterKey: "ti",
  height: 394,
  bodyHalfWidth: 66,
  hip: { x: 0, y: -132 },
  neck: { x: 0, y: -236 },
  headAnchor: { x: 0, y: -306 },
  headFollowsTilt: true,
  headZone: { kind: "circle", r: 66 },
  shoulderA: { x: -6, y: -226 },
  shoulderB: { x: 6, y: -226 },
  armLen: [56, 50],
  legA: { x: -4, y: -132 },
  legB: { x: 4, y: -132 },
  legLen: [66, 66],
  limbWidth: 13,
  limbColor: ink,
  handRadius: 12,
  faceStyle: { ink, glow: false, alwaysBlush: false, scale: 1.2 },
  torso: () => (
    <>
      <line x1={0} y1={-132} x2={0} y2={-230} stroke={ink} strokeWidth={15} strokeLinecap="round" />
      <path
        d="M 18 -226 q 30 6 44 30 q -16 2 -26 -10 z"
        fill={PALETTE.accent}
        stroke={ink}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <rect
        x={-30}
        y={-242}
        width={60}
        height={20}
        rx={10}
        fill={PALETTE.accent}
        stroke={ink}
        strokeWidth={4}
      />
    </>
  ),
  head: (face) => (
    <>
      <path
        d="M -10 -58 Q -6 -88 12 -84 M 2 -60 Q 8 -80 24 -72"
        fill="none"
        stroke={ink}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <circle cx={0} cy={0} r={62} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={7} />
      {face}
    </>
  ),
  hand: (p) => <circle cx={p.x} cy={p.y} r={12} fill={ink} />,
  foot: (p, side) => <ellipse cx={p.x + side * 10} cy={p.y + 2} rx={17} ry={9} fill={ink} />,
};
