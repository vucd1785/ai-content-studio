import eduVerticalRedisFixture from "../fixtures/edu-vertical-redis-props.json";
import type { EduVerticalRenderProps } from "./render-props/schema";
import { buildSceneFramePlan, totalDurationInFrames } from "./timing/scene-frame-plan";

export const EDU_VERTICAL_COMPOSITION_ID = "EduVertical";
export const EDU_VERTICAL_TEMPLATE_VERSION = "1.0.0";
export const MVP_FPS = 30;
export const MVP_WIDTH = 1080;
export const MVP_HEIGHT = 1920;

export const EDU_VERTICAL_DEFAULT_PROPS = eduVerticalRedisFixture as EduVerticalRenderProps;

export function eduVerticalDurationInFrames(
  props: EduVerticalRenderProps = EDU_VERTICAL_DEFAULT_PROPS,
): number {
  const plan = buildSceneFramePlan(props.scenes, props.fps);
  return totalDurationInFrames(plan);
}
