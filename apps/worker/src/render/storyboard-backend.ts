import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import {
  parseStickStoryRenderProps,
  STICK_STORY_COMPOSITION_ID,
  STICK_STORY_MOTION_KIT_VERSION,
  STICK_STORY_TEMPLATE_ID,
  type StickStoryRenderProps,
  stickStoryTemplateVersion,
} from "@studio/video/stick-story/props";
import { resolveRepoRoot } from "../cli/paths.js";
import { STILL_HOLD_FRAME, type StillSpec } from "./storyboard-checks.js";

/** Phần Remotion của job storyboard; test thay bằng bản giả. */
export type StoryboardRenderer = {
  renderStill(props: StickStoryRenderProps, frame: number, outputPath: string): Promise<void>;
};

const STILL_SCENE_MS = 2400;
const STILL_FRAMES = 72;

/**
 * Props `StickStory` một cảnh, một shot cho ảnh tĩnh (05: chưa có audio, phụ đề mẫu là câu đầu cảnh).
 * Từ của câu trải đều trong 2 giây đầu để phụ đề hiện ở frame của ảnh.
 */
export function stillRenderProps(
  spec: StillSpec,
  brand: { fontFamily: string; textColor: string; speakerColors: Record<string, string> },
): StickStoryRenderProps {
  const words = spec.caption.text.split(/\s+/).filter((w) => w !== "");
  const step = 2000 / Math.max(1, words.length);
  return parseStickStoryRenderProps({
    templateId: STICK_STORY_TEMPLATE_ID,
    templateVersion: stickStoryTemplateVersion(),
    motionKitVersion: STICK_STORY_MOTION_KIT_VERSION,
    fps: 30,
    width: 1080,
    height: 1920,
    audio: { storageKey: "storyboard/silent.wav", durationMs: STILL_SCENE_MS },
    brand: {
      fontFamily: brand.fontFamily,
      textColor: brand.textColor,
      captionBackground: "rgba(11,13,18,0.82)",
      speakerColors: brand.speakerColors,
      introAssetId: null,
      outroAssetId: null,
    },
    scenes: [{ sceneId: "still", fromMs: 0, durationMs: STILL_SCENE_MS }],
    shots: [
      {
        shotId: "s1",
        sceneId: "still",
        fromFrame: 0,
        durationInFrames: STILL_FRAMES,
        background: spec.background,
        shotSize: spec.shotSize,
        camera: spec.camera,
        focus: spec.focus,
        props: [],
        ambience: [],
        actors: spec.actors.map((a) => ({ ...a, speakingRanges: [] })),
      },
    ],
    captions: words.map((word, i) => {
      const startMs = Math.round(200 + i * step);
      return {
        text: i === 0 ? word : ` ${word}`,
        startMs,
        endMs: Math.round(startMs + step - 20),
        timestampMs: startMs,
        confidence: null,
        speaker: spec.caption.speaker,
      };
    }),
    sfx: [],
  });
}

/** Render ảnh tĩnh bằng composition `StickStory` của `apps/video`; bundle một lần cho cả job. */
export function createDefaultStoryboardRenderer(): StoryboardRenderer {
  let serveUrl: Promise<string> | null = null;
  const bundleOnce = () => {
    serveUrl ??= bundle({
      entryPoint: join(resolveRepoRoot(import.meta.url), "apps", "video", "src", "index.ts"),
      webpackOverride: (config) => {
        config.resolve = config.resolve ?? {};
        config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
        return config;
      },
    });
    return serveUrl;
  };
  return {
    async renderStill(props, frame, outputPath) {
      const url = await bundleOnce();
      const composition = await selectComposition({
        serveUrl: url,
        id: STICK_STORY_COMPOSITION_ID,
        inputProps: props,
      });
      mkdirSync(dirname(outputPath), { recursive: true });
      await renderStill({
        composition,
        serveUrl: url,
        inputProps: props,
        frame,
        output: outputPath,
      });
    },
  };
}

export { STILL_HOLD_FRAME };
