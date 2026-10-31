import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

/**
 * P5-03: render hồi quy fixture Redis bằng EduVertical và render cùng fixture bằng EduLight.
 * Chỉ ghi vào `data/render/P5-03/`; MP4 của P1-04 chỉ được đọc để so PSNR, không ghi đè.
 */

const dataDir = process.env.DATA_DIR ?? join(process.cwd(), "..", "..", "data");
const outDir = join(dataDir, "render", "P5-03");
const p104Mp4 = join(dataDir, "render", "P1-04-edu-vertical-redis.mp4");
mkdirSync(outDir, { recursive: true });

const fixture = JSON.parse(
  readFileSync(
    join(import.meta.dirname, "..", "fixtures", "edu-vertical-redis-props.json"),
    "utf8",
  ),
);
// Giống script P1-04: audio trỏ tới file im lặng, không có `src` nên composition không phát audio.
const audio = { ...fixture.audio, storageKey: "render/P1-04-silence.wav" };
const jobs = [
  {
    id: "EduVertical",
    props: { ...fixture, audio },
    output: join(outDir, "edu-vertical-redis.mp4"),
  },
  {
    id: "EduLight",
    props: { ...fixture, audio, templateId: "EduLight", templateVersion: "1.0.0" },
    output: join(outDir, "edu-light-redis.mp4"),
  },
];

const serveUrl = await bundle({
  entryPoint: join(import.meta.dirname, "..", "src", "index.ts"),
  webpackOverride: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    return config;
  },
});

function ffprobe(path) {
  const raw = execFileSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-count_frames",
      "-show_entries",
      "stream=codec_name,width,height,r_frame_rate,nb_read_frames",
      "-show_entries",
      "format=duration",
      "-of",
      "json",
      path,
    ],
    { encoding: "utf8" },
  );
  const parsed = JSON.parse(raw);
  const stream = parsed.streams?.[0] ?? {};
  return {
    codec: stream.codec_name,
    width: stream.width,
    height: stream.height,
    rFrameRate: stream.r_frame_rate,
    frames: Number(stream.nb_read_frames),
    durationSeconds: Number(parsed.format?.duration),
  };
}

/** PSNR trung bình (dB) giữa hai MP4 cùng kích thước; "inf" nghĩa là từng frame trùng khít. ffmpeg ghi số đo ra stderr. */
function psnr(a, b) {
  const run = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-i", a, "-i", b, "-lavfi", "psnr", "-f", "null", "-"],
    { encoding: "utf8" },
  );
  return run.stderr.match(/PSNR .*average:(\S+)/)?.[1] ?? null;
}

const summary = { remotionVersion: "4.0.539", renders: [] };
for (const job of jobs) {
  const composition = await selectComposition({ serveUrl, id: job.id, inputProps: job.props });
  await renderMedia({
    codec: "h264",
    composition,
    serveUrl,
    outputLocation: job.output,
    inputProps: job.props,
    chromiumOptions: { enableMultiProcessOnLinux: true },
  });
  summary.renders.push({
    composition: job.id,
    durationInFrames: composition.durationInFrames,
    output: job.output,
    ffprobe: ffprobe(job.output),
  });
}

if (existsSync(p104Mp4)) {
  summary.eduVerticalVsP104 = {
    reference: p104Mp4,
    ffprobe: ffprobe(p104Mp4),
    psnrAverage: psnr(jobs[0].output, p104Mp4),
  };
}

console.log(JSON.stringify(summary, null, 2));
