import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type AlignRequest,
  type AlignResponse,
  type SynthesizeRequest,
  type SynthesizeResponse,
  tokenizeWords,
} from "@studio/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AssetJobError } from "../assets/asset-job.js";
import { resolveLineVoices } from "../assets/voice-job.js";
import { buildSpeakerCaptions } from "./build-render-props.js";
import { probeWavDurationMs } from "./ffprobe.js";
import {
  collectSceneMediaArtifacts,
  groupLinesForFallback,
  LINE_PAUSE_SAME_SPEAKER_MS,
  LINE_PAUSE_SPEAKER_CHANGE_MS,
  type MediaStageStep,
  type VoiceScene,
} from "./media-stage.js";
import { alignmentJsonPath, PipelineError, resolveRepoRoot, ttsWavPath } from "./paths.js";

/**
 * P6-08: TTS giả hai giọng, ghi WAV PCM thật vào `data/tts` như service. Mỗi từ dài 300 ms; giọng
 * khác nhau có biên độ khác nhau. Align giả tìm các đoạn có tiếng trong WAV và chia từ đều trong đoạn,
 * nên căn cả cảnh đã ghép cho ra thời gian đúng với vị trí ghép.
 */
const SAMPLE_RATE = 16_000;
const WORD_MS = 300;
const GATE_POLICY_VERSION = "2.1.0-repair-zero-length";

