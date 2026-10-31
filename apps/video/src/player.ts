/**
 * Entry cho `@remotion/player` trong `apps/web` (P2-08): composition và props, không có code render
 * (`./render` dùng `@remotion/renderer`, chỉ chạy ở worker). Player không gọi export.
 */
export { EduVerticalComposition } from "./compositions/EduVerticalComposition";
export {
  type EduVerticalRenderProps,
  MVP_FPS,
  MVP_HEIGHT,
  MVP_WIDTH,
  parseEduVerticalRenderProps,
  RenderPropsError,
} from "./render-props/schema";
import type { EduVerticalRenderProps } from "./render-props/schema";
import { buildSceneFramePlan, totalDurationInFrames } from "./timing/scene-frame-plan";

export function playerDurationInFrames(props: EduVerticalRenderProps): number {
  return totalDurationInFrames(buildSceneFramePlan(props.scenes, props.fps));
}
