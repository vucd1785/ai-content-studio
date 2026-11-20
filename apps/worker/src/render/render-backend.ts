import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { AUDIO_KIT_PUBLIC_DIR } from "@studio/audio-kit";
import type { AudioManifestArtifact } from "@studio/contracts";
import type { RenderPurpose } from "@studio/video/render";
import {
  STICK_STORY_COMPOSITION_ID,
  type StickStoryRenderProps,
} from "@studio/video/stick-story/props";
import { renderStickStoryWithCache } from "@studio/video/stick-story/render";
import { buildCombinedTimelineWav, resolvePublicAudioStorageKey } from "../cli/audio-timeline.js";
import { extractJpegFrame, probeMp4, probeWavDurationMs } from "../cli/ffprobe.js";
import { normalizeMp4Loudness } from "../cli/loudness.js";
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
  /**
   * Ảnh bìa (ADR-021): một khung JPEG của MP4 ở `atMs`, ghi vào `outKey` (tương đối `DATA_DIR`).
   * Tùy chọn: backend giả của test không cần cài.
   */
  thumbnail?(storageKey: string, atMs: number, outKey: string): Promise<void>;
};

function toStorageKey(dataDir: string, absolutePath: string): string {
  return relative(dataDir, absolutePath).split(sep).join("/");
}

/**
 * Chép thư viện âm thanh (ADR-019) vào `publicDir` của Remotion để composition đọc bằng `staticFile`.
 * Chỉ chép file khác nội dung; trả số file đã chép.
 */
export function syncAudioKitPublic(dataDir: string, repoRoot: string): number {
  const src = join(repoRoot, "packages", "audio-kit", "assets");
  if (!existsSync(src)) {
    return 0;
  }
  const dest = join(dataDir, "render", "public", AUDIO_KIT_PUBLIC_DIR);
  mkdirSync(dest, { recursive: true });
  let copied = 0;
  for (const file of readdirSync(src).filter((f) => f.endsWith(".wav"))) {
    const from = join(src, file);
    const to = join(dest, file);
    if (!existsSync(to) || sha256FileHex(to) !== sha256FileHex(from)) {
      copyFileSync(from, to);
      copied += 1;
    }
  }
  return copied;
}

/**
 * Remotion chép `publicDir` vào bundle một lần lúc `bundle()`; trên Windows không symlink được.
 * Giọng đọc của run sau (`pipeline/*.wav`) ghi sau lúc bundle nên bundle không có, render 404.
 * Trước mỗi lần render, chép file public còn thiếu hoặc khác kích thước vào `<bundle>/public`. Trả số file đã chép.
 */
export function syncPublicIntoBundle(publicDir: string, bundleDir: string): number {
  if (!existsSync(publicDir)) {
    return 0;
  }
  let copied = 0;
  const walk = (rel: string) => {
    const from = join(publicDir, rel);
    for (const entry of readdirSync(from, { withFileTypes: true })) {
      const childRel = join(rel, entry.name);
      if (entry.isDirectory()) {
        walk(childRel);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const src = join(publicDir, childRel);
      const dest = join(bundleDir, "public", childRel);
      if (existsSync(dest) && statSync(dest).size === statSync(src).size) {
        continue;
      }
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(src, dest);
      copied += 1;
    }
  };
  walk("");
  return copied;
}

export function createDefaultRenderBackend(dataDir: string): RenderBackend {
  let serveUrl: Promise<string> | null = null;
  let bundledRegistry = "";
  // ADR-017: tài sản tự tạo thêm vào `generated.ts`; đổi file đó thì bundle lại để render thấy tài sản mới.
  const registryPath = join(
    resolveRepoRoot(import.meta.url),
    "packages",
    "motion-kit",
    "src",
    "assets",
    "generated.ts",
  );
  const bundleOnce = () => {
    const registry = existsSync(registryPath) ? readFileSync(registryPath, "utf8") : "";
    if (registry !== bundledRegistry) {
      serveUrl = null;
      bundledRegistry = registry;
    }
    if (serveUrl === null) {
      syncAudioKitPublic(dataDir, resolveRepoRoot(import.meta.url));
    }
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
      // Bundle tạo trước khi có giọng đọc của run này: bổ sung file public mới (lỗi 404 `pipeline/*.wav`).
      syncPublicIntoBundle(join(dataDir, "render", "public"), url);
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
        // -14 LUFS cho cả preview lẫn export: Director nghe đúng độ to sẽ đăng (ADR-021).
        postProcess: (path) => {
          normalizeMp4Loudness(path);
        },
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
    async thumbnail(storageKey, atMs, outKey) {
      const out = join(dataDir, outKey);
      mkdirSync(dirname(out), { recursive: true });
      extractJpegFrame(join(dataDir, storageKey), atMs, out);
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
