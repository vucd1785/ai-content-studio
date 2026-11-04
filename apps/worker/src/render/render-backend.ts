import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { AudioManifestArtifact } from "@studio/contracts";
import type { RenderPurpose } from "@studio/video/render";
import {
  STICK_STORY_COMPOSITION_ID,
  type StickStoryRenderProps,
} from "@studio/video/stick-story/props";
import { renderStickStoryWithCache } from "@studio/video/stick-story/render";
import { buildCombinedTimelineWav, resolvePublicAudioStorageKey } from "../cli/audio-timeline.js";
import { probeMp4, probeWavDurationMs } from "../cli/ffprobe.js";
import { preparePublicAudioAsset } from "../cli/media-stage.js";
import { resolveRepoRoot, sha256FileHex, ttsWavPath } from "../cli/paths.js";

/**
 * Phần ffmpeg/Remotion của job render, QA và export (P3-06). Job chỉ gọi qua interface này,
 * nên test thay bằng bản giả; bản mặc định dùng lại đường P1-05/P1-06 (cache MP4 theo hash props).
 */

export type BuiltAudio = {
  audioStorageKey: string;
  audioSrc: string;
  audioContentSha256: string;
  totalDurationMs: number;
};

/** `storageKey` tương đối với `DATA_DIR`, dùng làm `artifacts.storage_key`. */
export type RenderedMp4 = { storageKey: string; contentHash: string; cacheHit: boolean };

export type Mp4Info = {
  width: number;
  height: number;
  hasVideo: boolean;
  hasAudio: boolean;
  durationMs: number;
};

/** Frame đã render thật từ callback `onProgress` của `renderMedia()` (P3-17). */
export type RenderFrameProgress = { renderedFrames: number; totalFrames: number };

export type RenderBackend = {
  buildAudio(manifest: AudioManifestArtifact): Promise<BuiltAudio>;
  /** Template `StickStory` (P6-17), template duy nhất từ ADR-013 bổ sung (2). */
  render(
    purpose: RenderPurpose,
    props: StickStoryRenderProps,
    audioContentSha256: string,
    onProgress?: (progress: RenderFrameProgress) => void,
  ): Promise<RenderedMp4>;
  probe(storageKey: string): Promise<Mp4Info>;
};

function toStorageKey(dataDir: string, absolutePath: string): string {
  return relative(dataDir, absolutePath).split(sep).join("/");
}

export function createDefaultRenderBackend(dataDir: string): RenderBackend {
  let serveUrl: Promise<string> | null = null;
  const bundleOnce = () => {
    serveUrl ??= bundle({
      entryPoint: join(resolveRepoRoot(import.meta.url), "apps", "video", "src", "index.ts"),
      publicDir: join(dataDir, "render", "public"),
      webpackOverride: (config) => {
        config.resolve = config.resolve ?? {};
        config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
        return config;
      },
    });
    return serveUrl;
  };

  return {
    async buildAudio(manifest) {
      const combinedDir = join(dataDir, "pipeline", "audio");
      mkdirSync(combinedDir, { recursive: true });
      const temp = join(combinedDir, `job-${manifest.scriptArtifactId}-temp.wav`);
      buildCombinedTimelineWav(
        manifest.scenes.map((scene) => ({
          sceneId: scene.sceneId,
          wavPath: ttsWavPath(dataDir, scene.wavArtifactId),
        })),
        temp,
      );
      const audioContentSha256 = sha256FileHex(temp);
      const combined = join(combinedDir, `${audioContentSha256}.wav`);
      if (!existsSync(combined)) {
        copyFileSync(temp, combined);
      }
      const audioStorageKey = resolvePublicAudioStorageKey(audioContentSha256);
      preparePublicAudioAsset({ dataDir, combinedWavPath: combined, storageKey: audioStorageKey });
      return {
        audioStorageKey,
        audioSrc: audioStorageKey,
        audioContentSha256,
        totalDurationMs: probeWavDurationMs(combined),
      };
    },
    async render(purpose, props, audioContentSha256, onProgress) {
      const url = await bundleOnce();
      const composition = await selectComposition({
        serveUrl: url,
        id: STICK_STORY_COMPOSITION_ID,
        inputProps: props,
      });
      const result = await renderStickStoryWithCache({
        purpose,
        props,
        cacheRoot: join(dataDir, "render", "cache"),
        serveUrl: url,
        composition,
        audioContentSha256,
        renderMedia: async (options) => {
          await renderMedia({
            codec: options.codec,
            composition: options.composition as typeof composition,
            serveUrl: options.serveUrl,
            outputLocation: options.outputLocation,
            inputProps: options.inputProps,
            crf: options.crf,
            onProgress: ({ renderedFrames }) =>
              onProgress?.({ renderedFrames, totalFrames: composition.durationInFrames }),
          });
        },
      });
      return {
        storageKey: toStorageKey(dataDir, result.outputLocation),
        contentHash: result.contentHash,
        cacheHit: result.cacheHit,
      };
    },
    async probe(storageKey) {
      const info = probeMp4(join(dataDir, storageKey));
      return {
        width: info.width,
        height: info.height,
        hasVideo: info.hasVideo,
        hasAudio: info.hasAudio,
        durationMs: Math.round(info.durationSeconds * 1000),
      };
    },
  };
}
