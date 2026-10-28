"""Tách từ trên transcript kịch bản (giữ dấu tiếng Việt)."""

from __future__ import annotations

import re

_WORD_RE = re.compile(r"\S+")


def preprocess_transcript(text: str) -> str:
    """Chuẩn hóa ký tự gây tách token lạ (em dash, v.v.)."""
    normalized = re.sub(r"[—\u2014]", " ", text)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip()


def tokenize_transcript_words(text: str) -> list[str]:
    stripped = preprocess_transcript(text)
    if not stripped:
        return []
    raw = _WORD_RE.findall(stripped)
    merged: list[str] = []
    for tok in raw:
        if re.match(r"^[^\w]+$", tok, flags=re.UNICODE) and merged:
            merged[-1] = merged[-1] + tok
        else:
            merged.append(tok)
    return merged


def normalize_for_acoustic(text: str) -> str:
    """Chuẩn hóa nhẹ cho đường CTC: bỏ khoảng thừa, giữ chữ và dấu."""
    collapsed = re.sub(r"\s+", " ", text.strip())
    return collapsed
