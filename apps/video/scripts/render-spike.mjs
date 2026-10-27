import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";

const require = createRequire(import.meta.url);

const compositionId = "P0Spike";
const dataDir = process.env.DATA_DIR ?? join(process.cwd(), "..", "..", "data");
const outDir = join(dataDir, "render");
const outputLocation = join(outDir, "P0-05-spike.mp4");

const inputProps = {
  title: "AI Content Studio",
  subtitle: "Spike Remotion · 1080×1920 · 30 fps",
};

mkdirSync(dirname(outputLocation), { recursive: true });

const entryPoint = join(import.meta.dirname, "..", "src", "index.ts");

const bundleStart = performance.now();
const serveUrl = await bundle({
  entryPoint,
  webpackOverride: (config) => config,
});
const bundleMs = performance.now() - bundleStart;

const composition = await selectComposition({
  serveUrl,
  id: compositionId,
  inputProps,
});

console.log(`Composition: ${composition.id} ${composition.width}x${composition.height} @ ${composition.fps}fps`);

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

console.log(JSON.stringify({
  outputLocation,
  bundleSeconds: Number((bundleMs / 1000).toFixed(2)),
  renderSeconds: Number((renderMs / 1000).toFixed(2)),
  totalSeconds: Number(((bundleMs + renderMs) / 1000).toFixed(2)),
  remotionVersion: "4.0.539",
}));
