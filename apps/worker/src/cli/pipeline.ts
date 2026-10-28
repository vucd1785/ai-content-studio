import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { Script } from "@studio/contracts";
import { parseScript } from "@studio/contracts";
import type {
  RenderEduVerticalWithCacheResult,
  RenderMediaInvokeOptions,
} from "@studio/video/render";
import { renderEduVerticalWithCache } from "@studio/video/render";
import { hashEduVerticalRenderProps } from "@studio/video/render-props/content-hash";
import { EDU_VERTICAL_COMPOSITION_ID } from "@studio/video/render-props/schema";
import { TtsMediaClient } from "../media-client.js";
import {
  buildCombinedTimelineWav,
  resolvePublicAudioStorageKey,
  type SceneWavInput,
} from "./audio-timeline.js";
import { buildEduVerticalRenderProps } from "./build-render-props.js";
import { probeMaxVolumeDb, probeMp4, probeWavDurationMs } from "./ffprobe.js";
import { collectSceneMediaArtifacts, preparePublicAudioAsset } from "./media-stage.js";
import { PipelineError, resolveDataDir, resolveRepoRoot, sha256FileHex } from "./paths.js";
import { writePipelineReport } from "./qa.js";

export type PipelineRunResult = {
  mp4Path: string;
  contentHash: string;
  reportPath: string;
  qaPassed: boolean;
};

export type PipelineOptions = {
  scriptPath?: string;
  purpose?: "preview" | "export";
  ttsBaseUrl?: string;
};

