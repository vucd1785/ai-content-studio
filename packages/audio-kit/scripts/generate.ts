/**
 * Tạo lại toàn bộ file WAV của thư viện âm thanh (ADR-019): `pnpm --dir packages/audio-kit generate`.
 * Tất định: chạy lại cho ra đúng từng byte; `assets/manifest.json` ghi sha256 để test và worker kiểm.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeWav, renderTrack, SAMPLE_RATE, SFX_RENDERERS, TRACKS } from "../src/synth.ts";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
mkdirSync(outDir, { recursive: true });

const manifest: Record<string, { sha256: string; durationSec: number }> = {};
const write = (file: string, samples: Float32Array) => {
  const bytes = encodeWav(samples);
  writeFileSync(join(outDir, file), bytes);
  manifest[file] = {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    durationSec: Math.round((samples.length / SAMPLE_RATE) * 1000) / 1000,
  };
  console.log(`${file}  ${(bytes.length / 1024).toFixed(0)} KB`);
};

for (const [mood, spec] of Object.entries(TRACKS)) {
  write(`music_${mood}.wav`, renderTrack(spec));
}
for (const [id, render] of Object.entries(SFX_RENDERERS)) {
  write(`${id}.wav`, render());
}
writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
