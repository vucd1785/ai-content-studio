/**
 * Bộ tổng hợp âm thanh tất định (ADR-019): cùng code cho ra cùng mẫu, không dùng mẫu thu âm hay nhạc ngoài.
 * Mono, 16-bit, `SAMPLE_RATE`. Nhạc nền là vòng lặp liền: phần ngân và vang ở cuối được cộng vòng về đầu.
 * File tự chứa (không import) để script `scripts/generate.ts` chạy thẳng bằng Node 24.
 */

export const SAMPLE_RATE = 22050;
const TAU = Math.PI * 2;

type Buf = Float32Array;

/** PRNG mulberry32: tất định theo seed. */
export function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const sec = (s: number) => Math.max(1, Math.round(s * SAMPLE_RATE));

function addInto(out: Buf, src: Buf, start: number, gain: number) {
  for (let i = 0; i < src.length; i++) {
    const j = start + i;
    if (j >= 0 && j < out.length) {
      out[j] = (out[j] as number) + (src[i] as number) * gain;
    }
  }
}

/** Biquad RBJ dùng chung. */
function biquad(
  input: Buf,
  type: "lowpass" | "highpass" | "bandpass",
  freq: number | ((i: number) => number),
  q = Math.SQRT1_2,
): Buf {
  const out = new Float32Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const f = Math.min(SAMPLE_RATE * 0.45, typeof freq === "number" ? freq : freq(i));
    const w = (TAU * f) / SAMPLE_RATE;
    const alpha = Math.sin(w) / (2 * q);
    const cos = Math.cos(w);
    let b0: number;
    let b1: number;
    let b2: number;
    if (type === "lowpass") {
      b0 = (1 - cos) / 2;
      b1 = 1 - cos;
      b2 = b0;
    } else if (type === "highpass") {
      b0 = (1 + cos) / 2;
      b1 = -(1 + cos);
      b2 = b0;
    } else {
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
    }
    const a0 = 1 + alpha;
    const a1 = -2 * cos;
    const a2 = 1 - alpha;
    const x = input[i] as number;
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    out[i] = y;
  }
  return out;
}

function noise(length: number, rand: () => number): Buf {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    out[i] = rand() * 2 - 1;
  }
  return out;
}

// ---------- Nhạc cụ ----------

/** Gảy dây (ukulele, harp, pizzicato): họa âm tắt dần, họa âm cao tắt nhanh hơn. */
export function pluck(freq: number, durSec: number, damp = 1, bright = 1): Buf {
  const n = sec(durSec);
  const out = new Float32Array(n);
  const harmonics = 8;
  for (let k = 1; k <= harmonics; k++) {
    const f = freq * k;
    if (f > SAMPLE_RATE * 0.45) {
      break;
    }
    const amp = (1 / k ** 1.3) * (k === 1 ? 1 : bright);
    const decay = (2.2 + k * 1.6) * damp;
    for (let i = 0; i < n; i++) {
      const t = i / SAMPLE_RATE;
      out[i] = (out[i] as number) + amp * Math.sin(TAU * f * t) * Math.exp(-t * decay);
    }
  }
  envelope(out, 0.003, 0.03);
  return out;
}

/** Chuông nhỏ (glockenspiel): họa âm không hòa âm, ngân dài. */
export function bell(freq: number, durSec: number): Buf {
  const n = sec(durSec);
  const out = new Float32Array(n);
  const partials: [number, number, number][] = [
    [1, 1, 2.2],
    [2.76, 0.35, 5],
    [5.4, 0.15, 9],
    [8.93, 0.06, 14],
  ];
  for (const [ratio, amp, decay] of partials) {
    const f = freq * ratio;
    if (f > SAMPLE_RATE * 0.45) {
      continue;
    }
    for (let i = 0; i < n; i++) {
      const t = i / SAMPLE_RATE;
      out[i] = (out[i] as number) + amp * Math.sin(TAU * f * t) * Math.exp(-t * decay);
    }
  }
  envelope(out, 0.001, 0.05);
  return out;
}

