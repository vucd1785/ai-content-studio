#!/usr/bin/env python3
"""Spike P6-02: căn chữ câu ngắn theo người nói (ADR-015).

Chạy trong container tts, không qua HTTP, để chỉ ghi vào /data/spikes/p6-02 (không đụng /data/tts, /data/alignment):

    docker exec -i ai-content-studio-tts-1 python - < services/tts/scripts/spike_p6_02.py

Dùng đúng engine VieNeu, pipeline căn chữ và cổng alignment hiện hành. Ba thí nghiệm:
  A. căn từng câu (ngắn < 1 s, vừa 1–3 s) với hai giọng;
  B. câu ngắn đệm 300 ms im lặng hai đầu rồi căn;
  C. ghép cả cảnh hội thoại hai giọng (nghỉ 250 ms giữa câu), căn một lần với cả transcript,
     kiểm từ của mỗi câu có nằm trong đoạn của câu đó không.
Hai giọng chỉ để đo, không phải giọng của nhân vật (Director chọn ở P6-08).
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, "/app")

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402

from app import engine  # noqa: E402
from app.alignment.gate import evaluate_go_gate  # noqa: E402
from app.alignment.pipeline import align_transcript_to_wav  # noqa: E402

OUT = Path("/data/spikes/p6-02")
WAV_DIR = OUT / "wav"
ALIGN_DIR = OUT / "alignment"
VOICES = {"a": "Mai Anh", "b": "Hải Đăng"}
PAD_MS = 300
GAP_MS = 250
BOUNDARY_TOLERANCE_MS = 120

SHORT = [
    ("s01", "Tua lại."),
    ("s02", "Thật à?"),
    ("s03", "Ừ."),
    ("s04", "Không!"),
    ("s05", "Chờ đã."),
    ("s06", "Hay đấy."),
    ("s07", "Sai rồi."),
    ("s08", "Đúng vậy."),
    ("s09", "Ôi trời!"),
    ("s10", "Bit ơi!"),
]
MEDIUM = [
    ("m01", "Nếu mình không cần ngủ thì sao?"),
    ("m02", "Thức hai mươi bốn giờ là phản xạ chậm như người say."),
    ("m03", "Thêm tám tiếng mỗi ngày để chơi game!"),
    ("m04", "Đó là sự thật đã được đo trong nghiên cứu."),
    ("m05", "Não của cậu đang đòi lại món nợ."),
    ("m06", "Thôi, mình đi ngủ đây."),
    ("m07", "Redis lưu dữ liệu trong bộ nhớ nên rất nhanh."),
    ("m08", "Nghe hấp dẫn đấy, nhưng khoan đã."),
    ("m09", "Cậu chắc chưa?"),
    ("m10", "Hẹn gặp lại ở tập sau nhé!"),
]
# Cảnh hội thoại: (giọng, id câu). Xen câu ngắn và câu vừa, đổi người nói liên tục.
SCENES = {
    "c1": [("a", "m01"), ("b", "s02"), ("a", "m03"), ("b", "s05"), ("b", "m02")],
    "c2": [("a", "s10"), ("b", "m08"), ("a", "s04"), ("b", "m04"), ("a", "s09")],
    "c3": [("b", "s07"), ("a", "s01"), ("b", "m05"), ("a", "s03"), ("a", "m06")],
    "c4": [("a", "m09"), ("b", "s08"), ("a", "m07"), ("b", "s06"), ("b", "m10")],
}
TEXT = dict(SHORT + MEDIUM)


def gate_row(artifact, wav_path: Path) -> dict[str, object]:
    gate = evaluate_go_gate(artifact, wav_path)
    return {
        "durationMs": artifact.durationMs,
        "words": len(artifact.words),
        "alignedWordRatio": gate["alignedWordRatio"],
        "durationDeltaMs": gate["durationDeltaMs"],
        "validationOk": gate["validationOk"],
        "passesGate": gate["passesGate"],
        "reason": gate["coverageAcceptanceReason"],
        "errors": list(artifact.validation.errors),
        "alignMs": artifact.processingMs,
    }


def save_alignment(name: str, artifact) -> None:
    (ALIGN_DIR / f"{name}.json").write_text(
        json.dumps(artifact.to_json_dict(), ensure_ascii=False, indent=2), encoding="utf-8"
    )


def main() -> int:
    for d in (WAV_DIR, ALIGN_DIR):
        d.mkdir(parents=True, exist_ok=True)
    results: dict[str, object] = {"voices": VOICES, "single": [], "padded": [], "scenes": []}
    audio: dict[tuple[str, str], tuple[np.ndarray, int]] = {}

    # A. Từng câu
    for vkey, voice in VOICES.items():
        for lid, text in SHORT + MEDIUM:
            started = time.perf_counter()
            res = engine.synthesize(text, voice=voice)
            synth_s = time.perf_counter() - started
            wav = WAV_DIR / f"{vkey}-{lid}.wav"
            engine.get_engine().save(res.audio, str(wav))
            data, rate = sf.read(str(wav), dtype="int16")
            audio[(vkey, lid)] = (data, rate)
            art = align_transcript_to_wav(wav, text, f"{vkey}-{lid}", engine="whisper")
            save_alignment(f"{vkey}-{lid}", art)
            row = {"voice": vkey, "id": lid, "kind": "short" if lid.startswith("s") else "medium", "text": text,
                   "synthSec": round(synth_s, 2), **gate_row(art, wav)}
            results["single"].append(row)
            print(json.dumps(row, ensure_ascii=False), flush=True)

    # B. Câu ngắn có đệm im lặng
    for vkey in VOICES:
        for lid, text in SHORT:
            data, rate = audio[(vkey, lid)]
            pad = np.zeros(int(rate * PAD_MS / 1000), dtype=np.int16)
            wav = WAV_DIR / f"{vkey}-{lid}-pad.wav"
            sf.write(str(wav), np.concatenate([pad, data, pad]), rate, subtype="PCM_16")
            art = align_transcript_to_wav(wav, text, f"{vkey}-{lid}-pad", engine="whisper")
            save_alignment(f"{vkey}-{lid}-pad", art)
            row = {"voice": vkey, "id": lid, "text": text, **gate_row(art, wav)}
            results["padded"].append(row)
            print(json.dumps(row, ensure_ascii=False), flush=True)

    # C. Cảnh ghép hai giọng, căn một lần
    for sid, lines in SCENES.items():
        rate = audio[(lines[0][0], lines[0][1])][1]
        gap = np.zeros(int(rate * GAP_MS / 1000), dtype=np.int16)
        chunks: list[np.ndarray] = []
        segments: list[dict[str, object]] = []
        cursor = 0
        for i, (vkey, lid) in enumerate(lines):
            data, r = audio[(vkey, lid)]
            assert r == rate, "sample rate khác nhau giữa hai giọng"
            if i > 0:
                chunks.append(gap)
                cursor += len(gap)
            start_ms = cursor * 1000 / rate
            chunks.append(data)
            cursor += len(data)
            segments.append({"voice": vkey, "id": lid, "text": TEXT[lid], "startMs": start_ms, "endMs": cursor * 1000 / rate})
        wav = WAV_DIR / f"scene-{sid}.wav"
        sf.write(str(wav), np.concatenate(chunks), rate, subtype="PCM_16")
        transcript = " ".join(TEXT[lid] for _, lid in lines)
        art = align_transcript_to_wav(wav, transcript, f"scene-{sid}", engine="whisper")
        save_alignment(f"scene-{sid}", art)
        # Gán từ theo thứ tự cho từng câu, rồi kiểm từ nằm trong đoạn của câu (± dung sai).
        words = list(art.words)
        inside = 0
        total = 0
        per_line = []
        idx = 0
        for seg in segments:
            n = len(str(seg["text"]).split())
            line_words = words[idx: idx + n]
            idx += n
            ok = sum(
                1 for w in line_words
                if w.startMs >= seg["startMs"] - BOUNDARY_TOLERANCE_MS and w.endMs <= seg["endMs"] + BOUNDARY_TOLERANCE_MS
            )
            inside += ok
            total += n
            per_line.append({"id": seg["id"], "words": n, "inside": ok})
        row = {"scene": sid, "lines": len(lines), "boundaryInsideRatio": round(inside / total, 3) if total else 0.0,
               "perLine": per_line, **gate_row(art, wav)}
        results["scenes"].append(row)
        print(json.dumps(row, ensure_ascii=False), flush=True)

    (OUT / "results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print("done", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
