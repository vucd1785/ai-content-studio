import { execFileSync, spawnSync } from "node:child_process";

export function probeWavDurationMs(path: string): number {
  try {
    const raw = execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        path,
      ],
      { encoding: "utf8" },
    ).trim();
    const seconds = Number.parseFloat(raw);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new Error(`invalid duration: ${raw}`);
    }
    return Math.round(seconds * 1000);
  } catch (cause) {
    throw new Error(`ffprobe failed for ${path}: ${String(cause)}`);
  }
}

export type Mp4Probe = {
  width: number;
  height: number;
  fps: string;
  videoCodec: string;
  audioCodec: string;
  nbFrames: number | null;
  durationSeconds: number;
  hasVideo: boolean;
  hasAudio: boolean;
};

export function probeMp4(path: string): Mp4Probe {
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
    { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
  );
  const parsed = JSON.parse(raw) as {
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

  let width = 0;
  let height = 0;
  let fps = "0/1";
  let videoCodec = "";
  let audioCodec = "";
  let nbFrames: number | null = null;
  let hasVideo = false;
  let hasAudio = false;

  for (const stream of parsed.streams ?? []) {
    if (stream.codec_type === "video") {
      hasVideo = true;
      width = stream.width ?? 0;
      height = stream.height ?? 0;
      fps = stream.r_frame_rate ?? fps;
      videoCodec = stream.codec_name ?? "";
      if (stream.nb_frames !== undefined) {
        const n = Number.parseInt(stream.nb_frames, 10);
        nbFrames = Number.isFinite(n) ? n : null;
      }
    }
    if (stream.codec_type === "audio") {
      hasAudio = true;
      audioCodec = stream.codec_name ?? "";
    }
  }

  const durationSeconds = Number.parseFloat(parsed.format?.duration ?? "0");
  if (!hasVideo || !hasAudio || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`MP4 missing streams or duration: ${path}`);
  }

  return {
    width,
    height,
    fps,
    videoCodec,
    audioCodec,
    nbFrames,
    durationSeconds,
    hasVideo,
    hasAudio,
  };
}

export function probeMaxVolumeDb(path: string): number | null {
  try {
    const result = spawnSync(
      "ffmpeg",
      ["-hide_banner", "-i", path, "-af", "volumedetect", "-f", "null", "-"],
      { encoding: "utf8", maxBuffer: 512 * 1024 },
    );
    const text = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    const match = /max_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/u.exec(text);
    if (!match?.[1]) {
      return null;
    }
    return Number.parseFloat(match[1]);
  } catch {
    return null;
  }
}
