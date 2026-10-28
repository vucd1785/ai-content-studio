import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { EduVerticalRenderScene } from "../../render-props/schema";
import { eduTheme } from "../../theme/edu-theme";

type SlotProps = {
  scene: EduVerticalRenderScene;
};

export const TitleSlot: FC<SlotProps> = ({ scene }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const y = interpolate(frame, [0, 18], [32, 0], { extrapolateRight: "clamp" });

  if (scene.templateSlot !== "title") {
    return null;
  }

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        height: "100%",
        gap: 24,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 28,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: eduTheme.accentSoft,
          fontWeight: 600,
        }}
      >
        {scene.onScreenText}
      </p>
      <h1
        style={{
          margin: 0,
          fontSize: 72,
          lineHeight: 1.05,
          color: eduTheme.textPrimary,
          fontWeight: 800,
        }}
      >
        {scene.headline}
      </h1>
      {scene.hook ? (
        <p style={{ margin: 0, fontSize: 34, lineHeight: 1.35, color: eduTheme.textSecondary }}>
          {scene.hook}
        </p>
      ) : null}
    </div>
  );
};

export const ExplainSlot: FC<SlotProps> = ({ scene }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });

  if (scene.templateSlot !== "explain") {
    return null;
  }

  return (
    <div style={{ opacity, display: "flex", flexDirection: "column", gap: 32, height: "100%" }}>
      <h2 style={{ margin: 0, fontSize: 56, color: eduTheme.textPrimary }}>{scene.onScreenText}</h2>
      <div
        style={{
          flex: 1,
          borderRadius: 24,
          background: eduTheme.panel,
          padding: 40,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 24,
        }}
      >
        <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
          <div
            style={{
              flex: 1,
              borderRadius: 16,
              border: `2px solid ${eduTheme.codeBorder}`,
              padding: 24,
              color: eduTheme.textSecondary,
              fontSize: 28,
            }}
          >
            Ổ đĩa
            <div style={{ fontSize: 40, color: eduTheme.textPrimary, marginTop: 8 }}>Chậm</div>
          </div>
          <div
            style={{
              flex: 1,
              borderRadius: 16,
              border: `2px solid ${eduTheme.accent}`,
              padding: 24,
              color: eduTheme.accentSoft,
              fontSize: 28,
            }}
          >
            RAM
            <div style={{ fontSize: 40, color: eduTheme.textPrimary, marginTop: 8 }}>Nhanh</div>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 30, lineHeight: 1.4, color: eduTheme.textSecondary }}>
          {scene.visualIntent}
        </p>
      </div>
    </div>
  );
};

export const CodeSlot: FC<SlotProps> = ({ scene }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });

  if (scene.templateSlot !== "code") {
    return null;
  }

  return (
    <div style={{ opacity, display: "flex", flexDirection: "column", gap: 28, height: "100%" }}>
      <h2 style={{ margin: 0, fontSize: 52, color: eduTheme.textPrimary }}>{scene.onScreenText}</h2>
      <div
        style={{
          flex: 1,
          borderRadius: 20,
          background: eduTheme.codeBackground,
          border: `1px solid ${eduTheme.codeBorder}`,
          padding: 36,
          overflow: "hidden",
        }}
      >
        <div style={{ fontSize: 22, color: eduTheme.accentSoft, marginBottom: 16 }}>
          {scene.codeSnippet.language}
        </div>
        <pre
          style={{
            margin: 0,
            fontFamily: eduTheme.fontMono,
            fontSize: 34,
            lineHeight: 1.45,
            color: eduTheme.textPrimary,
            whiteSpace: "pre-wrap",
          }}
        >
          {scene.codeSnippet.code}
        </pre>
      </div>
    </div>
  );
};

export const DiagramSlot: FC<SlotProps> = ({ scene }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });

  if (scene.templateSlot !== "diagram") {
    return null;
  }
  const nodes = scene.diagram.nodes;
  const nodeY = 280;

  return (
    <div style={{ opacity, display: "flex", flexDirection: "column", gap: 24, height: "100%" }}>
      <h2 style={{ margin: 0, fontSize: 52, color: eduTheme.textPrimary }}>{scene.onScreenText}</h2>
      <svg viewBox="0 0 900 520" style={{ width: "100%", flex: 1 }} role="img" aria-label="Sơ đồ">
        <title>Sơ đồ luồng</title>
        {scene.diagram.edges.map((edge: (typeof scene.diagram.edges)[number]) => {
          const from = nodes.find((node: (typeof nodes)[number]) => node.id === edge.from);
          const to = nodes.find((node: (typeof nodes)[number]) => node.id === edge.to);
          if (!from || !to) {
            return null;
          }
          const fromIndex = nodes.indexOf(from);
          const toIndex = nodes.indexOf(to);
          const x1 = 150 + fromIndex * 280;
          const x2 = 150 + toIndex * 280;
          return (
            <g key={`${edge.from}-${edge.to}-${edge.label ?? ""}`}>
              <line
                x1={x1}
                y1={nodeY + 40}
                x2={x2}
                y2={nodeY + 40}
                stroke={eduTheme.accentSoft}
                strokeWidth={4}
                markerEnd="url(#arrow)"
              />
              {edge.label ? (
                <text
                  x={(x1 + x2) / 2}
                  y={nodeY + 12}
                  fill={eduTheme.textSecondary}
                  fontSize={22}
                  textAnchor="middle"
                >
                  {edge.label}
                </text>
              ) : null}
            </g>
          );
        })}
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill={eduTheme.accentSoft} />
          </marker>
        </defs>
        {nodes.map((node: (typeof nodes)[number], index: number) => {
          const x = 80 + index * 280;
          return (
            <g key={node.id}>
              <rect
                x={x}
                y={nodeY}
                width={220}
                height={120}
                rx={16}
                fill={eduTheme.panel}
                stroke={eduTheme.accent}
                strokeWidth={2}
              />
              <text
                x={x + 110}
                y={nodeY + 68}
                fill={eduTheme.textPrimary}
                fontSize={26}
                textAnchor="middle"
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const CtaSlot: FC<SlotProps> = ({ scene }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const scale = interpolate(frame, [0, 18], [0.96, 1], { extrapolateRight: "clamp" });

  if (scene.templateSlot !== "cta") {
    return null;
  }

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale})`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        textAlign: "center",
        gap: 32,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 58, color: eduTheme.textPrimary }}>{scene.onScreenText}</h2>
      <div
        style={{
          background: eduTheme.accent,
          color: "#0f172a",
          fontSize: 34,
          fontWeight: 700,
          padding: "22px 48px",
          borderRadius: 999,
        }}
      >
        {scene.ctaText}
      </div>
    </div>
  );
};

export const SceneSlot: FC<SlotProps> = ({ scene }) => {
  switch (scene.templateSlot) {
    case "title":
      return <TitleSlot scene={scene} />;
    case "explain":
      return <ExplainSlot scene={scene} />;
    case "code":
      return <CodeSlot scene={scene} />;
    case "diagram":
      return <DiagramSlot scene={scene} />;
    case "cta":
      return <CtaSlot scene={scene} />;
    default:
      return null;
  }
};
