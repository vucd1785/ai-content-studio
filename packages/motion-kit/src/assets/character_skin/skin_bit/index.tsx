import { PALETTE } from "../../../palette.js";
import type { SkinSpec } from "../../../rig/skin.js";

const o = PALETTE.outline;

/** Bit: robot linh vật, thân kem, mặt là màn hình phát sáng, ăng-ten bóng cam. */
export const skinBit: SkinSpec = {
  characterKey: "bit",
  height: 345,
  bodyHalfWidth: 92,
  hip: { x: 0, y: -64 },
  neck: { x: 0, y: -160 },
  headAnchor: { x: 0, y: -236 },
  headFollowsTilt: true,
  headZone: { kind: "rect", halfWidth: 84, halfHeight: 67 },
  shoulderA: { x: -60, y: -136 },
  shoulderB: { x: 60, y: -136 },
  armLen: [38, 34],
  legA: { x: -26, y: -64 },
  legB: { x: 26, y: -64 },
  legLen: [30, 28],
  limbWidth: 12,
  limbColor: PALETTE.bitJoint,
  handRadius: 15,
  faceStyle: { ink: PALETTE.screen, glow: true, alwaysBlush: false, scale: 1.15 },
  torso: () => (
    <>
      <rect
        x={-56}
        y={-158}
        width={112}
        height={100}
        rx={24}
        fill={PALETTE.bitShell}
        stroke={o}
        strokeWidth={5}
      />
      <circle cx={0} cy={-108} r={12} fill={PALETTE.bitLight} stroke={o} strokeWidth={4} />
      <path
        d="M -3 -116 L 3 -110 L -2 -108 L 3 -100"
        fill="none"
        stroke="#fff"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </>
  ),
  head: (face) => (
    <>
      <line
        x1={0}
        y1={-62}
        x2={0}
        y2={-92}
        stroke={PALETTE.bitJoint}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <circle cx={0} cy={-98} r={11} fill={PALETTE.bitLight} stroke={o} strokeWidth={4} />
      <circle cx={-82} cy={0} r={10} fill={PALETTE.bitJoint} stroke={o} strokeWidth={3} />
      <circle cx={82} cy={0} r={10} fill={PALETTE.bitJoint} stroke={o} strokeWidth={3} />
      <rect
        x={-80}
        y={-64}
        width={160}
        height={128}
        rx={32}
        fill={PALETTE.bitShell}
        stroke={o}
        strokeWidth={5}
      />
      <rect x={-64} y={-48} width={128} height={96} rx={20} fill={PALETTE.bitScreen} />
      {face}
    </>
  ),
  hand: (p) => (
    <circle cx={p.x} cy={p.y} r={13} fill={PALETTE.bitShell} stroke={o} strokeWidth={4} />
  ),
  foot: (p, side) => (
    <rect
      x={p.x - 18 + side * 4}
      y={p.y - 6}
      width={36}
      height={16}
      rx={8}
      fill={PALETTE.bitShell}
      stroke={o}
      strokeWidth={4}
    />
  ),
};
