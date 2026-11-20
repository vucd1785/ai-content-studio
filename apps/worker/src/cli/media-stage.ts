import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { AlignResponse, SynthesizeResponse } from "@studio/contracts";
import { alignResponseSchema } from "@studio/contracts";
import type { TtsMediaClient } from "../media-client.js";
import type { SceneMediaArtifacts } from "./build-render-props.js";
import { probeWavDurationMs } from "./ffprobe.js";
import {
  alignmentJsonPath,
  PipelineError,
  type SynthesizeIndexEntry,
  sha256FileHex,
  sha256Hex,
  synthesizeContentKey,
  synthesizeIndexPath,
  ttsWavPath,
} from "./paths.js";

/**
 * Khoảng nghỉ khi ghép các câu của một cảnh (ADR-015, bổ sung 2026-11-02). Đổi người nói thì nghỉ dài hơn.
 * 250 ms là giá trị spike P6-02 đã căn qua cổng 4/4.
 */
export const LINE_PAUSE_SAME_SPEAKER_MS = 250;
export const LINE_PAUSE_SPEAKER_CHANGE_MS = 400;
/** Câu ngắn hơn mức này được gộp với câu liền kề cùng người nói khi căn dự phòng (spike P6-02). */
export const SHORT_LINE_MS = 1000;

/** Một câu cần đọc: giọng đã được phân giải theo người nói. */
export type VoiceLine = { lineId: string; speaker: string; text: string; voiceId: string };
export type VoiceScene = { sceneId: string; lines: VoiceLine[] };
type LineWav = { line: VoiceLine; artifactId: string };
type Span = { startMs: number; endMs: number };

/** Tổng số bước của job voice: mỗi câu một bước đọc, mỗi cảnh một bước căn. */
export function voiceStepTotal(scenes: readonly VoiceScene[]): number {
  return scenes.reduce((sum, scene) => sum + scene.lines.length + 1, 0);
}

/** Một bước đã xong của job voice (P3-17): đọc một câu, hoặc căn chữ một cảnh. */
export type MediaStageStep = {
  done: number;
  total: number;
  sceneIndex: number;
  sceneCount: number;
  phase: "synthesize" | "align";
  sceneId: string;
  /** Câu vừa đọc (từ 1) trong cảnh; chỉ có ở bước `synthesize`. */
  lineIndex?: number;
  lineCount?: number;
};

/**
 * Móc của job voice (P3-17): `onStep` sau mỗi bước để ghi tiến độ thật; `isCancelled` trước mỗi bước
 * để dừng ngay khi Director hủy, không chạy hết các câu và cảnh còn lại.
 */
export type MediaStageHooks = {
  onStep?: (step: MediaStageStep) => Promise<void>;
  isCancelled?: () => Promise<boolean>;
};

export type MediaStageTimings = {
  synthesizeMs: number;
  alignMs: number;
  synthesizeReused: number;
  alignReused: number;
};

