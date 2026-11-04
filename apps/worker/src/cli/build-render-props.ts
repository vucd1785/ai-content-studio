import type { AlignResponse } from "@studio/contracts";
import {
  assignWordsToLines,
  buildCaptionsFromSceneAlignments,
  computeSceneTimingPlan,
  type LineWordWarning,
  type RemotionCaption,
  type SceneAlignmentForCaptions,
  type SceneTimingPlan,
} from "@studio/contracts";
import { MVP_FPS } from "@studio/video/render-props/common";
import { PipelineError } from "./paths.js";

/** Một câu trong audio cảnh: ai nói, giọng nào, nằm ở đâu (ms tính từ đầu WAV cảnh). */
export type SceneLineAudio = {
  lineId: string;
  speaker: string;
  voiceId: string;
  text: string;
  wavArtifactId: string;
  startMs: number;
  endMs: number;
};

export type SceneMediaArtifacts = {
  sceneId: string;
  wavArtifactId: string;
  measuredDurationMs: number;
  alignment: AlignResponse;
  /** Câu theo người nói trong cảnh (P6-08). */
  lines?: SceneLineAudio[];
  /** `per_line_fallback` khi cả cảnh trượt cổng và đã căn lại theo nhóm câu (ADR-015). */
  alignmentMode?: "scene" | "per_line_fallback";
};

export function assertAlignmentAccepted(alignment: AlignResponse, sceneId: string): void {
  if (!alignment.validation.ok) {
    throw new PipelineError(
      "alignment_validation_failed",
      `Scene ${sceneId}: ${alignment.validation.errors.join("; ") || "validation failed"}`,
    );
  }
  if (!alignment.gate.passesGate) {
    throw new PipelineError(
      "alignment_gate_failed",
      `Scene ${sceneId}: alignment gate failed (passesGate=false)`,
    );
  }
}

export function buildSceneTimingFromArtifacts(scenes: SceneMediaArtifacts[]): SceneTimingPlan {
  return computeSceneTimingPlan(
    scenes.map((scene) => ({
      sceneId: scene.sceneId,
      measuredDurationMs: scene.measuredDurationMs,
    })),
    MVP_FPS,
  );
}

/** Warning của bước chia từ về câu, kèm cảnh; QA đọc `word_clamped_to_line` (05 mục Alignment). */
export type SceneLineWordWarning = LineWordWarning & { sceneId: string };

/**
 * Phụ đề của script `2` (ADR-015): từ của mỗi cảnh được chia về câu theo thứ tự token, kẹp vào đoạn
 * câu nếu lệch quá dung sai, và mang `speaker` của câu. Template tô màu theo `speaker` (P6-09).
 * Cảnh không có `lines` thì phụ đề không có `speaker`.
 */
export function buildSpeakerCaptions(sceneArtifacts: SceneMediaArtifacts[]): {
  captions: RemotionCaption[];
  warnings: SceneLineWordWarning[];
} {
  for (const scene of sceneArtifacts) {
    assertAlignmentAccepted(scene.alignment, scene.sceneId);
  }
  const plan = buildSceneTimingFromArtifacts(sceneArtifacts);
  const warnings: SceneLineWordWarning[] = [];
  const inputs: SceneAlignmentForCaptions[] = sceneArtifacts.map((scene, index) => {
    const timing = plan.scenes[index];
    if (!timing) {
      throw new PipelineError("render_props_invalid", `Missing timing for ${scene.sceneId}`);
    }
    const base = {
      timing,
      measuredDurationMs: scene.measuredDurationMs,
      validation: scene.alignment.validation,
      alignmentDurationMs: scene.alignment.durationMs,
    };
    if (scene.lines === undefined || scene.lines.length === 0) {
      return { ...base, words: scene.alignment.words };
    }
    const assigned = assignWordsToLines(scene.alignment.words, scene.lines);
    warnings.push(...assigned.warnings.map((w) => ({ ...w, sceneId: scene.sceneId })));
    return { ...base, words: assigned.words, speakers: assigned.speakers };
  });
  return { captions: buildCaptionsFromSceneAlignments(inputs), warnings };
}

export type { SceneTimingPlan };