/** Bass mềm: sine và quãng tám, bão hòa nhẹ. */
export function bass(freq: number, durSec: number): Buf {
  const n = sec(durSec);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = 0.55 + 0.45 * Math.exp(-t * 6);
    const s = Math.sin(TAU * freq * t) + 0.25 * Math.sin(TAU * freq * 2 * t);
    out[i] = Math.tanh(s * 1.2) * env;
  }
  envelope(out, 0.006, 0.06);
  return out;
}

/** Pad ấm: ba sine lệch nhẹ, vào và ra chậm. */
export function pad(freq: number, durSec: number): Buf {
  const n = sec(durSec);
  const out = new Float32Array(n);
  const detune = [-0.004, 0, 0.005];
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;
    for (const d of detune) {
      s += Math.sin(TAU * freq * (1 + d) * t + d * 100);
    }
    s += 0.2 * Math.sin(TAU * freq * 2 * t);
    out[i] = s / 3;
  }
  envelope(out, 0.35, 0.5);
  return out;
}

export function kick(): Buf {
  const n = sec(0.35);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const f = 48 + 80 * Math.exp(-t * 28);
    phase += (TAU * f) / SAMPLE_RATE;
    out[i] = Math.sin(phase) * Math.exp(-t * 9);
  }
  envelope(out, 0.001, 0.02);
  return out;
}

export function clap(rand: () => number): Buf {
  const n = sec(0.22);
  const raw = noise(n, rand);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    // Ba tiếng vỗ sát nhau rồi đuôi ngắn.
    const burst = [0, 0.011, 0.022].reduce(
      (acc, at) => acc + (t >= at ? Math.exp(-(t - at) * 90) : 0),
      0,
    );
    raw[i] = (raw[i] as number) * (burst * 0.6 + Math.exp(-t * 18) * 0.5);
  }
  return biquad(raw, "bandpass", 1300, 0.9);
}

export function shaker(rand: () => number): Buf {
  const n = sec(0.09);
  const raw = noise(n, rand);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    raw[i] = (raw[i] as number) * Math.min(1, t / 0.012) * Math.exp(-t * 45);
  }
  return biquad(raw, "highpass", 5200, 0.7);
}

/** Mõ gỗ. */
export function woodblock(freq = 1700): Buf {
  const n = sec(0.08);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    out[i] = (Math.sin(TAU * freq * t) + 0.4 * Math.sin(TAU * freq * 2.5 * t)) * Math.exp(-t * 60);
  }
  envelope(out, 0.0005, 0.01);
  return out;
}

/** Vào/ra tuyến tính để không lách cách ở đầu và cuối nốt. */
function envelope(buf: Buf, attackSec: number, releaseSec: number) {
  const a = sec(attackSec);
  const r = Math.min(sec(releaseSec), buf.length);
  for (let i = 0; i < Math.min(a, buf.length); i++) {
    buf[i] = (buf[i] as number) * (i / a);
  }
  for (let i = 0; i < r; i++) {
    const j = buf.length - 1 - i;
    buf[j] = (buf[j] as number) * (i / r);
  }
}

// ---------- Vang ----------

/** Vang Schroeder đơn giản (4 comb, 2 allpass). */
function reverb(input: Buf, wet: number): Buf {
  const scale = SAMPLE_RATE / 44100;
  const combs = [1116, 1188, 1277, 1356].map((d) => Math.round(d * scale));
  const allpasses = [556, 441].map((d) => Math.round(d * scale));
  const out = new Float32Array(input.length);
  for (const d of combs) {
    const line = new Float32Array(d);
    let idx = 0;
    let store = 0;
    for (let i = 0; i < input.length; i++) {
      const y = line[idx] as number;
      store = y * 0.7 + store * 0.3;
      line[idx] = (input[i] as number) + store * 0.8;
      idx = (idx + 1) % d;
      out[i] = (out[i] as number) + y / combs.length;
    }
  }
  let cur = out;
  for (const d of allpasses) {
    const line = new Float32Array(d);
    let idx = 0;
    const next = new Float32Array(cur.length);
    for (let i = 0; i < cur.length; i++) {
      const buffered = line[idx] as number;
      const x = cur[i] as number;
      next[i] = -x + buffered;
      line[idx] = x + buffered * 0.5;
      idx = (idx + 1) % d;
    }
    cur = next;
  }
  const mixed = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    mixed[i] = (input[i] as number) + (cur[i] as number) * wet;
  }
  return mixed;
}