export async function collectSceneMediaArtifacts(input: {
  /** Câu theo người nói (script `2`), giọng đã phân giải. */
  voiceScenes: VoiceScene[];
  dataDir: string;
  ttsClient: TtsMediaClient;
  hooks?: MediaStageHooks;
  /** Cảnh đọc lại (ADR-021): bỏ cache TTS của mọi câu trong cảnh, TTS lấy mẫu lần mới. */
  forceSceneIds?: ReadonlySet<string>;
}): Promise<{ scenes: SceneMediaArtifacts[]; timings: MediaStageTimings }> {
  const plan = input.voiceScenes;
  const timings: MediaStageTimings = {
    synthesizeMs: 0,
    alignMs: 0,
    synthesizeReused: 0,
    alignReused: 0,
  };
  const scenes: SceneMediaArtifacts[] = [];
  const sceneCount = plan.length;
  const total = voiceStepTotal(plan);
  let done = 0;
  const stopIfCancelled = async (where: string) => {
    if (input.hooks?.isCancelled !== undefined && (await input.hooks.isCancelled())) {
      throw new PipelineError("cancelled", `Director đã hủy trước ${where}`);
    }
  };

  for (const [index, scene] of plan.entries()) {
    if (scene.lines.length === 0) {
      throw new PipelineError("schema_invalid", `Scene ${scene.sceneId} không có câu nào`);
    }
    const lineWavs: LineWav[] = [];
    for (const [li, line] of scene.lines.entries()) {
      await stopIfCancelled(
        scene.lines.length === 1
          ? `cảnh ${scene.sceneId}`
          : `câu ${line.lineId} của cảnh ${scene.sceneId}`,
      );
      const synthStart = performance.now();
      const wav = await resolveOrSynthesizeSceneWav({
        dataDir: input.dataDir,
        ttsClient: input.ttsClient,
        text: line.text,
        voiceId: line.voiceId,
        sceneId: scene.sceneId,
        force: input.forceSceneIds?.has(scene.sceneId) === true,
      });
      timings.synthesizeMs += performance.now() - synthStart;
      if (wav.reused) {
        timings.synthesizeReused += 1;
      }
      if (!existsSync(ttsWavPath(input.dataDir, wav.artifactId))) {
        throw new PipelineError(
          "audio_missing",
          `WAV missing for scene ${scene.sceneId}, line ${line.lineId}`,
        );
      }
      lineWavs.push({ line, artifactId: wav.artifactId });
      done += 1;
      await input.hooks?.onStep?.({
        done,
        total,
        sceneIndex: index + 1,
        sceneCount,
        phase: "synthesize",
        sceneId: scene.sceneId,
        lineIndex: li + 1,
        lineCount: scene.lines.length,
      });
    }

    // Một câu: WAV cảnh chính là WAV câu, không ghép lại (giữ cache TTS).
    const joined = joinLineWavs(input.dataDir, lineWavs);
    const measuredDurationMs = probeWavDurationMs(ttsWavPath(input.dataDir, joined.artifactId));
    await stopIfCancelled(`căn chữ cảnh ${scene.sceneId}`);

    const alignStart = performance.now();
    let alignment: AlignResponse;
    let alignmentMode: "scene" | "per_line_fallback" = "scene";
    try {
      const result = await resolveOrAlignScene({
        dataDir: input.dataDir,
        ttsClient: input.ttsClient,
        audioArtifactId: joined.artifactId,
        transcript: scene.lines.map((line) => line.text).join(" "),
        sceneId: scene.sceneId,
      });
      alignment = result.response;
      if (result.reused) {
        timings.alignReused += 1;
      }
    } catch (cause) {
      const gateFailed = cause instanceof PipelineError && cause.code === "alignment_gate_failed";
      if (!gateFailed || lineWavs.length === 1) {
        throw cause;
      }
      alignment = await alignByLineGroups({
        dataDir: input.dataDir,
        ttsClient: input.ttsClient,
        sceneId: scene.sceneId,
        sceneArtifactId: joined.artifactId,
        measuredDurationMs,
        lineWavs,
        spans: joined.spans,
      });
      alignmentMode = "per_line_fallback";
    }
    timings.alignMs += performance.now() - alignStart;

    scenes.push({
      sceneId: scene.sceneId,
      wavArtifactId: joined.artifactId,
      measuredDurationMs,
      alignment,
      alignmentMode,
      lines: lineWavs.map(({ line, artifactId }, i) => {
        const span = joined.spans[i] as Span;
        return {
          lineId: line.lineId,
          speaker: line.speaker,
          voiceId: line.voiceId,
          text: line.text,
          wavArtifactId: artifactId,
          startMs: span.startMs,
          endMs: span.endMs,
        };
      }),
    });
    done += 1;
    await input.hooks?.onStep?.({
      done,
      total,
      sceneIndex: index + 1,
      sceneCount,
      phase: "align",
      sceneId: scene.sceneId,
    });
  }

  return { scenes, timings };
}

type JoinedScene = { artifactId: string; spans: Span[] };

/** WAV PCM đã tách: phần `fmt ` và dữ liệu mẫu. */
type PcmWav = { fmt: Buffer; byteRate: number; blockAlign: number; data: Buffer };

function readPcmWav(path: string): PcmWav {
  const buf = readFileSync(path);
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new PipelineError("audio_build_failed", `Không phải WAV: ${path}`);
  }
  let fmt: Buffer | undefined;
  let data: Buffer | undefined;
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = buf.subarray(offset + 8, Math.min(buf.length, offset + 8 + size));
    if (id === "fmt ") {
      fmt = Buffer.from(body);
    } else if (id === "data") {
      data = body;
    }
    offset += 8 + size + (size % 2);
  }
  if (fmt === undefined || data === undefined || fmt.length < 16 || fmt.readUInt16LE(0) !== 1) {
    throw new PipelineError("audio_build_failed", `WAV không phải PCM: ${path}`);
  }
  return { fmt, byteRate: fmt.readUInt32LE(8), blockAlign: fmt.readUInt16LE(12), data };
}

