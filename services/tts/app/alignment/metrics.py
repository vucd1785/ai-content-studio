"""Backward-compatible re-export; gate logic lives in gate.py."""

from app.alignment.gate import aligned_word_ratio, evaluate_go_gate

__all__ = ["aligned_word_ratio", "evaluate_go_gate"]
