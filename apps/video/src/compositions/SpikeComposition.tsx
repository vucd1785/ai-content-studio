import type { FC } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { SpikeRenderProps } from "../spike-props";

export const SpikeComposition: FC<SpikeRenderProps> = ({ title, subtitle }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const translateY = interpolate(frame, [0, 20], [40, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
        color: "#f8fafc",
        fontFamily: "system-ui, Segoe UI, sans-serif",
        justifyContent: "center",
        alignItems: "center",
        padding: 48,
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          textAlign: "center",
          maxWidth: 900,
        }}
      >
        <h1 style={{ fontSize: 64, margin: 0, lineHeight: 1.1 }}>{title}</h1>
        <p style={{ fontSize: 32, marginTop: 24, color: "#94a3b8" }}>{subtitle}</p>
      </div>
    </AbsoluteFill>
  );
};