/** Vang cho vòng lặp: chạy qua hai vòng, giữ vòng thứ hai để đuôi vang của cuối vòng nối vào đầu vòng. */
function loopReverb(loop: Buf, wet: number): Buf {
  const doubled = new Float32Array(loop.length * 2);
  doubled.set(loop, 0);
  doubled.set(loop, loop.length);
  return reverb(doubled, wet).slice(loop.length);
}

// ---------- Nhạc nền ----------

/** Một nốt trên lưới 16 phách mỗi ô nhịp. */
export type Note = { step: number; midi: number; len: number };

export type TrackSpec = {
  bpm: number;
  seed: number;
  /** Hợp âm từng ô nhịp: phần tử đầu là nốt bass, còn lại là nốt hợp âm. Lặp lại tới hết `bars`. */
  chords: readonly (readonly number[])[];
  bars: number;
  strum?: { steps: readonly number[]; gain: number; damp: number; bright: number };
  arp?: { steps: readonly number[]; gain: number; damp: number; octave: number };
  pad?: { gain: number };
  bass: { steps: readonly number[]; gain: number; octaveStep?: number; len: number };
  /** Giai điệu chuông, bước tính từ đầu bài (16 bước một ô nhịp), lặp lại theo độ dài của nó. */
  melody?: { notes: readonly Note[]; lengthBars: number; gain: number };
  drums: {
    kick?: readonly number[];
    clap?: readonly number[];
    shaker?: readonly number[];
    block?: readonly number[];
    gain: number;
  };
  reverb: number;
};

/** Độ dài vòng lặp (giây). */
export function trackLoopSec(spec: Pick<TrackSpec, "bpm" | "bars">): number {
  return (spec.bars * 4 * 60) / spec.bpm;
}

export function renderTrack(spec: TrackSpec): Buf {
  const stepSec = 60 / spec.bpm / 4;
  const loopLen = sec(trackLoopSec(spec));
  const tail = sec(3);
  const out = new Float32Array(loopLen + tail);
  const rand = prng(spec.seed);
  const at = (bar: number, step: number) => Math.round((bar * 16 + step) * stepSec * SAMPLE_RATE);
  // Lệch nhẹ thời điểm và lực đánh cho bớt máy móc.
  const human = () => Math.round((rand() - 0.5) * 0.008 * SAMPLE_RATE);
  const vel = () => 0.85 + rand() * 0.15;

  for (let bar = 0; bar < spec.bars; bar++) {
    const chord = spec.chords[bar % spec.chords.length] as readonly number[];
    const root = chord[0] as number;
    const tones = chord.slice(1);
    if (spec.strum !== undefined) {
      for (const step of spec.strum.steps) {
        const down = step % 4 === 0;
        tones.forEach((m, i) => {
          const order = down ? i : tones.length - 1 - i;
          const offset = Math.round(order * 0.012 * SAMPLE_RATE);
          const note = pluck(midiHz(m), 0.9, spec.strum?.damp, spec.strum?.bright);
          addInto(
            out,
            note,
            at(bar, step) + offset + human(),
            (spec.strum?.gain ?? 0) * vel() * (down ? 1 : 0.7),
          );
        });
      }
    }
    if (spec.arp !== undefined) {
      spec.arp.steps.forEach((step, i) => {
        const m = (tones[i % tones.length] as number) + 12 * (spec.arp?.octave ?? 0);
        const note = pluck(midiHz(m), 0.7, spec.arp?.damp, 0.8);
        addInto(out, note, at(bar, step) + human(), (spec.arp?.gain ?? 0) * vel());
      });
    }
    if (spec.pad !== undefined) {
      const dur = 16 * stepSec + 0.4;
      for (const m of tones) {
        addInto(out, pad(midiHz(m), dur), at(bar, 0), spec.pad.gain / tones.length);
      }
    }
    spec.bass.steps.forEach((step, i) => {
      const octave = spec.bass.octaveStep !== undefined && i % 2 === 1 ? 12 : 0;
      const note = bass(midiHz(root + octave), spec.bass.len * stepSec);
      addInto(out, note, at(bar, step), spec.bass.gain * vel());
    });
    const d = spec.drums;
    for (const step of d.kick ?? []) {
      addInto(out, kick(), at(bar, step), d.gain * 0.9);
    }
    for (const step of d.clap ?? []) {
      addInto(out, clap(rand), at(bar, step) + human(), d.gain * 0.5);
    }
    for (const step of d.shaker ?? []) {
      addInto(out, shaker(rand), at(bar, step) + human(), d.gain * (step % 4 === 2 ? 0.35 : 0.2));
    }
    for (const step of d.block ?? []) {
      addInto(out, woodblock(step % 8 === 0 ? 1500 : 1900), at(bar, step) + human(), d.gain * 0.3);
    }
  }
  if (spec.melody !== undefined) {
    const span = spec.melody.lengthBars * 16;
    for (let start = 0; start < spec.bars * 16; start += span) {
      for (const n of spec.melody.notes) {
        const step = start + n.step;
        if (step >= spec.bars * 16) {
          continue;
        }
        const note = bell(midiHz(n.midi), Math.max(0.6, n.len * stepSec + 0.5));
        addInto(out, note, at(0, step) + human(), spec.melody.gain * vel());
      }
    }
  }

  // Vòng lặp liền: phần ngân quá cuối vòng cộng về đầu vòng.
  const loop = out.slice(0, loopLen);
  for (let i = 0; i < tail; i++) {
    loop[i % loopLen] = (loop[i % loopLen] as number) + (out[loopLen + i] as number);
  }
  const wet = loopReverb(loop, spec.reverb);
  return levelLoop(highpassLoop(wet));
}