function pcmWav(samples: Int16Array): Buffer {
  const data = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function voicedSegments(path: string): { startMs: number; endMs: number }[] {
  const buf = readFileSync(path);
  const samples = new Int16Array(buf.buffer, buf.byteOffset + 44, (buf.length - 44) / 2);
  const out: { startMs: number; endMs: number }[] = [];
  let start = -1;
  for (let i = 0; i <= samples.length; i++) {
    const voiced = i < samples.length && samples[i] !== 0;
    if (voiced && start < 0) {
      start = i;
    } else if (!voiced && start >= 0) {
      out.push({
        startMs: Math.round((start / SAMPLE_RATE) * 1000),
        endMs: Math.round((i / SAMPLE_RATE) * 1000),
      });
      start = -1;
    }
  }
  return out;
}

class FakeTts {
  synthCalls: SynthesizeRequest[] = [];
  alignCalls: AlignRequest[] = [];
  /** Transcript nào trượt cổng (mô phỏng Whisper căn kém). */
  failWhen: (req: AlignRequest) => boolean = () => false;
  /** Dời mọi từ (ms) để mô phỏng từ lệch khỏi đoạn câu. */
  skewMs = 0;

  constructor(private readonly dataDir: string) {}

  async synthesize(req: SynthesizeRequest): Promise<SynthesizeResponse> {
    this.synthCalls.push(req);
    const words = tokenizeWords(req.text).length;
    const amplitude = req.voiceId === "Hải Đăng" ? 1000 : 2000;
    const samples = new Int16Array(Math.round((words * WORD_MS * SAMPLE_RATE) / 1000)).fill(
      amplitude,
    );
    const artifactId = randomBytes(16).toString("hex");
    mkdirSync(join(this.dataDir, "tts"), { recursive: true });
    writeFileSync(ttsWavPath(this.dataDir, artifactId), pcmWav(samples));
    return {
      artifactId,
      relativePath: `tts/${artifactId}.wav`,
      durationSeconds: (words * WORD_MS) / 1000,
      sampleRate: SAMPLE_RATE,
      inferenceSeconds: 0.1,
      rtf: 0.1,
      backend: "fake",
      model: "fake",
      voiceId: req.voiceId ?? "Mai Anh",
    };
  }

  async align(req: AlignRequest): Promise<AlignResponse> {
    this.alignCalls.push(req);
    const path = ttsWavPath(this.dataDir, req.audioArtifactId);
    const durationMs = probeWavDurationMs(path);
    const segments = voicedSegments(path);
    const tokens = tokenizeWords(req.transcript);
    const words: AlignResponse["words"] = [];
    let t = 0;
    for (const seg of segments) {
      const n = Math.round((seg.endMs - seg.startMs) / WORD_MS);
      for (let k = 0; k < n && t < tokens.length; k++, t++) {
        const start = seg.startMs + k * WORD_MS + this.skewMs;
        words.push({ text: tokens[t] as string, startMs: start, endMs: start + WORD_MS - 20 });
      }
    }
    const pass = !this.failWhen(req);
    const lastEnd = words.at(-1)?.endMs ?? 0;
    const response: AlignResponse = {
      alignmentArtifactId: req.audioArtifactId,
      audioArtifactId: req.audioArtifactId,
      durationMs,
      transcript: req.transcript,
      engine: "whisper",
      modelId: "fake",
      words,
      validation: {
        ok: true,
        errors: [],
        warnings: [],
        wordCount: tokens.length,
        alignedWordCount: words.length,
        missingWords: [],
        coverageStartMs: words[0]?.startMs ?? null,
        coverageEndMs: lastEnd,
        durationDeltaMs: durationMs - lastEnd,
        nonMonotonicWordRatio: 0,
        timelineOrderRatio: 1,
      },
      gate: {
        alignedWordRatio: 1,
        durationDeltaMs: durationMs - lastEnd,
        coverageWithin250Ms: pass,
        ratioAtLeast90Pct: true,
        validationOk: true,
        passesGate: pass,
        gatePolicyVersion: GATE_POLICY_VERSION,
        trailingSilenceVerified: false,
        trailingSilenceMs: null,
        coverageAcceptanceReason: pass ? "within_250ms" : null,
      },
      processingMs: 7,
    };
    mkdirSync(join(this.dataDir, "alignment"), { recursive: true });
    writeFileSync(
      alignmentJsonPath(this.dataDir, req.audioArtifactId),
      JSON.stringify({ ...response, processingMs: 7 }),
    );
    return response;
  }

  async revalidateGate(req: { audioArtifactId: string }): Promise<AlignResponse> {
    const cached = JSON.parse(
      readFileSync(alignmentJsonPath(this.dataDir, req.audioArtifactId), "utf8"),
    ) as AlignResponse;
    return cached;
  }
}

const TI = "Hải Đăng";
const BIT = "Trúc Ly";

function dialogue(edit = false): VoiceScene[] {
  return [
    {
      sceneId: "mo-dau",
      lines: [
        { lineId: "l1", speaker: "ti", text: "Bit ơi, nếu mình không ngủ?", voiceId: TI },
        {
          lineId: "l2",
          speaker: "bit",
          text: edit ? "Thì cậu sẽ rất mệt." : "Nghe hấp dẫn đấy.",
          voiceId: BIT,
        },
        { lineId: "l3", speaker: "bit", text: "Khoan đã.", voiceId: BIT },
      ],
    },
    {
      sceneId: "ket",
      lines: [{ lineId: "l4", speaker: "ti", text: "Thôi mình đi ngủ.", voiceId: TI }],
    },
  ];
}

describe("voice theo câu, căn theo cảnh (P6-08)", () => {
  let dataDir: string;
  let tts: FakeTts;
  const collect = (voiceScenes: VoiceScene[], hooks = {}) =>
    collectSceneMediaArtifacts({ voiceScenes, dataDir, ttsClient: tts as never, hooks });

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "p608-"));
    tts = new FakeTts(dataDir);
  });
  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("đọc từng câu bằng giọng người nói, ghép cảnh với khoảng nghỉ, căn một lần mỗi cảnh", async () => {
    const { scenes } = await collect(dialogue());
    expect(tts.synthCalls.map((c) => c.voiceId)).toEqual([TI, BIT, BIT, TI]);
    expect(tts.alignCalls.map((c) => c.transcript)).toEqual([
      "Bit ơi, nếu mình không ngủ? Nghe hấp dẫn đấy. Khoan đã.",
      "Thôi mình đi ngủ.",
    ]);
    const [first, second] = scenes;
    // l1: 6 từ = 1800 ms; nghỉ 400 (đổi người nói); l2: 4 từ = 1200; nghỉ 250 (cùng người); l3: 2 từ.
    expect(first?.lines?.map((l) => [l.lineId, l.speaker, l.voiceId, l.startMs, l.endMs])).toEqual([
      ["l1", "ti", TI, 0, 1800],
      ["l2", "bit", BIT, 1800 + LINE_PAUSE_SPEAKER_CHANGE_MS, 3400],
      ["l3", "bit", BIT, 3400 + LINE_PAUSE_SAME_SPEAKER_MS, 4250],
    ]);
    expect(first?.measuredDurationMs).toBe(4250);
    expect(first?.alignmentMode).toBe("scene");
    // Cảnh một câu: WAV cảnh chính là WAV câu, không ghép lại.
    expect(second?.wavArtifactId).toBe(second?.lines?.[0]?.wavArtifactId);
    expect(first?.alignment.words).toHaveLength(12);
  });

  it("phụ đề mang người nói, từ nằm trong đoạn câu, không warning", async () => {
    const { scenes } = await collect(dialogue());
    const { captions, warnings } = buildSpeakerCaptions(scenes);
    expect(warnings).toEqual([]);
    expect(captions.map((c) => c.speaker)).toEqual([
      ...Array(6).fill("ti"),
      ...Array(4).fill("bit"),
      ...Array(2).fill("bit"),
      ...Array(4).fill("ti"),
    ]);
    expect(captions[0]?.text).toBe("Bit");
    expect(captions[6]?.text).toBe(" Nghe");
  });

  it("chạy lại không đọc và không căn lại; sửa một câu chỉ đọc lại câu đó và căn lại cảnh đó", async () => {
    const before = await collect(dialogue());
    tts.synthCalls = [];
    tts.alignCalls = [];
    const again = await collect(dialogue());
    expect(tts.synthCalls).toEqual([]);
    expect(tts.alignCalls).toEqual([]);
    expect(again.timings.synthesizeReused).toBe(4);
    expect(again.scenes[0]?.wavArtifactId).toBe(before.scenes[0]?.wavArtifactId);

    const edited = await collect(dialogue(true));
    expect(tts.synthCalls.map((c) => c.text)).toEqual(["Thì cậu sẽ rất mệt."]);
    expect(tts.alignCalls.map((c) => c.transcript)).toEqual([
      "Bit ơi, nếu mình không ngủ? Thì cậu sẽ rất mệt. Khoan đã.",
    ]);
    expect(edited.scenes[0]?.wavArtifactId).not.toBe(before.scenes[0]?.wavArtifactId);
    expect(edited.scenes[0]?.lines?.[0]?.wavArtifactId).toBe(
      before.scenes[0]?.lines?.[0]?.wavArtifactId,
    );
    expect(edited.scenes[1]?.wavArtifactId).toBe(before.scenes[1]?.wavArtifactId);
  });

  it("cả cảnh trượt cổng: căn lại theo nhóm câu, gộp câu ngắn cùng người nói, thời gian đúng vị trí", async () => {
    tts.failWhen = (req) => req.transcript.startsWith("Bit ơi") && req.transcript.includes("Khoan");
    const { scenes } = await collect(dialogue());
    const scene = scenes[0];
    expect(scene?.alignmentMode).toBe("per_line_fallback");
    // nhóm: [l1] (ti), [l2, l3] (bit, l3 ngắn hơn 1 giây nên gộp)
    expect(tts.alignCalls.map((c) => c.transcript).slice(1, 3)).toEqual([
      "Bit ơi, nếu mình không ngủ?",
      "Nghe hấp dẫn đấy. Khoan đã.",
    ]);
    expect(scene?.alignment.gate.passesGate).toBe(true);
    expect(scene?.alignment.validation.warnings[0]).toBe("per-line fallback: 2 groups");
    const { warnings } = buildSpeakerCaptions(scenes);
    expect(warnings).toEqual([]);
    expect(scene?.alignment.words[6]?.startMs).toBe(scene?.lines?.[1]?.startMs);
  });

  it("dự phòng vẫn trượt cổng thì alignment_gate_failed nêu câu hỏng", async () => {
    tts.failWhen = (req) => req.transcript.includes("Khoan");
    await expect(collect(dialogue())).rejects.toMatchObject({
      code: "alignment_gate_failed",
      message: expect.stringContaining("l2, l3"),
    });
  });

  it("từ lệch quá dung sai bị kẹp về đoạn câu, có warning word_clamped_to_line", async () => {
    tts.skewMs = 250;
    const { scenes } = await collect(dialogue());
    const { captions, warnings } = buildSpeakerCaptions(scenes);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toMatchObject({ code: "word_clamped_to_line", sceneId: "mo-dau" });
    const lines = scenes[0]?.lines ?? [];
    // Từ cuối của l1 bị kẹp về trong đoạn l1 (pad đầu cảnh 200 ms trong timeline).
    const lastTi = captions[5];
    expect(lastTi?.endMs).toBeLessThanOrEqual(200 + (lines[0]?.endMs ?? 0));
  });

  it("tiến độ theo câu; hủy giữa hai câu thì dừng trước câu sau", async () => {
    const steps: MediaStageStep[] = [];
    await collect(dialogue(), { onStep: async (s: MediaStageStep) => void steps.push(s) });
    expect(steps.map((s) => `${s.done}/${s.total} ${s.phase}${s.lineIndex ?? ""}`)).toEqual([
      "1/6 synthesize1",
      "2/6 synthesize2",
      "3/6 synthesize3",
      "4/6 align",
      "5/6 synthesize1",
      "6/6 align",
    ]);

    rmSync(dataDir, { recursive: true, force: true });
    tts = new FakeTts(dataDir);
    let checks = 0;
    const run = collect(dialogue(), { isCancelled: async () => ++checks > 1 });
    await expect(run).rejects.toBeInstanceOf(PipelineError);
    await expect(run).rejects.toMatchObject({ code: "cancelled" });
    expect(tts.synthCalls).toHaveLength(1);
  });
});

