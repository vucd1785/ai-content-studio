/**
 * Entry cho `@remotion/player` trong `apps/web` (P2-08, P6-17): composition `StickStory` và props, không có
 * code render (`./stick-story/render` dùng `@remotion/renderer`, chỉ chạy ở worker). Player không gọi export.
 */
export { MVP_FPS, MVP_HEIGHT, MVP_WIDTH, RenderPropsError } from "./render-props/common";
export { StickStoryComposition } from "./stick-story/StickStoryComposition";
export {
  parseStickStoryRenderProps,
  type StickStoryRenderProps,
  stickStoryDurationInFrames,
} from "./stick-story/stick-story-props";
