import { spawnSync } from "node:child_process";
import { renameSync, rmSync } from "node:fs";

/**
 * Chuẩn hóa độ to khi render (05 mục Âm thanh, ADR-021): EBU R128 hai lượt bằng `loudnorm` của ffmpeg,
 * đích -14 LUFS (mức YouTube, TikTok, Facebook hạ về), đỉnh thật -1,5 dBTP. Chỉ mã hóa lại audio, giữ nguyên video.
 */
export const TARGET_LUFS = -14;
export const TARGET_TRUE_PEAK = -1.5;
export const TARGET_LRA = 11;

export type LoudnessMeasure = {
  inputI: number;
  inputTp: number;
  inputLra: number;
  inputThresh: number;
  targetOffset: number;
};

/** Đọc khối JSON mà `loudnorm=print_format=json` in ra stderr ở lượt đo. */
export function parseLoudnormJson(stderr: string): LoudnessMeasure | null {
  const start = stderr.lastIndexOf("{");
  const end = stderr.lastIndexOf("}");
  if (start < 0 || end < start) {
    return null;
  }
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(stderr.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const num = (key: string) => {
    const value = Number.parseFloat(String(raw[key]));
    return Number.isFinite(value) ? value : null;
  };
  const inputI = num("input_i");
  const inputTp = num("input_tp");
  const inputLra = num("input_lra");
  const inputThresh = num("input_thresh");
  const targetOffset = num("target_offset");
  if (
    inputI === null ||
    inputTp === null ||
    inputLra === null ||
    inputThresh === null ||
    targetOffset === null
  ) {
    return null;
  }
  return { inputI, inputTp, inputLra, inputThresh, targetOffset };
}

const baseFilter = `loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TRUE_PEAK}:LRA=${TARGET_LRA}`;

/** Đo độ to tích hợp của file; null khi ffmpeg lỗi hoặc file im lặng. */
export function measureLoudness(path: string): LoudnessMeasure | null {
  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostats",
      "-i",
      path,
      "-af",
      `${baseFilter}:print_format=json`,
      "-f",
      "null",
      "-",
    ],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    return null;
  }
  const measure = parseLoudnormJson(result.stderr ?? "");
  // Im lặng: loudnorm báo -inf, không chuẩn hóa được.
  return measure !== null && measure.inputI > -70 ? measure : null;
}

/** Bộ lọc lượt hai, dùng số đo của lượt một để chỉnh tuyến tính (không nén động). */
export function secondPassFilter(m: LoudnessMeasure): string {
  return [
    baseFilter,
    `measured_I=${m.inputI}`,
    `measured_TP=${m.inputTp}`,
    `measured_LRA=${m.inputLra}`,
    `measured_thresh=${m.inputThresh}`,
    `offset=${m.targetOffset}`,
    "linear=true",
  ].join(":");
}

/**
 * Chuẩn hóa MP4 tại chỗ. Trả số đo trước khi chỉnh; null khi file không có tiếng (giữ nguyên file).
 * Lỗi ffmpeg ở lượt hai thì ném lỗi: không để lại MP4 nửa vời.
 */
export function normalizeMp4Loudness(path: string): LoudnessMeasure | null {
  const measure = measureLoudness(path);
  if (measure === null) {
    return null;
  }
  const out = `${path}.loudnorm.mp4`;
  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostats",
      "-y",
      "-i",
      path,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0",
      "-c:v",
      "copy",
      "-af",
      secondPassFilter(measure),
      "-ar",
      "48000",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      out,
    ],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    rmSync(out, { force: true });
    throw new Error(`ffmpeg loudnorm failed: ${(result.stderr ?? "").slice(-400)}`);
  }
  renameSync(out, path);
  return measure;
}
