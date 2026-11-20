import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { audioKitFile, MUSIC_MOODS, MUSIC_TRACKS, SFX_CLIPS, SFX_IDS } from "./index";
import {
  encodeWav,
  levelLoop,
  renderTrack,
  SAMPLE_RATE,
  SFX_RENDERERS,
  sfxPop,
  TRACKS,
  trackLoopSec,
} from "./synth";

const assetsDir = join(__dirname, "..", "assets");

describe("thư viện âm thanh", () => {
  it("mỗi không khí có một bài và đủ mọi SFX trong bộ tổng hợp", () => {
    expect(Object.keys(TRACKS).sort()).toEqual([...MUSIC_MOODS].sort());
    expect(Object.keys(SFX_RENDERERS).sort()).toEqual([...SFX_IDS].sort());
    for (const mood of MUSIC_MOODS) {
      expect(MUSIC_TRACKS[mood].bpm).toBe(TRACKS[mood]?.bpm);
      expect(audioKitFile(`music_${mood}`)).toBe(`music_${mood}.wav`);
    }
    for (const id of SFX_IDS) {
      expect(audioKitFile(id)).toBe(SFX_CLIPS[id].file);
    }
    expect(audioKitFile("music_khong_co")).toBeNull();
  });

  it("file WAV đã tạo khớp đúng code hiện tại (chạy `generate` sau khi sửa bộ tổng hợp)", () => {
    const manifest = JSON.parse(readFileSync(join(assetsDir, "manifest.json"), "utf8")) as Record<
      string,
      { sha256: string }
    >;
    const files = [
      ...MUSIC_MOODS.map((m) => MUSIC_TRACKS[m].file),
      ...SFX_IDS.map((id) => SFX_CLIPS[id].file),
    ];
    for (const file of files) {
      const path = join(assetsDir, file);
      expect(existsSync(path), file).toBe(true);
      const hash = createHash("sha256").update(readFileSync(path)).digest("hex");
      expect(hash, file).toBe(manifest[file]?.sha256);
    }
    // Tất định: tạo lại SFX ngắn cho ra đúng byte đã lưu.
    const pop = createHash("sha256").update(encodeWav(sfxPop())).digest("hex");
    expect(pop).toBe(manifest["sfx_pop.wav"]?.sha256);
  });

  it("vòng lặp nhạc dài đúng số ô nhịp và nối liền không lách cách", () => {
    const spec = { ...(TRACKS.soi_dong as NonNullable<typeof TRACKS.soi_dong>), bars: 4 };
    const loop = renderTrack(spec);
    expect(loop.length).toBe(Math.round(trackLoopSec(spec) * SAMPLE_RATE));
    const jump = Math.abs((loop[0] as number) - (loop[loop.length - 1] as number));
    let typical = 0;
    for (let i = 1; i < loop.length; i++) {
      typical = Math.max(typical, Math.abs((loop[i] as number) - (loop[i - 1] as number)));
    }
    // Bước nhảy ở chỗ nối không lớn hơn bước lớn nhất bên trong bài.
    expect(jump).toBeLessThanOrEqual(typical);
    expect(loop.reduce((m, v) => Math.max(m, Math.abs(v)), 0)).toBeLessThanOrEqual(0.9);
  });

  it("san độ to: RMS về đích, đỉnh không quá giới hạn", () => {
    const quiet = new Float32Array(1000).map((_, i) => Math.sin(i / 5) * 0.01);
    const out = levelLoop(quiet, 0.09, 0.89);
    const rms = Math.sqrt(out.reduce((a, v) => a + v * v, 0) / out.length);
    expect(rms).toBeCloseTo(0.09, 2);
    const spiky = new Float32Array(1000);
    spiky[10] = 0.5;
    expect(Math.max(...levelLoop(spiky, 0.09, 0.89).map(Math.abs))).toBeCloseTo(0.89, 5);
  });
});
