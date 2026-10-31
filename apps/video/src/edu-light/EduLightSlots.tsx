import type { FC, ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { EduVerticalRenderScene } from "../render-props/schema";
import { eduLightTheme as theme } from "./edu-light-theme";

/**
 * Năm slot của `EduLight` (P5-03). Cùng dữ liệu với slot EduVertical, khác bố cục: thẻ trắng trên nền sáng,
 * tiêu đề căn trái có vạch nhấn, sơ đồ xếp dọc theo khung 9:16, CTA neo phía dưới.
 */

type SlotProps = {
  scene: EduVerticalRenderScene;
};

function useFadeIn(frames: number): number {
  const frame = useCurrentFrame();
  return interpolate(frame, [0, frames], [0, 1], { extrapolateRight: "clamp" });
}

const Card: FC<{ children: ReactNode; grow?: boolean }> = ({ children, grow = false }) => (
  <div
    style={{
      flex: grow ? 1 : undefined,
      background: theme.card,
      border: `2px solid ${theme.cardBorder}`,
      borderRadius: 28,
      boxShadow: theme.cardShadow,
      padding: 44,
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      gap: 24,
    }}
  >
    {children}
  </div>
);

const Heading: FC<{ children: ReactNode }> = ({ children }) => (
  <h2
    style={{ margin: 0, fontSize: 58, lineHeight: 1.15, color: theme.textPrimary, fontWeight: 800 }}
  >
    {children}
  </h2>
);

export const LightTitleSlot: FC<SlotProps> = ({ scene }) => {
  const opacity = useFadeIn(12);
  const frame = useCurrentFrame();
  const bar = interpolate(frame, [0, 20], [0, 160], { extrapolateRight: "clamp" });
  if (scene.templateSlot !== "title") {
    return null;
  }
  return (
    <div
      style={{
        opacity,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        height: "100%",
        gap: 32,
      }}
    >
      <div style={{ width: bar, height: 12, borderRadius: 6, background: theme.accent }} />
      <h1
        style={{
          margin: 0,
          fontSize: 84,
          lineHeight: 1.05,
          color: theme.textPrimary,
          fontWeight: 900,
        }}
      >
        {scene.headline}
      </h1>
      <p style={{ margin: 0, fontSize: 32, fontWeight: 600, color: theme.accent }}>
        {scene.onScreenText}
      </p>
      {scene.hook ? (
        <Card>
          <p style={{ margin: 0, fontSize: 36, lineHeight: 1.4, color: theme.textSecondary }}>
            {scene.hook}
          </p>
        </Card>
      ) : null}
    </div>
  );
};

export const LightExplainSlot: FC<SlotProps> = ({ scene }) => {
  const opacity = useFadeIn(10);
  if (scene.templateSlot !== "explain") {
    return null;
  }
  return (
    <div
      style={{
        opacity,
        display: "flex",
        flexDirection: "column",
        gap: 36,
        height: "100%",
        justifyContent: "center",
      }}
    >
      {/* `visualIntent` là ghi chú dựng hình cho người làm, không phải chữ cho người xem: không vẽ. */}
      <Card>
        <div
          style={{
            alignSelf: "flex-start",
            background: theme.accentTint,
            color: theme.accent,
            fontSize: 28,
            fontWeight: 700,
            padding: "8px 22px",
            borderRadius: 999,
          }}
        >
          Ý chính
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 76,
            lineHeight: 1.15,
            fontWeight: 900,
            color: theme.textPrimary,
          }}
        >
          {scene.onScreenText}
        </p>
      </Card>
    </div>
  );
};