/**
 * Đưa các bài về cùng độ to (RMS khoảng -21 dBFS) để đổi bài không phải chỉnh âm lượng trộn;
 * đỉnh không vượt -1 dBFS.
 */
export function levelLoop(buf: Buf, targetRms = 0.09, maxPeak = 0.89): Buf {
  let sum = 0;
  let peak = 0;
  for (const v of buf) {
    sum += v * v;
    peak = Math.max(peak, Math.abs(v));
  }
  const rms = Math.sqrt(sum / Math.max(1, buf.length));
  if (rms === 0) {
    return buf;
  }
  const g = Math.min(targetRms / rms, maxPeak / peak);
  return buf.map((v) => v * g);
}

/** Lọc rung tần thấp (<35 Hz), chạy hai vòng để mép vòng lặp liền. */
function highpassLoop(loop: Buf): Buf {
  const doubled = new Float32Array(loop.length * 2);
  doubled.set(loop, 0);
  doubled.set(loop, loop.length);
  return biquad(doubled, "highpass", 35).slice(loop.length);
}

export function normalize(buf: Buf, peak: number): Buf {
  let max = 0;
  for (const v of buf) {
    max = Math.max(max, Math.abs(v));
  }
  if (max === 0) {
    return buf;
  }
  const g = peak / max;
  return buf.map((v) => v * g);
}

