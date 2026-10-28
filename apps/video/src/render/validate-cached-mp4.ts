import { execFileSync } from "node:child_process";

export type Mp4StreamSummary = {
  hasVideo: boolean;
  hasAudio: boolean;
  width: number | null;
  height: number | null;
  fps: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  nbFrames: number | null;
  durationSeconds: number | null;
};

function parseFfprobeJson(path: string): unknown {
  const raw = execFileSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames",
      "-show_entries",
      "format=duration",
      "-of",
      "json",
      path,
    ],
    { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 },
  );
  return JSON.parse(raw) as unknown;
}

/** Returns false when ffprobe fails or required streams are missing. */
export function probeMp4Summary(path: string): Mp4StreamSummary | null {
  try {
    const parsed = parseFfprobeJson(path) as {
      streams?: Array<{
        codec_type?: string;
        codec_name?: string;
        width?: number;
        height?: number;
        r_frame_rate?: string;
        nb_frames?: string;
      }>;
      format?: { duration?: string };
    };

    let hasVideo = false;
    let hasAudio = false;
    let width: number | null = null;
    let height: number | null = null;
    let fps: string | null = null;
    let videoCodec: string | null = null;
    let audioCodec: string | null = null;
    let nbFrames: number | null = null;

    for (const stream of parsed.streams ?? []) {
      if (stream.codec_type === "video") {
        hasVideo = true;
        width = stream.width ?? null;
        height = stream.height ?? null;
        fps = stream.r_frame_rate ?? null;
        videoCodec = stream.codec_name ?? null;
        if (stream.nb_frames !== undefined) {
          const n = Number.parseInt(stream.nb_frames, 10);
          nbFrames = Number.isFinite(n) ? n : null;
        }
      }
      if (stream.codec_type === "audio") {
        hasAudio = true;
        audioCodec = stream.codec_name ?? null;
      }
    }

    const durationRaw = parsed.format?.duration;
    const durationSeconds = durationRaw !== undefined ? Number.parseFloat(durationRaw) : Number.NaN;

    return {
      hasVideo,
      hasAudio,
      width,
      height,
      fps,
      videoCodec,
      audioCodec,
      nbFrames,
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
    };
  } catch {
    return null;
  }
}

export function isValidCachedMp4(path: string, minFrames = 1): boolean {
  const summary = probeMp4Summary(path);
  if (!summary) {
    return false;
  }
  if (!summary.hasVideo || !summary.hasAudio) {
    return false;
  }
  if (summary.width !== 1080 || summary.height !== 1920) {
    return false;
  }
  if (summary.nbFrames !== null && summary.nbFrames < minFrames) {
    return false;
  }
  if (summary.durationSeconds === null || summary.durationSeconds <= 0) {
    return false;
  }
  return true;
}
