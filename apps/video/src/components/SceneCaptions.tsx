import type { RemotionCaption } from "@studio/contracts";
import type { FC } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import {
  findActiveGroup,
  findActiveToken,
  groupCaptionTokens,
} from "../captions/group-caption-tokens";
import { eduTheme } from "../theme/edu-theme";

const COMBINE_MS = 1200;

type SceneCaptionsProps = {
  captions: RemotionCaption[];
};

export const SceneCaptions: FC<SceneCaptionsProps> = ({ captions }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeMs = (frame / fps) * 1000;

  const groups = groupCaptionTokens(captions, COMBINE_MS);
  const activeGroup = findActiveGroup(groups, timeMs);
  const activeToken = findActiveToken(captions, timeMs);

  if (!activeGroup) {
    return null;
  }

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          marginBottom: eduTheme.safeBottom - 48,
          maxWidth: 960,
          width: "100%",
          background: eduTheme.captionBackground,
          borderRadius: 16,
          padding: "20px 28px",
          boxSizing: "border-box",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: eduTheme.fontFamily,
            fontSize: 40,
            lineHeight: 1.35,
            textAlign: "center",
            whiteSpace: "pre",
            color: eduTheme.textPrimary,
          }}
        >
          {activeGroup.tokens.map((token) => {
            const isActive = activeToken === token;
            return (
              <span
                key={`${token.startMs}-${token.text}`}
                style={{
                  color: isActive ? eduTheme.accentSoft : eduTheme.textPrimary,
                  fontWeight: isActive ? 700 : 500,
                }}
              >
                {token.text}
              </span>
            );
          })}
        </p>
      </div>
    </AbsoluteFill>
  );
};
