"""Forced alignment spike (P0-04). Tách khỏi engine TTS."""

from app.alignment.schema import AlignmentArtifact, AlignmentWord

__all__ = ["align_transcript_to_wav", "AlignmentArtifact", "AlignmentWord"]


def __getattr__(name: str) -> object:
    if name == "align_transcript_to_wav":
        from app.alignment.pipeline import align_transcript_to_wav

        return align_transcript_to_wav
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
