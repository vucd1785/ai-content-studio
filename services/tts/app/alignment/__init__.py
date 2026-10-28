"""Forced alignment spike (P0-04). Tách khỏi engine TTS."""

from app.alignment.pipeline import align_transcript_to_wav
from app.alignment.schema import AlignmentArtifact, AlignmentWord

__all__ = ["align_transcript_to_wav", "AlignmentArtifact", "AlignmentWord"]
