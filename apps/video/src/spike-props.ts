/** Props cố định cho spike P0-05 — không gọi mạng lúc render. */
export type SpikeRenderProps = {
  title: string;
  subtitle: string;
};

export const P0_05_SPIKE_PROPS: SpikeRenderProps = {
  title: "AI Content Studio",
  subtitle: "Spike Remotion · 1080×1920 · 30 fps",
};

export const SPIKE_COMPOSITION_ID = "P0Spike";
export const SPIKE_FPS = 30;
export const SPIKE_WIDTH = 1080;
export const SPIKE_HEIGHT = 1920;
export const SPIKE_DURATION_SECONDS = 3;
export const SPIKE_DURATION_IN_FRAMES = SPIKE_FPS * SPIKE_DURATION_SECONDS;
