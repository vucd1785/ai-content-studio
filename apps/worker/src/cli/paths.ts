import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type PipelineErrorCode =
  | "schema_invalid"
  | "tts_unavailable"
  | "synthesis_failed"
  | "alignment_failed"
  | "alignment_gate_failed"
  | "alignment_validation_failed"
  | "audio_missing"
  | "audio_build_failed"
  | "render_failed"
  | "render_props_invalid";

export class PipelineError extends Error {
  readonly code: PipelineErrorCode;

  constructor(code: PipelineErrorCode, message: string) {
    super(message);
    this.name = "PipelineError";
    this.code = code;
  }
}

export function resolveRepoRoot(fromModuleUrl: string): string {
  let dir = dirname(fileURLToPath(fromModuleUrl));
  for (let depth = 0; depth < 10; depth += 1) {
    const candidate = join(dir, "fixtures", "script.edu.json");
    if (existsSync(candidate)) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new PipelineError("schema_invalid", "Could not locate repository root");
}

export function resolveDataDir(repoRoot: string): string {
  const raw = process.env.DATA_DIR?.trim();
  if (raw && raw.length > 0) {
    return raw.startsWith("/") || /^[A-Za-z]:[\\/]/.test(raw) ? raw : join(repoRoot, raw);
  }
  return join(repoRoot, "data");
}

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function sha256FileHex(path: string): string {
  return sha256Hex(readFileSync(path));
}

export function ttsWavPath(dataDir: string, artifactId: string): string {
  return join(dataDir, "tts", `${artifactId.toLowerCase()}.wav`);
}

export function alignmentJsonPath(dataDir: string, artifactId: string): string {
  return join(dataDir, "alignment", `${artifactId.toLowerCase()}.json`);
}

export const TTS_CONTENT_INDEX_DIR = "tts/content-index";

export function synthesizeIndexPath(dataDir: string, contentKey: string): string {
  return join(dataDir, TTS_CONTENT_INDEX_DIR, `${contentKey}.json`);
}

export type SynthesizeIndexEntry = {
  artifactId: string;
  voiceId: string;
  textSha256: string;
};

export function synthesizeContentKey(text: string, voiceId: string): string {
  return sha256Hex(`${voiceId}\0${text}`);
}
