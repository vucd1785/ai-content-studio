import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  measureLoudness,
  normalizeMp4Loudness,
  parseLoudnormJson,
  secondPassFilter,
  TARGET_LUFS,
} from "./loudness.js";

const STDERR = `[Parsed_loudnorm_0 @ 000001]
{
	"input_i" : "-19.52",
	"input_tp" : "-4.10",
	"input_lra" : "6.30",
	"input_thresh" : "-29.80",
	"output_i" : "-14.02",
	"output_tp" : "-1.50",
	"output_lra" : "5.90",
	"output_thresh" : "-24.30",
	"normalization_type" : "dynamic",
	"target_offset" : "0.02"
}`;

describe("chuẩn hóa độ to (ADR-021)", () => {
  it("đọc số đo của lượt một và dựng bộ lọc lượt hai tuyến tính", () => {
    const m = parseLoudnormJson(STDERR);
    expect(m).toEqual({
      inputI: -19.52,
      inputTp: -4.1,
      inputLra: 6.3,
      inputThresh: -29.8,
      targetOffset: 0.02,
    });
    expect(secondPassFilter(m as NonNullable<typeof m>)).toBe(
      "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=-19.52:measured_TP=-4.1:measured_LRA=6.3:measured_thresh=-29.8:offset=0.02:linear=true",
    );
    expect(parseLoudnormJson("không có json")).toBeNull();
    expect(parseLoudnormJson('{"input_i":"-inf"}')).toBeNull();
  });

  const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
  const dir = mkdtempSync(join(tmpdir(), "loudness-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it.runIf(hasFfmpeg)("đưa MP4 nhỏ tiếng về khoảng -14 LUFS, giữ hình", () => {
    const file = join(dir, "quiet.mp4");
    const made = spawnSync("ffmpeg", [
      "-hide_banner",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=blue:s=108x192:r=30:d=4",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:sample_rate=48000:duration=4",
      "-af",
      "volume=0.05",
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-shortest",
      file,
    ]);
    expect(made.status).toBe(0);
    const before = normalizeMp4Loudness(file);
    expect(before?.inputI).toBeLessThan(-25);
    const after = measureLoudness(file);
    expect(Math.abs((after?.inputI ?? 0) - TARGET_LUFS)).toBeLessThan(1);
  });
});