// C D E F G A B: 60 62 64 65 67 69 71
export const TRACKS: Record<string, TrackSpec> = {
  vui_tuoi: {
    bpm: 112,
    seed: 11,
    bars: 16,
    chords: [
      [48, 60, 64, 67],
      [43, 59, 62, 67],
      [45, 60, 64, 69],
      [41, 60, 65, 69],
      [48, 60, 64, 67],
      [43, 59, 62, 67],
      [41, 60, 65, 69],
      [43, 59, 62, 67],
    ],
    strum: { steps: [0, 3, 6, 8, 10, 12, 14], gain: 0.16, damp: 1.3, bright: 1 },
    bass: { steps: [0, 8, 10], gain: 0.45, octaveStep: 1, len: 3 },
    melody: {
      lengthBars: 8,
      gain: 0.16,
      notes: [
        { step: 0, midi: 76, len: 2 },
        { step: 4, midi: 79, len: 2 },
        { step: 8, midi: 84, len: 4 },
        { step: 16, midi: 83, len: 2 },
        { step: 20, midi: 81, len: 2 },
        { step: 24, midi: 79, len: 6 },
        { step: 32, midi: 81, len: 2 },
        { step: 36, midi: 84, len: 2 },
        { step: 40, midi: 88, len: 4 },
        { step: 48, midi: 81, len: 4 },
        { step: 56, midi: 77, len: 8 },
        { step: 64, midi: 76, len: 2 },
        { step: 68, midi: 79, len: 2 },
        { step: 72, midi: 84, len: 2 },
        { step: 76, midi: 88, len: 2 },
        { step: 80, midi: 86, len: 4 },
        { step: 88, midi: 83, len: 4 },
        { step: 96, midi: 81, len: 2 },
        { step: 100, midi: 84, len: 2 },
        { step: 104, midi: 81, len: 2 },
        { step: 108, midi: 77, len: 4 },
        { step: 112, midi: 79, len: 4 },
        { step: 116, midi: 83, len: 4 },
        { step: 120, midi: 86, len: 8 },
      ],
    },
    drums: {
      kick: [0, 8],
      clap: [4, 12],
      shaker: [0, 2, 4, 6, 8, 10, 12, 14],
      gain: 0.5,
    },
    reverb: 0.22,
  },
  to_mo: {
    bpm: 96,
    seed: 23,
    bars: 16,
    chords: [
      [38, 62, 65, 69],
      [43, 62, 67, 71],
      [38, 62, 65, 69],
      [36, 60, 64, 67],
      [34, 62, 65, 70],
      [36, 60, 64, 67],
      [38, 62, 65, 69],
      [45, 61, 64, 69],
    ],
    arp: { steps: [0, 2, 4, 6, 8, 10, 12, 14], gain: 0.2, damp: 3.2, octave: 0 },
    bass: { steps: [0, 6, 8], gain: 0.42, len: 2 },
    melody: {
      lengthBars: 8,
      gain: 0.13,
      notes: [
        { step: 0, midi: 81, len: 4 },
        { step: 12, midi: 84, len: 2 },
        { step: 32, midi: 81, len: 4 },
        { step: 44, midi: 79, len: 2 },
        { step: 64, midi: 82, len: 4 },
        { step: 76, midi: 84, len: 2 },
        { step: 96, midi: 86, len: 4 },
        { step: 112, midi: 85, len: 8 },
      ],
    },
    drums: { kick: [0, 10], block: [4, 12, 14], shaker: [2, 6, 10, 14], gain: 0.45 },
    reverb: 0.25,
  },
  nhe_nhang: {
    bpm: 84,
    seed: 37,
    bars: 16,
    chords: [
      [41, 57, 60, 64, 65],
      [45, 57, 60, 64, 67],
      [38, 57, 60, 62, 65],
      [46, 58, 62, 65, 69],
      [41, 57, 60, 64, 65],
      [45, 57, 60, 64, 67],
      [46, 58, 62, 65, 69],
      [36, 55, 60, 64, 67],
    ],
    pad: { gain: 0.2 },
    arp: { steps: [0, 2, 4, 6, 8, 10, 12, 14], gain: 0.12, damp: 0.9, octave: 1 },
    bass: { steps: [0], gain: 0.35, len: 14 },
    drums: { shaker: [2, 6, 10, 14], gain: 0.3 },
    reverb: 0.4,
  },
  soi_dong: {
    bpm: 128,
    seed: 53,
    bars: 16,
    chords: [
      [43, 59, 62, 67],
      [40, 59, 64, 67],
      [36, 60, 64, 67],
      [38, 57, 62, 66],
    ],
    strum: { steps: [2, 6, 10, 14], gain: 0.14, damp: 2.4, bright: 1.2 },
    bass: { steps: [0, 2, 6, 10, 14], gain: 0.4, octaveStep: 1, len: 1.6 },
    melody: {
      lengthBars: 4,
      gain: 0.12,
      notes: [
        { step: 0, midi: 79, len: 2 },
        { step: 3, midi: 83, len: 2 },
        { step: 6, midi: 86, len: 4 },
        { step: 32, midi: 84, len: 2 },
        { step: 35, midi: 83, len: 2 },
        { step: 38, midi: 81, len: 4 },
      ],
    },
    drums: {
      kick: [0, 4, 8, 12],
      clap: [4, 12],
      shaker: [0, 2, 4, 6, 8, 10, 12, 14],
      gain: 0.55,
    },
    reverb: 0.18,
  },
};

