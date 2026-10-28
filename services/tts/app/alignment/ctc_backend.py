from __future__ import annotations

import logging
import re
from dataclasses import dataclass

import torch
import torchaudio.functional as F
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

from app.alignment.audio_io import TARGET_SAMPLE_RATE, waveform_to_tensor
from app.alignment.schema import AlignmentWord
from app.alignment.tokenize import normalize_for_acoustic, tokenize_transcript_words

logger = logging.getLogger(__name__)

DEFAULT_VI_CTC_MODEL = "nguyenvulebinh/wav2vec2-base-vietnamese-250h"


@dataclass(frozen=True)
class CtcAlignResult:
    words: list[AlignmentWord]
    model_id: str


class VietnameseCtcAligner:
    def __init__(self, model_id: str = DEFAULT_VI_CTC_MODEL) -> None:
        self.model_id = model_id
        self._processor: Wav2Vec2Processor | None = None
        self._model: Wav2Vec2ForCTC | None = None

    def _load(self) -> None:
        if self._model is not None:
            return
        self._processor = Wav2Vec2Processor.from_pretrained(self.model_id)
        self._model = Wav2Vec2ForCTC.from_pretrained(self.model_id)
        self._model.eval()

    def align(self, waveform: torch.Tensor, transcript: str) -> CtcAlignResult:
        self._load()
        assert self._processor is not None and self._model is not None

        script_words = tokenize_transcript_words(transcript)
        if not script_words:
            return CtcAlignResult(words=[], model_id=self.model_id)

        acoustic_text = normalize_for_acoustic(transcript)
        acoustic_text = re.sub(r"([.,!?;:])", r" \1 ", acoustic_text)
        acoustic_text = re.sub(r"\s+", " ", acoustic_text).strip().lower()

        batch = waveform_to_tensor(waveform)
        input_values = self._processor(
            batch.squeeze(0).numpy(),
            sampling_rate=TARGET_SAMPLE_RATE,
            return_tensors="pt",
            padding=True,
        )["input_values"]

        with torch.inference_mode():
            logits = self._model(input_values).logits
            emissions = torch.log_softmax(logits, dim=-1)

        tokenized = self._processor.tokenizer(
            acoustic_text,
            return_tensors="pt",
            padding=False,
        )
        targets = tokenized["input_ids"]
        if targets.numel() == 0:
            raise ValueError("empty CTC target after tokenization")

        blank_id = self._processor.tokenizer.pad_token_id
        if blank_id is None:
            blank_id = 0

        alignments, scores = F.forced_align(
            emissions,
            targets,
            blank=blank_id,
        )
        alignments = alignments[0]
        scores = scores[0]

        ratio = waveform.shape[-1] / TARGET_SAMPLE_RATE / emissions.shape[1]
        word_spans = _group_char_alignments(
            alignments,
            scores,
            acoustic_text,
            ratio,
            script_words,
        )
        return CtcAlignResult(words=word_spans, model_id=self.model_id)


def _group_char_alignments(
    alignments: torch.Tensor,
    scores: torch.Tensor,
    acoustic_text: str,
    frame_to_sec: float,
    script_words: list[str],
) -> list[AlignmentWord]:
    """Gom nhãn ký tự CTC thành từ kịch bản (cùng thứ tự, không bịa từ thiếu)."""
    char_spans: list[tuple[str, int, int, float]] = []
    i = 0
    while i < len(alignments):
        label = int(alignments[i].item())
        if label == 0:
            i += 1
            continue
        start = i
        score_sum = float(scores[i].item())
        count = 1
        i += 1
        while i < len(alignments) and int(alignments[i].item()) == label:
            score_sum += float(scores[i].item())
            count += 1
            i += 1
        char_spans.append((str(label), start, i - 1, score_sum / max(count, 1)))

    if not char_spans:
        return [
            AlignmentWord(text=w, startMs=0, endMs=0)
            for w in script_words
        ]

    # Khớp theo độ dài ký tự (bỏ dấu câu trong acoustic) tới từ script
    acoustic_chars = [c for c in acoustic_text if not c.isspace()]
    ptr = 0
    word_timings: list[tuple[int, int, float]] = []
    for word in script_words:
        core = re.sub(r"[^\w]", "", word.lower())
        if not core:
            word_timings.append((0, 0, 0.0))
            continue
        n = len(core)
        if ptr + n > len(char_spans):
            word_timings.append((0, 0, 0.0))
            continue
        chunk = char_spans[ptr : ptr + n]
        start_frame = chunk[0][1]
        end_frame = chunk[-1][2]
        conf = sum(c[3] for c in chunk) / len(chunk)
        word_timings.append((start_frame, end_frame, conf))
        ptr += n

    words: list[AlignmentWord] = []
    for script_word, (start_f, end_f, _conf) in zip(script_words, word_timings, strict=False):
        if end_f <= start_f:
            words.append(AlignmentWord(text=script_word, startMs=0, endMs=0))
            continue
        start_ms = int(round(start_f * frame_to_sec * 1000))
        end_ms = int(round((end_f + 1) * frame_to_sec * 1000))
        words.append(AlignmentWord(text=script_word, startMs=start_ms, endMs=end_ms))
    return words


def align_with_ctc(waveform: torch.Tensor, transcript: str, model_id: str | None = None) -> CtcAlignResult:
    aligner = VietnameseCtcAligner(model_id or DEFAULT_VI_CTC_MODEL)
    return aligner.align(waveform, transcript)