function writePcmWav(path: string, fmt: Buffer, data: Buffer): void {
  const header = Buffer.alloc(12 + 8 + fmt.length + 8);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(4 + 8 + fmt.length + 8 + data.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(fmt.length, 16);
  fmt.copy(header, 20);
  header.write("data", 20 + fmt.length, "ascii");
  header.writeUInt32LE(data.length, 24 + fmt.length);
  mkdirSync(dirname(path), { recursive: true });
  // Ghi file tạm rồi đổi tên: service TTS không bao giờ đọc phải WAV ghi dở.
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, Buffer.concat([header, data]));
  renameSync(tmp, path);
}

/** Khoảng nghỉ trước câu `i`: 0 cho câu đầu; dài hơn khi đổi người nói. */
function pauseBefore(lineWavs: readonly LineWav[], i: number): number {
  const prev = lineWavs[i - 1];
  const line = lineWavs[i];
  if (prev === undefined || line === undefined) {
    return 0;
  }
  return prev.line.speaker === line.line.speaker
    ? LINE_PAUSE_SAME_SPEAKER_MS
    : LINE_PAUSE_SPEAKER_CHANGE_MS;
}

/**
 * Ghép WAV các câu với khoảng nghỉ hằng số, ghi vào thư mục đầu ra của TTS dưới id 32 hex suy từ
 * id các câu và khoảng nghỉ. Service căn được WAV này qua `POST /align` như mọi WAV khác, nên hợp đồng
 * ADR-005 không đổi. Cùng các câu thì cùng id, nên WAV và alignment của cảnh được dùng lại.
 * Một câu thì dùng thẳng WAV của câu.
 */
export function joinLineWavs(dataDir: string, lineWavs: readonly LineWav[]): JoinedScene {
  const wavs = lineWavs.map(({ artifactId }) => readPcmWav(ttsWavPath(dataDir, artifactId)));
  const first = wavs[0];
  const firstLine = lineWavs[0];
  if (first === undefined || firstLine === undefined) {
    throw new PipelineError("audio_build_failed", "Không có câu để ghép");
  }
  if (lineWavs.length === 1) {
    return {
      artifactId: firstLine.artifactId,
      spans: [{ startMs: 0, endMs: Math.round((first.data.length / first.byteRate) * 1000) }],
    };
  }
  for (const wav of wavs) {
    if (!wav.fmt.equals(first.fmt)) {
      throw new PipelineError("audio_build_failed", "Các câu có định dạng WAV khác nhau");
    }
  }
  const pauses = lineWavs.map((_, i) => pauseBefore(lineWavs, i));
  const artifactId = sha256Hex(
    JSON.stringify({ kind: "scene-concat-v1", lines: lineWavs.map((w) => w.artifactId), pauses }),
  ).slice(0, 32);
  const parts: Buffer[] = [];
  const spans: Span[] = [];
  let bytes = 0;
  wavs.forEach((wav, i) => {
    const frames = Math.round(((pauses[i] ?? 0) / 1000) * (first.byteRate / first.blockAlign));
    const pauseBytes = frames * first.blockAlign;
    if (pauseBytes > 0) {
      parts.push(Buffer.alloc(pauseBytes));
      bytes += pauseBytes;
    }
    const startMs = Math.round((bytes / first.byteRate) * 1000);
    parts.push(wav.data);
    bytes += wav.data.length;
    spans.push({ startMs, endMs: Math.round((bytes / first.byteRate) * 1000) });
  });
  const path = ttsWavPath(dataDir, artifactId);
  if (!existsSync(path)) {
    writePcmWav(path, first.fmt, Buffer.concat(parts));
  }
  return { artifactId, spans };
}

/**
 * Nhóm câu cho căn dự phòng: câu liền nhau cùng người nói được gộp khi nhóm đang có hoặc câu mới
 * ngắn hơn {@link SHORT_LINE_MS}; đổi người nói luôn mở nhóm mới.
 */
export function groupLinesForFallback(
  lines: readonly { speaker: string; durationMs: number }[],
): number[][] {
  const groups: number[][] = [];
  let current: number[] = [];
  let currentMs = 0;
  lines.forEach((line, i) => {
    const prev = lines[i - 1];
    const merge =
      prev !== undefined &&
      prev.speaker === line.speaker &&
      (currentMs < SHORT_LINE_MS || line.durationMs < SHORT_LINE_MS);
    if (!merge && current.length > 0) {
      groups.push(current);
      current = [];
      currentMs = 0;
    }
    current.push(i);
    currentMs += line.durationMs;
  });
  if (current.length > 0) {
    groups.push(current);
  }
  return groups;
}

