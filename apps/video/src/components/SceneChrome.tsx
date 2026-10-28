import type { FC, ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { eduTheme } from "../theme/edu-theme";

type SafeAreaProps = {
  children: ReactNode;
};

export const SafeArea: FC<SafeAreaProps> = ({ children }) => {
  return (
    <AbsoluteFill
      style={{
        paddingTop: eduTheme.safeTop,
        paddingBottom: eduTheme.safeBottom,
        paddingLeft: eduTheme.safeHorizontal,
        paddingRight: eduTheme.safeHorizontal,
        boxSizing: "border-box",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const SceneBackground: FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: eduTheme.background,
      }}
    />
  );
};
