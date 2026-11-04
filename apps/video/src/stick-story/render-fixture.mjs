// Render fixture StickStory (P6-09). Chạy từ apps/video, qua scripts/with-node24.ps1:
//   node --import tsx src/stick-story/render-fixture.mjs [đường dẫn props.json] [tên đầu ra]
// Không truyền props thì dùng fixture hai nhân vật mặc định của composition.
// Đầu ra: data/stick-story/p6-09/ (ảnh tĩnh, MP4, results-<tên>.json). Không ghi chỗ khác trong data/.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const [propsPath, name = "fixture", publicDir] = process.argv.slice(2);
const here = import.meta.dirname;
const repoRoot = join(here, "..", "..", "..", "..");
const outDir = join(repoRoot, "data", "stick-story", "p6-09");
mkdirSync(join(outDir, "stills"), { recursive: true });

const t0 = performance.now();
const serveUrl = await bundle({
  entryPoint: join(here, "..", "index.ts"),
  ...(publicDir ? { publicDir } : {}),
  webpackOverride: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    return config;
  },
});
const bundleMs = Math.round(performance.now() - t0);
const inputProps = propsPath ? JSON.parse(readFileSync(propsPath, "utf8")) : undefined;
const composition = await selectComposition({
  serveUrl,
  id: "StickStory",
  ...(inputProps ? { inputProps } : {}),
});
const props = inputProps ?? composition.defaultProps;

// Ảnh tĩnh: giữa mỗi shot.
const stills = [];
for (const shot of props.shots) {
  const frame = shot.fromFrame + Math.floor(shot.durationInFrames / 2);
  const output = join(outDir, "stills", `${name}-${shot.shotId}-f${frame}.png`);
  const s = performance.now();
  await renderStill({ composition, serveUrl, inputProps: props, frame, output });
  stills.push({ shotId: shot.shotId, frame, ms: Math.round(performance.now() - s) });
}

const mp4 = join(outDir, `${name}.mp4`);
const s = performance.now();
await renderMedia({ codec: "h264", composition, serveUrl, inputProps: props, outputLocation: mp4 });
const renderMs = Math.round(performance.now() - s);
const probe = execFileSync(
  "ffprobe",
  [
    "-v",
    "error",
    "-show_entries",
    "stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames",
    "-of",
    "json",
    mp4,
  ],
  { encoding: "utf8" },
);
const results = {
  name,
  templateVersion: props.templateVersion,
  frames: composition.durationInFrames,
  bundleMs,
  renderMs,
  renderSecPerVideoSec: +(
    renderMs /
    1000 /
    (composition.durationInFrames / composition.fps)
  ).toFixed(2),
  stills,
  ffprobe: JSON.parse(probe),
};
writeFileSync(join(outDir, `results-${name}.json`), `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
