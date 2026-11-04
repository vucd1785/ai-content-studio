import { PALETTE } from "../../../palette.js";
import type { SkinSpec } from "../../../rig/skin.js";

const ink = PALETTE.dauInk;

/** Đậu: hạt đậu tròn, mầm lá trên đầu, má hồng. Không thoại; thân co giãn theo `squash`. */
export const skinDau: SkinSpec = {
  characterKey: "dau",
  height: 281,
  bodyHalfWidth: 84,
  hip: { x: 0, y: -46 },
  neck: { x: 0, y: -150 },
  headAnchor: { x: 0, y: -168 },
  headFollowsTilt: false,
  headZone: { kind: "circle", r: 52 },
  shoulderA: { x: -72, y: -128 },
  shoulderB: { x: 72, y: -128 },
  armLen: [34, 30],
  legA: { x: -30, y: -46 },
  legB: { x: 30, y: -46 },
  legLen: [22, 22],
  limbWidth: 13,
  limbColor: ink,
  handRadius: 15,
  faceStyle: { ink, glow: false, alwaysBlush: true, scale: 1.4 },
  torso: () => (
    <>
      <path d="M 0 -236 L 0 -262" stroke={PALETTE.dauStem} strokeWidth={6} strokeLinecap="round" />
      <ellipse
        cx={-14}
        cy={-266}
        rx={16}
        ry={8}
        transform="rotate(-25 -14 -266)"
        fill={PALETTE.leaf}
        stroke={ink}
        strokeWidth={4}
      />
      <ellipse
        cx={15}
        cy={-272}
        rx={18}
        ry={9}
        transform="rotate(20 15 -272)"
        fill={PALETTE.leaf}
        stroke={ink}
        strokeWidth={4}
      />
      <ellipse
        cx={0}
        cy={-136}
        rx={80}
        ry={100}
        fill={PALETTE.dauBody}
        stroke={ink}
        strokeWidth={7}
      />
      <ellipse cx={0} cy={-92} rx={46} ry={38} fill={PALETTE.dauBelly} opacity={0.9} />
    </>
  ),
  head: (face) => face,
  hand: (p) => (
    <circle cx={p.x} cy={p.y} r={13} fill={PALETTE.dauBody} stroke={ink} strokeWidth={4} />
  ),
  foot: (p, side) => <ellipse cx={p.x + side * 6} cy={p.y + 2} rx={18} ry={10} fill={ink} />,
};