export const LightCodeSlot: FC<SlotProps> = ({ scene }) => {
  const opacity = useFadeIn(10);
  if (scene.templateSlot !== "code") {
    return null;
  }
  return (
    <div
      style={{
        opacity,
        display: "flex",
        flexDirection: "column",
        gap: 32,
        height: "100%",
        justifyContent: "center",
      }}
    >
      <Heading>{scene.onScreenText}</Heading>
      <div
        style={{
          background: theme.codeBackground,
          border: `2px solid ${theme.codeBorder}`,
          borderLeft: `12px solid ${theme.accent}`,
          borderRadius: 24,
          padding: 40,
          overflow: "hidden",
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 700, color: theme.accent, marginBottom: 18 }}>
          {scene.codeSnippet.language}
        </div>
        <pre
          style={{
            margin: 0,
            fontFamily: theme.fontMono,
            fontSize: 34,
            lineHeight: 1.5,
            color: theme.textPrimary,
            whiteSpace: "pre-wrap",
          }}
        >
          {scene.codeSnippet.code}
        </pre>
      </div>
    </div>
  );
};

/** Sơ đồ xếp dọc: mỗi node một thẻ, cạnh `from → to` liền kề vẽ thành mũi tên kèm nhãn giữa hai thẻ. */
export const LightDiagramSlot: FC<SlotProps> = ({ scene }) => {
  const opacity = useFadeIn(10);
  if (scene.templateSlot !== "diagram") {
    return null;
  }
  const { nodes, edges } = scene.diagram;
  return (
    <div
      style={{
        opacity,
        display: "flex",
        flexDirection: "column",
        gap: 32,
        height: "100%",
        justifyContent: "center",
      }}
    >
      <Heading>{scene.onScreenText}</Heading>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {nodes.map((node, index) => {
          const next = nodes[index + 1];
          const edge =
            next === undefined
              ? undefined
              : edges.find((e) => e.from === node.id && e.to === next.id);
          return (
            <div
              key={node.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: "100%",
              }}
            >
              <div
                style={{
                  width: "80%",
                  background: theme.card,
                  border: `3px solid ${theme.accentSoft}`,
                  borderRadius: 24,
                  boxShadow: theme.cardShadow,
                  padding: "28px 32px",
                  boxSizing: "border-box",
                  textAlign: "center",
                  fontSize: 36,
                  fontWeight: 700,
                  color: theme.textPrimary,
                }}
              >
                {node.label}
              </div>
              {next === undefined ? null : (
                <div style={{ display: "flex", alignItems: "center", gap: 20, height: 110 }}>
                  <svg width={36} height={96} viewBox="0 0 36 96" role="img" aria-label="Mũi tên">
                    <title>Mũi tên</title>
                    <line
                      x1={18}
                      y1={4}
                      x2={18}
                      y2={78}
                      stroke={edge ? theme.accent : theme.cardBorder}
                      strokeWidth={5}
                    />
                    <path d="M4,72 L18,94 L32,72 z" fill={edge ? theme.accent : theme.cardBorder} />
                  </svg>
                  {edge?.label ? (
                    <span style={{ fontSize: 28, color: theme.textSecondary }}>{edge.label}</span>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const LightCtaSlot: FC<SlotProps> = ({ scene }) => {
  const opacity = useFadeIn(14);
  const frame = useCurrentFrame();
  const y = interpolate(frame, [0, 18], [40, 0], { extrapolateRight: "clamp" });
  if (scene.templateSlot !== "cta") {
    return null;
  }
  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        height: "100%",
        gap: 36,
        paddingBottom: 120,
        boxSizing: "border-box",
      }}
    >
      <Heading>{scene.onScreenText}</Heading>
      <div
        style={{
          background: theme.accent,
          color: "#ffffff",
          fontSize: 38,
          fontWeight: 800,
          padding: "30px 44px",
          borderRadius: 24,
          textAlign: "center",
        }}
      >
        {scene.ctaText}
      </div>
    </div>
  );
};

export const LightSceneSlot: FC<SlotProps> = ({ scene }) => {
  switch (scene.templateSlot) {
    case "title":
      return <LightTitleSlot scene={scene} />;
    case "explain":
      return <LightExplainSlot scene={scene} />;
    case "code":
      return <LightCodeSlot scene={scene} />;
    case "diagram":
      return <LightDiagramSlot scene={scene} />;
    case "cta":
      return <LightCtaSlot scene={scene} />;
    default:
      return null;
  }
};
