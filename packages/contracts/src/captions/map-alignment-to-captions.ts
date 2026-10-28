import type { AlignmentValidation, AlignmentWord } from "../media/tts.js";
import { SCENE_EDGE_PAD_MS } from "../timing/constants.js";
import type { SceneTiming } from "../timing/scene-duration.js";
import type { RemotionCaption } from "./types.js";

export type CaptionMappingErrorCode =
  | "alignment_validation_failed"
  | "missing_aligned_words"
  | "non_monotonic_timestamps"
  | "word_outside_audio_duration"
  | "empty_alignment_words"
  | "duration_mismatch"
  | "invalid_caption_interval";

export class CaptionMappingError extends Error {
  readonly code: CaptionMappingErrorCode;

  constructor(code: CaptionMappingErrorCode, message: string) {
    super(message);
    this.name = "CaptionMappingError";
    this.code = code;
  }
}

export type SceneAlignmentForCaptions = {
  timing: Pick<SceneTiming, "sceneId" | "fromMs" | "durationMs">;
  /** ffprobe duration of the scene WAV; must match alignment `durationMs`. */
  measuredDurationMs: number;
  words: AlignmentWord[];
  validation: AlignmentValidation;
  /** Audio duration from the align response (ms). */
  alignmentDurationMs: number;
};

function assertDurationMatch(measuredDurationMs: number, alignmentDurationMs: number): void {
  if (Math.abs(measuredDurationMs - alignmentDurationMs) > 1) {
    throw new CaptionMappingError(
      "duration_mismatch",
      `measuredDurationMs (${measuredDurationMs}) differs from alignment durationMs (${alignmentDurationMs})`,
    );
  }
}

/** Rejects alignment artifacts that must not be turned into captions. */
export function assertAlignmentReadyForCaptions(
  words: AlignmentWord[],
  validation: AlignmentValidation,
): void {
  if (words.length === 0) {
    throw new CaptionMappingError("empty_alignment_words", "Alignment has no words");
  }

  if (!validation.ok) {
    throw new CaptionMappingError(
      "alignment_validation_failed",
      validation.errors.join("; ") || "alignment validation failed",
    );
  }

  if (validation.missingWords.length > 0 || validation.alignedWordCount < validation.wordCount) {
    throw new CaptionMappingError(
      "missing_aligned_words",
      `Missing aligned words: ${validation.missingWords.join(", ") || "count mismatch"}`,
    );
  }

  let prevEnd = -1;
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (word === undefined) {
      throw new CaptionMappingError("empty_alignment_words", `Missing word at index ${index}`);
    }
    if (word.endMs <= word.startMs) {
      throw new CaptionMappingError(
        "missing_aligned_words",
        `Invalid interval at index ${index}: ${word.text}`,
      );
    }
    if (word.startMs < prevEnd) {
      throw new CaptionMappingError(
        "non_monotonic_timestamps",
        `Overlapping or out-of-order at index ${index}: ${word.text}`,
      );
    }
    prevEnd = Math.max(prevEnd, word.endMs);
  }
}

function formatCaptionText(wordText: string, index: number): string {
  const trimmed = wordText.replace(/^\s+/, "");
  if (index === 0) {
    if (wordText !== trimmed) {
      throw new CaptionMappingError(
        "invalid_caption_interval",
        "First caption token must not include leading whitespace",
      );
    }
    return trimmed;
  }
  return ` ${trimmed.length > 0 ? trimmed : wordText}`;
}

function clampMs(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Maps one scene's alignment words to global Remotion captions.
 * Narration in the timeline starts after {@link SCENE_EDGE_PAD_MS} from `timing.fromMs`.
 */
export function mapSceneAlignmentToCaptions(input: SceneAlignmentForCaptions): RemotionCaption[] {
  const { timing, measuredDurationMs, words, validation, alignmentDurationMs } = input;

  assertDurationMatch(measuredDurationMs, alignmentDurationMs);
  assertAlignmentReadyForCaptions(words, validation);

  const audioOffsetMs = timing.fromMs + SCENE_EDGE_PAD_MS;
  const sceneEndMs = timing.fromMs + timing.durationMs;
  const audioEndMs = audioOffsetMs + measuredDurationMs;

  const captions: RemotionCaption[] = [];

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (word === undefined) {
      throw new CaptionMappingError("empty_alignment_words", `Missing word at index ${index}`);
    }
    if (word.endMs > alignmentDurationMs + 1) {
      throw new CaptionMappingError(
        "word_outside_audio_duration",
        `Word "${word.text}" ends after audio duration`,
      );
    }

    const startMs = clampMs(Math.round(audioOffsetMs + word.startMs), audioOffsetMs, sceneEndMs);
    let endMs = clampMs(Math.round(audioOffsetMs + word.endMs), startMs, sceneEndMs);
    endMs = clampMs(endMs, startMs, audioEndMs);

    if (endMs <= startMs) {
      throw new CaptionMappingError(
        "invalid_caption_interval",
        `Caption interval collapsed for ${word.text}`,
      );
    }

    captions.push({
      text: formatCaptionText(word.text, index),
      startMs,
      endMs,
      timestampMs: startMs,
      confidence: null,
    });
  }

  if (captions.length > 0) {
    const last = captions[captions.length - 1];
    if (last === undefined) {
      return captions;
    }
    if (last.endMs > sceneEndMs) {
      throw new CaptionMappingError(
        "invalid_caption_interval",
        "Last caption extends beyond scene duration",
      );
    }
  }

  return captions;
}

/** Maps multiple scenes in order; global times use cumulative {@link SceneTiming.fromMs}. */
export function buildCaptionsFromSceneAlignments(
  scenes: SceneAlignmentForCaptions[],
): RemotionCaption[] {
  const all: RemotionCaption[] = [];
  for (const scene of scenes) {
    all.push(...mapSceneAlignmentToCaptions(scene));
  }
  return all;
}
