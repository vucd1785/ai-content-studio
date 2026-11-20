import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, lerp, clamp, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

const gesture = (frame: number, phase: number, period: number): number => {
  const p = (((frame + phase) % period) + period) % period / period;
  const tri = p < 0.5 ? p * 2 : 2 - p * 2;
  return easing.inOut(tri);
};

type PersonProps = {
  x: number;
  dir: number;
  e: number;
  bob: number;
  shirt: string;
};

/** Người que ngồi ghế, nhìn về phía bàn, một tay khoa lên. */
const SidePerson: FC<PersonProps> = ({ x, dir, e, bob, shirt }) => {
  const hipY = -58;
  const shY = -92 + bob * 0.5;
  const headY = -108 + bob;
  const elbowX = x + dir * 12;
  const elbowY = shY + lerp(12, 2, e);
  const handX = elbowX + dir * lerp(10, 14, e);
  const handY = elbowY + lerp(-2, -24, e);
  const f = (n: number) => n.toFixed(2);
  return (
    <g>
      <path
        d={`M ${x} ${hipY} L ${x + dir * 18} ${hipY} L ${x + dir * 18} -4`}
        fill="none"
        stroke={ink}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={`M ${x} ${f(shY)} L ${x + dir * 10} ${f(shY + 18)} L ${x + dir * 22} ${f(shY + 16)}`}
        fill="none"
        stroke={ink}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1={x} y1={hipY} x2={x} y2={f(shY)} stroke={ink} strokeWidth={7} strokeLinecap="round" />
      <path
        d={`M ${x - 7} ${hipY - 4} L ${x + 7} ${hipY - 4} L ${x + 6} ${f(shY + 4)} L ${x - 6} ${f(shY + 4)} Z`}
        fill={shirt}
        stroke={ink}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <path
        d={`M ${x} ${f(shY)} L ${f(elbowX)} ${f(elbowY)} L ${f(handX)} ${f(handY)}`}
        fill="none"
        stroke={ink}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={f(handX)} cy={f(handY)} r={3.5} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={2.5} />
      <circle cx={x} cy={f(headY)} r={12} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={4} />
      <circle cx={x - 4} cy={f(headY - 4)} r={4} fill="#ffffff" opacity={0.45} />
      <circle cx={x + dir * 5} cy={f(headY - 1)} r={1.8} fill={ink} />
      <path
        d={`M ${x + dir * 2} ${f(headY + 5)} q ${dir * 4} ${f(2 + e * 2)} ${dir * 7} 0`}
        fill="none"
        stroke={ink}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </g>
  );
};

const Stool: FC<{ x: number }> = ({ x }) => (
  <g>
    <line x1={x - 10} y1={-50} x2={x - 12} y2={0} stroke={ink} strokeWidth={5} strokeLinecap="round" />
    <line x1={x + 10} y1={-50} x2={x + 12} y2={0} stroke={ink} strokeWidth={5} strokeLinecap="round" />
    <rect x={x - 15} y={-56} width={30} height={8} rx={4} fill={PALETTE.woodDark} stroke={ink} strokeWidth={4} />
  </g>
);

