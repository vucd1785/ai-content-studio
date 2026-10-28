import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";

const compositionId = "EduVertical";
const dataDir = process.env.DATA_DIR ?? join(process.cwd(), "..", "..", "data");
const outDir = join(dataDir, "render");
const outputLocation = join(outDir, "P1-04-edu-vertical-redis.mp4");

mkdirSync(dirname(outputLocation), { recursive: true });

const silencePath = join(outDir, "P1-04-silence.wav");
if (!existsSync(silencePath)) {
  writeFileSync(silencePath, createSilentWav(0.5, 44100));
}

const propsPath = join(import.meta.dirname, "..", "fixtures", "edu-vertical-redis-props.json");
const baseProps = JSON.parse(readFileSync(propsPath, "utf8"));
const inputProps = {
  ...baseProps,
  audio: {
    ...baseProps.audio,
    storageKey: "render/P1-04-silence.wav",
  },
};

const entryPoint = join(import.meta.dirname, "..", "src", "index.ts");

const bundleStart = performance.now();
const serveUrl = await bundle({
  entryPoint,
  webpackOverride: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
});
const bundleMs = performance.now() - bundleStart;

const composition = await selectComposition({
  serveUrl,
  id: compositionId,
  inputProps,
});

console.log(
  `Composition: ${composition.id} ${composition.width}x${composition.height} @ ${composition.fps}fps, frames=${composition.durationInFrames}`,
);

const renderStart = performance.now();
await renderMedia({
  codec: "h264",
  composition,
  serveUrl,
  outputLocation,
  inputProps,
  chromiumOptions: {
    enableMultiProcessOnLinux: true,
  },
});
const renderMs = performance.now() - renderStart;

console.log(
  JSON.stringify({
    outputLocation,
    bundleSeconds: Number((bundleMs / 1000).toFixed(2)),
    renderSeconds: Number((renderMs / 1000).toFixed(2)),
    totalSeconds: Number(((bundleMs + renderMs) / 1000).toFixed(2)),
    remotionVersion: "4.0.539",
    durationInFrames: composition.durationInFrames,
  }),
);

function createSilentWav(durationSeconds, sampleRate) {
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}
