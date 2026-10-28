from __future__ import annotations

import logging
import re
from dataclasses import dataclass

from app.alignment.schema import AlignmentWord
from app.alignment.tokenize import tokenize_transcript_words

from app.config import WHISPER_CACHE_DIR, WHISPER_MODEL_NAME

logger = logging.getLogger(__name__)

DEFAULT_WHISPER_MODEL = WHISPER_MODEL_NAME


@dataclass(frozen=True)
class WhisperAlignResult:
    words: list[AlignmentWord]
    model_id: str


def align_with_whisper(
    wav_path: str,
    transcript: str,
    model_name: str = DEFAULT_WHISPER_MODEL,
) -> WhisperAlignResult:
    """Dự phòng ADR-005: stable-ts align với transcript đã biết."""
    import stable_whisper  # lazy: optional dependency

    script_words = tokenize_transcript_words(transcript)
    if not script_words:
        return WhisperAlignResult(words=[], model_id=model_name)

    model = stable_whisper.load_model(
        model_name,
        download_root=str(WHISPER_CACHE_DIR) if WHISPER_CACHE_DIR else None,
    )
    result = model.align(
        wav_path,
        transcript.strip(),
        language="vi",
        original_split=True,
    )

    whisper_words: list[tuple[str, int, int]] = []
    for seg in result.segments:
        for w in seg.words:
            if w.word is None:
                continue
            text = w.word.strip()
            if not text:
                continue
            start_ms = int(round((w.start or 0) * 1000))
            end_ms = int(round((w.end or 0) * 1000))
            whisper_words.append((text, start_ms, end_ms))

    mapped = _map_script_to_whisper(script_words, whisper_words)
    return WhisperAlignResult(words=mapped, model_id=model_name)


def _normalize_token(token: str) -> str:
    return re.sub(r"[^\w]", "", token.lower())


def _map_script_to_whisper(
    script_words: list[str],
    whisper_words: list[tuple[str, int, int]],
) -> list[AlignmentWord]:
    """Ghép từ kịch bản với token Whisper theo thứ tự; không bịa thời gian."""
    out: list[AlignmentWord] = []
    j = 0
    for script in script_words:
        norm = _normalize_token(script)
        if not norm:
            out.append(AlignmentWord(text=script, startMs=0, endMs=0))
            continue
        matched = False
        while j < len(whisper_words):
            w_text, start_ms, end_ms = whisper_words[j]
            if _normalize_token(w_text) == norm or norm in _normalize_token(w_text):
                out.append(AlignmentWord(text=script, startMs=start_ms, endMs=end_ms))
                j += 1
                matched = True
                break
            j += 1
        if not matched:
            out.append(AlignmentWord(text=script, startMs=0, endMs=0))
    return out
