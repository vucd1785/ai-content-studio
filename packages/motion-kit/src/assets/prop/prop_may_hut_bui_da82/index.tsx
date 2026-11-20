import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { easing, wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../prop_server/index.js";

const ink = PALETTE.ink;

/** Robot hút bụi tròn dẹt: chạy vòng vòng trên sàn, chổi hông quay, đèn xanh nhấp nháy, bụi bị hút vào. */
const RobotVacuum: FC<PropProps> = ({ frame, seed }) => {
  const loop = 120;
  const phase = ((frame % loop) / loop) * Math.PI * 2;
  const travel = 12 * Math.sin(phase);
  const turn = Math.cos(phase);
  const turretX = 10 * turn;
  const bob = 1.2 * Math.sin(frame * 0.5);
  const tilt = 2 * Math.cos(phase);
  const blinkCycle = (frame % 36) / 36;
  const blink = blinkCycle < 0.5 ? easing.out(blinkCycle * 2) : 1 - easing.inOut((blinkCycle - 0.5) * 2);
  const brushAngle = (frame * 18) % 360;
  const glow = 0.5 + 0.5 * wobble(frame, seed, 40);
  const gid = `mk-gen-vac-top-${seed}`;
  const sid = `mk-gen-vac-side-${seed}`;

  const dust = [0, 1, 2].map((i) => {
    const p = ((frame + i * 14) % 42) / 42;
    const e = easing.in(p);
    return {
      x: -78 + e * 30 + i * 3,
      y: -6 - i * 4 + e * 2,
      r: 3.2 * (1 - p * 0.8),
      o: 1 - p,
    };
  });

  return (
    <g>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E9EEF7" />
          <stop offset="0.55" stopColor="#B9C4D6" />
          <stop offset="1" stopColor="#8E9BB2" />
        </linearGradient>
        <linearGradient id={sid} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6E7B93" />
          <stop offset="1" stopColor="#3F4A5E" />
        </linearGradient>
      </defs>
      <g transform={`translate(${travel.toFixed(2)} 0)`}>
        <ContactShadow halfWidth={64} />
        {dust.map((d, i) => (
          <circle
            key={i}
            cx={d.x}
            cy={d.y}
            r={Math.max(0.5, d.r)}
            fill="#A08A6A"
            opacity={d.o * 0.85}
          />
        ))}
        <g transform={`translate(0 ${bob.toFixed(2)}) rotate(${tilt.toFixed(2)} 0 -20)`}>
          {/* wheels peeking */}
          <ellipse cx={-34} cy={-6} rx={10} ry={5} fill={ink} />
          <ellipse cx={34} cy={-6} rx={10} ry={5} fill={ink} />
          {/* side wall */}
          <path
            d="M -62 -34 L -62 -16 A 62 18 0 0 0 62 -16 L 62 -34 Z"
            fill={`url(#${sid})`}
            stroke={ink}
            strokeWidth={6}
            strokeLinejoin="round"
          />
          {/* front bumper band */}
          <path
            d="M -50 -26 A 60 16 0 0 0 50 -26"
            fill="none"
            stroke="#2E3646"
            strokeWidth={5}
            strokeLinecap="round"
            opacity={0.7}
          />
          {/* side brush */}
          <g transform={`translate(-46 -8) scale(1 0.35)`}>
            <g transform={`rotate(${brushAngle.toFixed(1)})`}>
              {[0, 120, 240].map((a) => (
                <line
                  key={a}
                  x1={0}
                  y1={0}
                  x2={20 * Math.cos((a * Math.PI) / 180)}
                  y2={20 * Math.sin((a * Math.PI) / 180)}
                  stroke={PALETTE.warn}
                  strokeWidth={5}
                  strokeLinecap="round"
                />
              ))}
            </g>
            <circle cx={0} cy={0} r={6} fill={PALETTE.metalDark} stroke={ink} strokeWidth={4} />
          </g>
          {/* top disc */}
          <ellipse cx={0} cy={-34} rx={62} ry={20} fill={`url(#${gid})`} stroke={ink} strokeWidth={6} />
          {/* inner ring */}
          <ellipse cx={0} cy={-34} rx={46} ry={13} fill="none" stroke="#7D8AA3" strokeWidth={3} opacity={0.8} />
          {/* highlight top-left */}
          <ellipse cx={-26} cy={-40} rx={22} ry={5} fill="#FFFFFF" opacity={0.55} />
          {/* shade right */}
          <path d="M 40 -24 A 62 20 0 0 0 58 -38 L 52 -36 A 52 16 0 0 1 36 -26 Z" fill="#2E3646" opacity={0.25} />
          {/* turret (rotation cue) */}
          <g transform={`translate(${turretX.toFixed(2)} 0)`}>
            <path
              d="M -14 -42 L -14 -48 A 14 5 0 0 1 14 -48 L 14 -42 A 14 5 0 0 1 -14 -42 Z"
              fill={PALETTE.metalDark}
              stroke={ink}
              strokeWidth={4}
            />
            <ellipse cx={0} cy={-48} rx={14} ry={5} fill={PALETTE.metal} stroke={ink} strokeWidth={4} />
            <ellipse cx={-5} cy={-49} rx={5} ry={1.6} fill="#FFFFFF" opacity={0.6} />
          </g>
          {/* green blinking light */}
          <ellipse cx={-turretX * 0.6 + 24} cy={-30} rx={10} ry={5} fill={PALETTE.ok} opacity={0.25 * blink * glow + 0.05} />
          <ellipse
            cx={-turretX * 0.6 + 24}
            cy={-30}
            rx={4.5}
            ry={2.6}
            fill={PALETTE.ok}
            stroke={ink}
            strokeWidth={2}
            opacity={0.35 + 0.65 * blink}
          />
          {/* little button */}
          <ellipse cx={-turretX * 0.6 - 22} cy={-28} rx={5} ry={2.4} fill={PALETTE.accent} stroke={ink} strokeWidth={2} />
        </g>
      </g>
    </g>
  );
};

export const asset: PropAsset = {
  placement: "floor",
  halfWidth: 90,
  height: 70,
  Component: RobotVacuum,
};