// ---------- Hiệu ứng âm thanh ----------

export function sfxPop(): Buf {
  const n = sec(0.14);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const f = 380 + 700 * Math.exp(-t * 40);
    phase += (TAU * f) / SAMPLE_RATE;
    out[i] = Math.sin(phase) * Math.exp(-t * 30);
  }
  envelope(out, 0.002, 0.02);
  return normalize(out, 0.9);
}

export function sfxWhoosh(): Buf {
  const n = sec(0.5);
  const rand = prng(101);
  const raw = noise(n, rand);
  const shaped = biquad(raw, "bandpass", (i) => 400 + 3200 * Math.sin((Math.PI * i) / n), 1.2);
  for (let i = 0; i < n; i++) {
    const p = i / n;
    shaped[i] = (shaped[i] as number) * Math.sin(Math.PI * p) ** 1.5;
  }
  return normalize(shaped, 0.85);
}

export function sfxDing(): Buf {
  return normalize(bell(midiHz(88), 1.1), 0.85);
}

export function sfxBoing(): Buf {
  const n = sec(0.55);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const f = 160 + 170 * (1 - Math.exp(-t * 8)) + 40 * Math.sin(TAU * 14 * t) * Math.exp(-t * 4);
    phase += (TAU * f) / SAMPLE_RATE;
    out[i] = (Math.sin(phase) + 0.3 * Math.sin(phase * 2)) * Math.exp(-t * 5);
  }
  envelope(out, 0.003, 0.05);
  return normalize(out, 0.85);
}

export function sfxSparkle(): Buf {
  const n = sec(0.9);
  const out = new Float32Array(n);
  [84, 88, 91, 96].forEach((m, i) => {
    addInto(out, bell(midiHz(m), 0.6), sec(0.07 * i), 0.6 - i * 0.08);
  });
  return normalize(out, 0.8);
}

/** Bút lông trên bảng: tiếng xoẹt ngắn ba nét. */
export function sfxScribble(): Buf {
  const n = sec(0.45);
  const rand = prng(202);
  const raw = noise(n, rand);
  const shaped = biquad(raw, "bandpass", (i) => 2400 + 900 * Math.sin((TAU * 3 * i) / n), 2);
  for (let i = 0; i < n; i++) {
    const p = (i / n) * 3;
    const stroke = Math.sin(Math.PI * (p % 1)) ** 2;
    shaped[i] = (shaped[i] as number) * stroke;
  }
  return normalize(shaped, 0.7);
}

export function sfxBlip(): Buf {
  const n = sec(0.09);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    out[i] = Math.sign(Math.sin(TAU * 1320 * t)) * 0.4 * Math.exp(-t * 35);
  }
  envelope(out, 0.002, 0.02);
  return normalize(biquad(out, "lowpass", 4000), 0.7);
}

export const SFX_RENDERERS: Record<string, () => Buf> = {
  sfx_pop: sfxPop,
  sfx_whoosh: sfxWhoosh,
  sfx_ding: sfxDing,
  sfx_boing: sfxBoing,
  sfx_sparkle: sfxSparkle,
  sfx_scribble: sfxScribble,
  sfx_blip: sfxBlip,
};

// ---------- WAV ----------

/** WAV PCM 16-bit mono. */
export function encodeWav(samples: Buf): Uint8Array {
  const dataBytes = samples.length * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) {
      v.setUint8(o + i, s.charCodeAt(i));
    }
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + dataBytes, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, SAMPLE_RATE, true);
  v.setUint32(28, SAMPLE_RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] as number));
    v.setInt16(44 + i * 2, Math.round(s * 32767), true);
  }
  return new Uint8Array(buf);
}