/**
 * Dự phòng khi cả cảnh trượt cổng: căn từng nhóm câu (spike P6-02: câu vừa qua cổng 20/20), rồi dời
 * thời gian về vị trí trong cảnh. Nhóm nào vẫn trượt thì cả cảnh `alignment_gate_failed`.
 * Mỗi nhóm có WAV riêng (ghép bằng cùng khoảng nghỉ), nên thời gian trong nhóm khớp với WAV cảnh.
 */
async function alignByLineGroups(input: {
  dataDir: string;
  ttsClient: TtsMediaClient;
  sceneId: string;
  sceneArtifactId: string;
  measuredDurationMs: number;
  lineWavs: readonly LineWav[];
  spans: readonly Span[];
}): Promise<AlignResponse> {
  const groups = groupLinesForFallback(
    input.lineWavs.map(({ line }, i) => {
      const span = input.spans[i] as Span;
      return { speaker: line.speaker, durationMs: span.endMs - span.startMs };
    }),
  );
  const parts: { response: AlignResponse; offsetMs: number }[] = [];
  for (const group of groups) {
    const members = group.map((i) => input.lineWavs[i] as LineWav);
    const joined = joinLineWavs(input.dataDir, members);
    try {
      const result = await resolveOrAlignScene({
        dataDir: input.dataDir,
        ttsClient: input.ttsClient,
        audioArtifactId: joined.artifactId,
        transcript: members.map((m) => m.line.text).join(" "),
        sceneId: input.sceneId,
      });
      parts.push({
        response: result.response,
        offsetMs: (input.spans[group[0] ?? 0] as Span).startMs,
      });
    } catch (cause) {
      if (cause instanceof PipelineError && cause.code === "alignment_gate_failed") {
        const lineIds = members.map((m) => m.line.lineId).join(", ");
        throw new PipelineError(
          "alignment_gate_failed",
          `Scene ${input.sceneId}: trượt cổng khi căn cả cảnh và khi căn riêng câu ${lineIds}`,
        );
      }
      throw cause;
    }
  }
  const firstPart = parts[0];
  const lastPart = parts[parts.length - 1];
  if (firstPart === undefined || lastPart === undefined) {
    throw new PipelineError("alignment_failed", `Scene ${input.sceneId}: không có nhóm câu nào`);
  }
  const shift = (v: number | null, offset: number) => (v === null ? null : v + offset);
  const words = parts.flatMap(({ response, offsetMs }) =>
    response.words.map((w) => ({ ...w, startMs: w.startMs + offsetMs, endMs: w.endMs + offsetMs })),
  );
  const wordCount = parts.reduce((n, p) => n + p.response.validation.wordCount, 0);
  const alignedWordCount = parts.reduce((n, p) => n + p.response.validation.alignedWordCount, 0);
  const first = firstPart.response;
  const last = lastPart.response;
  return {
    alignmentArtifactId: input.sceneArtifactId,
    audioArtifactId: input.sceneArtifactId,
    durationMs: input.measuredDurationMs,
    transcript: input.lineWavs.map(({ line }) => line.text).join(" "),
    engine: first.engine,
    modelId: first.modelId,
    words,
    validation: {
      ...last.validation,
      ok: true,
      errors: [],
      warnings: [
        `per-line fallback: ${groups.length} groups`,
        ...parts.flatMap((p) => p.response.validation.warnings),
      ],
      wordCount,
      alignedWordCount,
      missingWords: parts.flatMap((p) => p.response.validation.missingWords),
      coverageStartMs: shift(first.validation.coverageStartMs, firstPart.offsetMs),
      coverageEndMs: shift(last.validation.coverageEndMs, lastPart.offsetMs),
    },
    gate: {
      ...last.gate,
      alignedWordRatio: wordCount === 0 ? 0 : alignedWordCount / wordCount,
      passesGate: true,
    },
    processingMs: parts.reduce((n, p) => n + p.response.processingMs, 0),
  };
}