/** Bàn quán ăn: ba người que trò chuyện, cà phê bốc khói, bóng đèn ý tưởng chớp sáng. */
const BanQuanAn: FC<PropProps> = ({ frame, seed }) => {
  const eL = gesture(frame, 0, 64);
  const eR = gesture(frame, 32, 64);
  const eC = gesture(frame, 16, 80);
  const bobL = 1.5 * wobble(frame, seed, 40);
  const bobR = 1.5 * wobble(frame, seed + 3, 46);
  const bobC = 2 * eC;

  const cyc = (frame % 54) / 54;
  const flash =
    cyc < 0.25 ? easing.out(cyc / 0.25) : 1 - easing.inOut(clamp((cyc - 0.25) / 0.75, 0, 1));
  const bulbScale = 1 + 0.08 * flash;
  const bulbY = -222 + 2 * wobble(frame, seed + 9, 60);

  const steam = (cx: number, s: number) => {
    const w1 = 4 * wobble(frame, seed + s, 30);
    const w2 = 4 * wobble(frame, seed + s + 5, 36);
    const rise = (frame * 0.4 + s * 7) % 10;
    return (
      <path
        d={`M ${cx} -116 C ${(cx + 6 + w1).toFixed(2)} ${(-124 - rise).toFixed(2)} ${(cx - 6 + w2).toFixed(2)} ${(-132 - rise).toFixed(2)} ${(cx + w1).toFixed(2)} ${(-142 - rise).toFixed(2)}`}
        fill="none"
        stroke={PALETTE.smoke}
        strokeWidth={3.5}
        strokeLinecap="round"
        opacity={0.75 - rise * 0.04}
      />
    );
  };

  const cElbowY = -116 + lerp(6, -4, eC);
  const cHandX = lerp(14, 22, eC);
  const cHandY = cElbowY + lerp(-2, -16, eC);

  return (
    <g>
      <defs>
        <linearGradient id="mk-gen-ban-top-802a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9a36a" />
          <stop offset="1" stopColor={PALETTE.wood} />
        </linearGradient>
        <radialGradient id="mk-gen-ban-bulb-802a" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#fffbe0" />
          <stop offset="1" stopColor={PALETTE.warn} />
        </radialGradient>
      </defs>
      <ContactShadow halfWidth={88} />

      {/* người ngồi giữa, phía sau bàn */}
      <g>
        <line x1={0} y1={-90} x2={0} y2={(-126 + bobC * 0.4).toFixed(2)} stroke={ink} strokeWidth={7} strokeLinecap="round" />
        <path
          d={`M -7 -92 L 7 -92 L 6 ${(-122 + bobC * 0.4).toFixed(2)} L -6 ${(-122 + bobC * 0.4).toFixed(2)} Z`}
          fill={PALETTE.accent}
          stroke={ink}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <path
          d={`M 0 -122 L -12 -110 L -18 -100`}
          fill="none"
          stroke={ink}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M 0 -122 L 12 ${cElbowY.toFixed(2)} L ${cHandX.toFixed(2)} ${cHandY.toFixed(2)}`}
          fill="none"
          stroke={ink}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={cHandX.toFixed(2)} cy={cHandY.toFixed(2)} r={3.5} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={2.5} />
        <circle cx={0} cy={(-140 - bobC).toFixed(2)} r={12} fill={PALETTE.tiSkin} stroke={ink} strokeWidth={4} />
        <circle cx={-4} cy={(-144 - bobC).toFixed(2)} r={4} fill="#ffffff" opacity={0.45} />
        <circle cx={-4} cy={(-141 - bobC).toFixed(2)} r={1.8} fill={ink} />
        <circle cx={4} cy={(-141 - bobC).toFixed(2)} r={1.8} fill={ink} />
        <ellipse cx={0} cy={(-134 - bobC).toFixed(2)} rx={3} ry={lerp(1.5, 3, eC).toFixed(2)} fill={ink} />
      </g>

      <Stool x={-72} />
      <Stool x={72} />

      {/* bàn */}
      <line x1={-40} y1={-86} x2={-40} y2={0} stroke={ink} strokeWidth={9} strokeLinecap="round" />
      <line x1={-40} y1={-86} x2={-40} y2={0} stroke={PALETTE.woodDark} strokeWidth={4} strokeLinecap="round" />
      <line x1={40} y1={-86} x2={40} y2={0} stroke={ink} strokeWidth={9} strokeLinecap="round" />
      <line x1={40} y1={-86} x2={40} y2={0} stroke={PALETTE.woodDark} strokeWidth={4} strokeLinecap="round" />
      <rect x={-58} y={-98} width={116} height={14} rx={6} fill="url(#mk-gen-ban-top-802a)" stroke={ink} strokeWidth={5} />
      <rect x={-52} y={-95} width={60} height={3} rx={1.5} fill="#ffffff" opacity={0.4} />
      <rect x={-54} y={-88} width={108} height={3} rx={1.5} fill={PALETTE.woodDark} opacity={0.35} />

      {/* cốc cà phê */}
      {steam(-26, 1)}
      {steam(26, 4)}
      <g>
        <path d="M -20 -110 q 8 0 6 6 q -2 5 -6 4" fill="none" stroke={ink} strokeWidth={3} />
        <path d="M -34 -114 L -18 -114 L -20 -98 L -32 -98 Z" fill={PALETTE.paper} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
        <rect x={-31} y={-112} width={3} height={10} rx={1.5} fill="#ffffff" opacity={0.6} />
        <path d="M 20 -110 q -8 0 -6 6 q 2 5 6 4" fill="none" stroke={ink} strokeWidth={3} />
        <path d="M 18 -114 L 34 -114 L 32 -98 L 20 -98 Z" fill={PALETTE.accent} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
        <rect x={21} y={-112} width={3} height={10} rx={1.5} fill="#ffffff" opacity={0.5} />
      </g>

      <SidePerson x={-72} dir={1} e={eL} bob={bobL} shirt={PALETTE.leaf} />
      <SidePerson x={72} dir={-1} e={eR} bob={bobR} shirt={PALETTE.shield} />

      {/* bóng đèn ý tưởng */}
      <g transform={`translate(0 ${bulbY.toFixed(2)}) scale(${bulbScale.toFixed(3)})`}>
        <circle cx={0} cy={0} r={30} fill={PALETTE.warn} opacity={(0.1 + 0.3 * flash).toFixed(3)} />
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (-150 + i * 30) * (Math.PI / 180);
          const r1 = 22;
          const r2 = 22 + 8 * flash;
          return (
            <line
              key={i}
              x1={(Math.cos(a) * r1).toFixed(2)}
              y1={(Math.sin(a) * r1).toFixed(2)}
              x2={(Math.cos(a) * r2).toFixed(2)}
              y2={(Math.sin(a) * r2).toFixed(2)}
              stroke={PALETTE.warn}
              strokeWidth={3.5}
              strokeLinecap="round"
              opacity={flash.toFixed(3)}
            />
          );
        })}
        <rect x={-6} y={12} width={12} height={9} rx={2} fill={PALETTE.metal} stroke={ink} strokeWidth={3} />
        <line x1={-5} y1={16} x2={5} y2={16} stroke={PALETTE.metalDark} strokeWidth={2} />
        <path
          d="M -7 12 C -7 6 -15 4 -15 -4 A 15 15 0 1 1 15 -4 C 15 4 7 6 7 12 Z"
          fill="url(#mk-gen-ban-bulb-802a)"
          stroke={ink}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <path d="M -4 8 L -2 0 L 0 4 L 2 0 L 4 8" fill="none" stroke={PALETTE.woodDark} strokeWidth={2} strokeLinejoin="round" opacity={0.7} />
        <ellipse cx={-6} cy={-9} rx={3.5} ry={5} fill="#ffffff" opacity={0.7} />
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 260,
  Component: BanQuanAn,
};
