// Spike P6-03: đo thời gian render theo mức chi tiết. Chạy từ apps/video:
//   node src/spikes/p6-03/render-cost.mjs stills
//   node src/spikes/p6-03/render-cost.mjs full [đường dẫn render_props.json cho baseline EduVertical]
// Đầu ra: data/spikes/p6-03/ (ảnh tĩnh, MP4, results-<mode>.json). Không ghi chỗ khác trong data/.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const [mode = "stills", baselinePropsPath] = process.argv.slice(2);
const here = import.meta.dirname;
const repoRoot = join(here, "..", "..", "..", "..", "..");
const outDir = join(repoRoot, "data", "spikes", "p6-03");
mkdirSync(join(outDir, "stills"), { recursive: true });

const webpackOverride = (config) => {
  config.resolve = config.resolve ?? {};
  config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
  return config;
};

const t0 = performance.now();
const serveUrl = await bundle({ entryPoint: join(here, "index.tsx"), webpackOverride });
const results = {
  mode,
  machine: {
    cpus: os.cpus().length,
    model: os.cpus()[0]?.model,
    totalMemGb: +(os.totalmem() / 2 ** 30).toFixed(1),
  },
  bundleMs: Math.round(performance.now() - t0),
  levels: [],
};

for (const level of mode === "noblur" ? [] : [1, 2, 3]) {
  const id = `P603-L${level}`;
  const composition = await selectComposition({ serveUrl, id, inputProps: { level } });
  if (mode === "stills") {
    const stills = [];
    for (const frame of [45, 135, 315, 585, 675]) {
      const s = performance.now();
      const output = join(outDir, "stills", `L${level}-f${frame}.png`);
      await renderStill({ composition, serveUrl, inputProps: { level }, frame, output });
      stills.push({ frame, ms: Math.round(performance.now() - s) });
    }
    results.levels.push({ level, stills });
    console.log(`L${level} stills`, stills);
  } else {
    const s = performance.now();
    const output = join(outDir, `L${level}.mp4`);
    await renderMedia({
      codec: "h264",
      composition,
      serveUrl,
      inputProps: { level },
      outputLocation: output,
    });
    const ms = Math.round(performance.now() - s);
    const videoSec = composition.durationInFrames / composition.fps;
    results.levels.push({
      level,
      frames: composition.durationInFrames,
      renderMs: ms,
      renderSecPerVideoSec: +(ms / 1000 / videoSec).toFixed(2),
    });
    console.log(`L${level}: ${ms} ms cho ${videoSec} s video`);
  }
}

if (mode === "noblur") {
  // Biến thể: mức 3 bỏ feGaussianBlur ở tiền cảnh, để tách chi phí của bộ lọc.
  const inputProps = { level: 3, blur: false };
  const composition = await selectComposition({ serveUrl, id: "P603-L3-noblur", inputProps });
  const s = performance.now();
  await renderMedia({
    codec: "h264",
    composition,
    serveUrl,
    inputProps,
    outputLocation: join(outDir, "L3-noblur.mp4"),
  });
  const ms = Math.round(performance.now() - s);
  results.levels = [
    {
      level: "3-noblur",
      frames: composition.durationInFrames,
      renderMs: ms,
      renderSecPerVideoSec: +(ms / 1000 / (composition.durationInFrames / composition.fps)).toFixed(
        2,
      ),
    },
  ];
}

if (mode === "full" && baselinePropsPath) {
  // Baseline: template EduVertical hiện tại với props thật (bỏ audio), để so sánh cùng máy.
  const props = JSON.parse(readFileSync(baselinePropsPath, "utf8"));
  const inputProps = { ...props, audio: { ...props.audio, src: "" } };
  const mainUrl = await bundle({ entryPoint: join(here, "..", "..", "index.ts"), webpackOverride });
  const composition = await selectComposition({ serveUrl: mainUrl, id: "EduVertical", inputProps });
  const s = performance.now();
  await renderMedia({
    codec: "h264",
    composition,
    serveUrl: mainUrl,
    inputProps,
    outputLocation: join(outDir, "baseline-eduvertical.mp4"),
  });
  const ms = Math.round(performance.now() - s);
  const videoSec = composition.durationInFrames / composition.fps;
  results.baseline = {
    template: "EduVertical",
    frames: composition.durationInFrames,
    renderMs: ms,
    renderSecPerVideoSec: +(ms / 1000 / videoSec).toFixed(2),
  };
  console.log(`baseline: ${ms} ms cho ${videoSec} s video`);
}

writeFileSync(join(outDir, `results-${mode}.json`), `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