async function resolveOrSynthesizeSceneWav(input: {
  dataDir: string;
  ttsClient: TtsMediaClient;
  text: string;
  voiceId: string;
  sceneId: string;
  /** Bỏ qua cache; bản đọc mới ghi đè chỉ mục nên lần sau dùng bản này. */
  force?: boolean;
}): Promise<{ artifactId: string; reused: boolean }> {
  const contentKey = synthesizeContentKey(input.text, input.voiceId);
  const indexPath = synthesizeIndexPath(input.dataDir, contentKey);
  if (input.force !== true && existsSync(indexPath)) {
    const entry = JSON.parse(readFileSync(indexPath, "utf8")) as SynthesizeIndexEntry;
    const wavPath = ttsWavPath(input.dataDir, entry.artifactId);
    if (existsSync(wavPath)) {
      return { artifactId: entry.artifactId, reused: true };
    }
  }

  let response: SynthesizeResponse;
  try {
    response = await input.ttsClient.synthesize({ text: input.text, voiceId: input.voiceId });
  } catch (cause) {
    throw new PipelineError(
      "synthesis_failed",
      `Scene ${input.sceneId}: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  mkdirSync(dirname(indexPath), { recursive: true });
  const entry: SynthesizeIndexEntry = {
    artifactId: response.artifactId,
    voiceId: input.voiceId,
    textSha256: contentKey,
  };
  writeFileSync(indexPath, JSON.stringify(entry, null, 2), "utf8");

  return { artifactId: response.artifactId, reused: false };
}

/** Khớp `GATE_POLICY_VERSION` của services/tts (ADR-012, bổ sung 2026-11-04). */
const GATE_POLICY_VERSION = "2.2.0-extend-last-word";

async function resolveOrAlignScene(input: {
  dataDir: string;
  ttsClient: TtsMediaClient;
  audioArtifactId: string;
  transcript: string;
  sceneId: string;
}): Promise<{ response: AlignResponse; reused: boolean; revalidated?: boolean }> {
  const jsonPath = alignmentJsonPath(input.dataDir, input.audioArtifactId);
  if (existsSync(jsonPath)) {
    let cached: Record<string, unknown>;
    try {
      cached = JSON.parse(readFileSync(jsonPath, "utf8")) as Record<string, unknown>;
    } catch {
      cached = {};
    }

    if (String(cached.transcript ?? "").trim() === input.transcript.trim()) {
      try {
        const parsed = alignResponseSchema.parse({
          alignmentArtifactId: input.audioArtifactId,
          audioArtifactId: input.audioArtifactId,
          durationMs: cached.durationMs,
          transcript: cached.transcript,
          engine: cached.engine,
          modelId: cached.modelId,
          words: cached.words,
          validation: cached.validation,
          gate: cached.gate,
          processingMs: cached.processingMs ?? 0,
        });
        if (
          parsed.validation.ok &&
          parsed.gate.passesGate &&
          parsed.gate.gatePolicyVersion === GATE_POLICY_VERSION
        ) {
          return { response: parsed, reused: true };
        }
      } catch {
        // schema cũ hoặc gate chưa cập nhật → revalidate
      }

      try {
        const revalidated = await input.ttsClient.revalidateGate({
          audioArtifactId: input.audioArtifactId,
        });
        if (!revalidated.validation.ok || !revalidated.gate.passesGate) {
          throw new PipelineError(
            "alignment_gate_failed",
            `Scene ${input.sceneId}: gate still fails after revalidation`,
          );
        }
        return { response: revalidated, reused: true, revalidated: true };
      } catch (cause) {
        if (cause instanceof PipelineError) {
          throw cause;
        }
        throw new PipelineError(
          "alignment_failed",
          `Scene ${input.sceneId}: revalidate-gate failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      }
    }
  }

  let response: AlignResponse;
  try {
    response = await input.ttsClient.align({
      audioArtifactId: input.audioArtifactId,
      transcript: input.transcript,
    });
  } catch (cause) {
    throw new PipelineError(
      "alignment_failed",
      `Scene ${input.sceneId}: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  if (!response.validation.ok || !response.gate.passesGate) {
    throw new PipelineError(
      "alignment_gate_failed",
      `Scene ${input.sceneId}: alignment gate failed after align`,
    );
  }

  return { response, reused: false };
}

export function preparePublicAudioAsset(input: {
  dataDir: string;
  combinedWavPath: string;
  storageKey: string;
}): string {
  const publicRoot = join(input.dataDir, "render", "public");
  const dest = join(publicRoot, input.storageKey);
  mkdirSync(dirname(dest), { recursive: true });
  if (!existsSync(dest) || sha256FileHex(dest) !== sha256FileHex(input.combinedWavPath)) {
    copyFileSync(input.combinedWavPath, dest);
  }
  return dest;
}