export async function runScriptToMp4(options: PipelineOptions = {}): Promise<PipelineRunResult> {
  const repoRoot = resolveRepoRoot(import.meta.url);
  const dataDir = resolveDataDir(repoRoot);
  mkdirSync(join(dataDir, "pipeline"), { recursive: true });
  const scriptPath = options.scriptPath ?? join(repoRoot, "fixtures", "script.edu.json");
  const purpose = options.purpose ?? "preview";
  const ttsBaseUrl = options.ttsBaseUrl ?? process.env.TTS_BASE_URL ?? "http://127.0.0.1:8000";

  const totalStart = performance.now();
  const stageLog: Record<string, unknown> = {};

  let scriptRaw: unknown;
  try {
    const { readFileSync } = await import("node:fs");
    scriptRaw = JSON.parse(readFileSync(scriptPath, "utf8")) as unknown;
  } catch (cause) {
    throw new PipelineError(
      "schema_invalid",
      `Cannot read script: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  let script: Script;
  try {
    script = parseScript(scriptRaw);
  } catch (cause) {
    throw new PipelineError(
      "schema_invalid",
      cause instanceof Error ? cause.message : "Invalid script JSON",
    );
  }

  const ttsClient = new TtsMediaClient({ baseUrl: ttsBaseUrl });
  await assertTtsHealthy(ttsBaseUrl);

  const mediaStart = performance.now();
  const { scenes: sceneArtifacts, timings: mediaTimings } = await collectSceneMediaArtifacts({
    script,
    dataDir,
    ttsClient,
  });
  stageLog.mediaMs = Math.round(performance.now() - mediaStart);
  stageLog.media = mediaTimings;

  const combinedDir = join(dataDir, "pipeline", "audio");
  mkdirSync(combinedDir, { recursive: true });

  const sceneWavs: SceneWavInput[] = sceneArtifacts.map((scene) => ({
    sceneId: scene.sceneId,
    wavPath: join(dataDir, "tts", `${scene.wavArtifactId.toLowerCase()}.wav`),
  }));

  const combinedTemp = join(combinedDir, "edu-combined-temp.wav");
  const audioBuildStart = performance.now();
  try {
    buildCombinedTimelineWav(sceneWavs, combinedTemp);
  } catch (cause) {
    throw new PipelineError(
      "audio_build_failed",
      cause instanceof Error ? cause.message : String(cause),
    );
  }
  stageLog.audioBuildMs = Math.round(performance.now() - audioBuildStart);

  const audioContentSha256 = sha256FileHex(combinedTemp);
  const storageKey = resolvePublicAudioStorageKey(audioContentSha256);
  const combinedFinal = join(combinedDir, `${audioContentSha256}.wav`);
  const { copyFileSync, existsSync: exists } = await import("node:fs");
  if (!exists(combinedFinal)) {
    copyFileSync(combinedTemp, combinedFinal);
  }
  preparePublicAudioAsset({ dataDir, combinedWavPath: combinedFinal, storageKey });

  const measuredCombinedMs = probeWavDurationMs(combinedFinal);

  const props = buildEduVerticalRenderProps({
    script,
    sceneArtifacts,
    audioStorageKey: storageKey,
    totalDurationMs: measuredCombinedMs,
    audioSrc: storageKey,
  });

  const contentHash = hashEduVerticalRenderProps(props, { audioContentSha256 });
  stageLog.contentHash = contentHash;
  stageLog.wavArtifacts = sceneArtifacts.map((s) => s.wavArtifactId);
  stageLog.alignmentArtifacts = sceneArtifacts.map((s) => s.wavArtifactId);
  stageLog.gates = sceneArtifacts.map((s) => ({
    sceneId: s.sceneId,
    passesGate: s.alignment.gate.passesGate,
    validationOk: s.alignment.validation.ok,
  }));

  const publicRoot = join(dataDir, "render", "public");
  const entryPoint = join(repoRoot, "apps", "video", "src", "index.ts");

  const bundleStart = performance.now();
  const serveUrl = await bundle({
    entryPoint,
    publicDir: publicRoot,
    webpackOverride: (config) => {
      config.resolve = config.resolve ?? {};
      config.resolve.extensionAlias = {
        ".js": [".ts", ".tsx", ".js"],
      };
      return config;
    },
  });
  stageLog.bundleMs = Math.round(performance.now() - bundleStart);

  const composition = await selectComposition({
    serveUrl,
    id: EDU_VERTICAL_COMPOSITION_ID,
    inputProps: props,
  });

  const cacheRoot = join(dataDir, "render", "cache");
  const renderStart = performance.now();
  let renderResult: RenderEduVerticalWithCacheResult;
  try {
    renderResult = await renderEduVerticalWithCache({
      purpose,
      props,
      cacheRoot,
      serveUrl,
      composition,
      audioContentSha256,
      renderMedia: async (opts: RenderMediaInvokeOptions) => {
        await renderMedia({
          codec: opts.codec,
          composition: opts.composition as typeof composition,
          serveUrl: opts.serveUrl,
          outputLocation: opts.outputLocation,
          inputProps: opts.inputProps,
          crf: opts.crf,
        });
      },
    });
  } catch (cause) {
    throw new PipelineError(
      "render_failed",
      cause instanceof Error ? cause.message : String(cause),
    );
  }
  stageLog.renderMs = Math.round(performance.now() - renderStart);
  stageLog.cacheHit = renderResult.cacheHit;

  const mp4Probe = probeMp4(renderResult.outputLocation);
  const maxVolumeDb = probeMaxVolumeDb(combinedFinal);

  const qa = {
    passed:
      mp4Probe.width === 1080 &&
      mp4Probe.height === 1920 &&
      mp4Probe.hasVideo &&
      mp4Probe.hasAudio &&
      (maxVolumeDb === null || maxVolumeDb > -50),
    checks: [
      {
        code: "frame_size",
        severity: mp4Probe.width === 1080 && mp4Probe.height === 1920 ? "pass" : "error",
        message: `${mp4Probe.width}x${mp4Probe.height}`,
      },
      {
        code: "av_streams",
        severity: mp4Probe.hasVideo && mp4Probe.hasAudio ? "pass" : "error",
        message: `video=${mp4Probe.hasVideo} audio=${mp4Probe.hasAudio}`,
      },
      {
        code: "audio_level",
        severity: maxVolumeDb === null || maxVolumeDb > -50 ? "pass" : "warning",
        message: maxVolumeDb === null ? "volumedetect unavailable" : `max_volume ${maxVolumeDb} dB`,
      },
    ],
  };

  stageLog.totalMs = Math.round(performance.now() - totalStart);
  stageLog.mp4 = mp4Probe;
  stageLog.combinedWav = combinedFinal;
  stageLog.combinedAudioSha256 = audioContentSha256;

  const reportPath = join(dataDir, "pipeline", "P1-06-last-run.json");
  writePipelineReport(reportPath, {
    task: "P1-06",
    scriptPath,
    mp4Path: renderResult.outputLocation,
    contentHash,
    qa,
    stageLog,
  });

  return {
    mp4Path: renderResult.outputLocation,
    contentHash,
    reportPath,
    qaPassed: qa.passed,
  };
}

async function assertTtsHealthy(baseUrl: string): Promise<void> {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/health`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const body = (await response.json()) as { status?: string };
    if (body.status !== "ok") {
      throw new Error(`health status=${body.status ?? "unknown"}`);
    }
  } catch (cause) {
    throw new PipelineError(
      "tts_unavailable",
      `TTS service not ready at ${baseUrl}: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
}

export async function runFixtureCli(argv: string[]): Promise<number> {
  const scriptFlag = argv.indexOf("--script");
  const scriptPath = scriptFlag >= 0 ? argv[scriptFlag + 1] : undefined;
  const purposeFlag = argv.indexOf("--purpose");
  const purposeRaw = purposeFlag >= 0 ? argv[purposeFlag + 1] : "preview";
  const purpose = purposeRaw === "export" ? "export" : "preview";

  try {
    const result = await runScriptToMp4({
      ...(scriptPath ? { scriptPath } : {}),
      purpose,
    });
    console.log(
      JSON.stringify(
        {
          status: result.qaPassed ? "pass" : "qa_warning",
          mp4Path: result.mp4Path,
          contentHash: result.contentHash,
          reportPath: result.reportPath,
        },
        null,
        2,
      ),
    );
    return result.qaPassed ? 0 : 2;
  } catch (error) {
    const payload =
      error instanceof PipelineError
        ? { status: "error", code: error.code, message: error.message }
        : { status: "error", code: "render_failed", message: String(error) };
    console.error(JSON.stringify(payload, null, 2));
    return 1;
  }
}