describe("gắn giọng theo người nói", () => {
  const scenes = [
    {
      sceneId: "a",
      lines: [
        { id: "l1", speaker: "ti", text: "Chào." },
        { id: "l2", speaker: "narrator", text: "Hôm đó." },
      ],
    },
  ];

  it("nhân vật dùng giọng của mình; narrator dùng giọng kênh hoặc giọng mặc định", () => {
    const characters = new Map([["ti", "Hải Đăng"]]);
    expect(
      resolveLineVoices(scenes, { characters, narratorVoiceId: null }, "Mai Anh")[0]?.lines.map(
        (l) => l.voiceId,
      ),
    ).toEqual(["Hải Đăng", "Mai Anh"]);
    expect(
      resolveLineVoices(scenes, { characters, narratorVoiceId: "Thái Sơn" }, "Mai Anh")[0]?.lines[1]
        ?.voiceId,
    ).toBe("Thái Sơn");
  });

  it("nhân vật nói chưa có giọng: configuration_missing, không đọc bằng giọng khác", () => {
    const run = () =>
      resolveLineVoices(
        scenes,
        { characters: new Map([["ti", null]]), narratorVoiceId: null },
        "Mai Anh",
      );
    expect(run).toThrow(AssetJobError);
    expect(run).toThrow(/ti/);
    try {
      run();
    } catch (error) {
      expect((error as AssetJobError).code).toBe("configuration_missing");
    }
  });
});

describe("nhóm câu cho căn dự phòng", () => {
  it.each([
    [
      "câu ngắn cùng người nói gộp với câu trước",
      [
        ["ti", 2000],
        ["ti", 600],
      ],
      [[0, 1]],
    ],
    [
      "đổi người nói luôn tách",
      [
        ["ti", 600],
        ["bit", 600],
      ],
      [[0], [1]],
    ],
    [
      "hai câu vừa cùng người nói không gộp",
      [
        ["bit", 1500],
        ["bit", 1500],
      ],
      [[0], [1]],
    ],
    [
      "chuỗi câu ngắn cùng người nói gộp đến khi nhóm đủ dài",
      [
        ["ti", 500],
        ["ti", 400],
        ["ti", 300],
        ["ti", 1500],
      ],
      [[0, 1, 2], [3]],
    ],
  ] as const)("%s", (_name, lines, groups) => {
    expect(
      groupLinesForFallback(lines.map(([speaker, durationMs]) => ({ speaker, durationMs }))),
    ).toEqual(groups);
  });
});
