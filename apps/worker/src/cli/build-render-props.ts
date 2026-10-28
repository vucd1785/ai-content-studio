import type { AlignResponse } from "@studio/contracts";
import {
  buildCaptionsFromSceneAlignments,
  computeSceneTimingPlan,
  type SceneAlignmentForCaptions,
  type SceneTimingPlan,
  type Script,
} from "@studio/contracts";
import {
  assertSceneSlotsMatchScript,
  EDU_VERTICAL_TEMPLATE_ID,
  EDU_VERTICAL_TEMPLATE_VERSION,
  type EduVerticalRenderProps,
  MVP_FPS,
  MVP_HEIGHT,
  MVP_WIDTH,
  parseEduVerticalRenderProps,
} from "@studio/video/render-props/schema";
import { PipelineError } from "./paths.js";

export type SceneMediaArtifacts = {
  sceneId: string;
  wavArtifactId: string;
  measuredDurationMs: number;
  alignment: AlignResponse;
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

export function buildEduVerticalRenderProps(input: {
  script: Script;
  sceneArtifacts: SceneMediaArtifacts[];
  audioStorageKey: string;
  totalDurationMs: number;
  audioSrc?: string;
}): EduVerticalRenderProps {
  for (const scene of input.sceneArtifacts) {
    assertAlignmentAccepted(scene.alignment, scene.sceneId);
  }

  const plan = buildSceneTimingFromArtifacts(input.sceneArtifacts);

  const alignmentInputs: SceneAlignmentForCaptions[] = input.sceneArtifacts.map((scene, index) => {
    const timing = plan.scenes[index];
    if (!timing) {
      throw new PipelineError("render_props_invalid", `Missing timing for ${scene.sceneId}`);
    }
    return {
      timing,
      measuredDurationMs: scene.measuredDurationMs,
      words: scene.alignment.words,
      validation: scene.alignment.validation,
      alignmentDurationMs: scene.alignment.durationMs,
    };
  });

  const captions = buildCaptionsFromSceneAlignments(alignmentInputs);

  const scenes: EduVerticalRenderProps["scenes"] = input.script.scenes.map((scene, index) => {
    const timing = plan.scenes[index];
    if (!timing) {
      throw new PipelineError("render_props_invalid", `Missing timing for scene index ${index}`);
    }
    const sceneId = scene.id;
    const base = {
      sceneId,
      fromMs: timing.fromMs,
      durationMs: timing.durationMs,
      onScreenText: scene.onScreenText,
      visualIntent: scene.visualIntent,
    };

    switch (scene.templateSlot) {
      case "title":
        return {
          ...base,
          templateSlot: "title",
          headline: input.script.title,
          hook: input.script.hook,
        };
      case "explain":
        return { ...base, templateSlot: "explain" };
      case "code":
        if (!scene.codeSnippet) {
          throw new PipelineError("render_props_invalid", `Scene ${scene.id} missing codeSnippet`);
        }
        return { ...base, templateSlot: "code", codeSnippet: scene.codeSnippet };
      case "diagram":
        if (!scene.diagram) {
          throw new PipelineError("render_props_invalid", `Scene ${scene.id} missing diagram`);
        }
        return { ...base, templateSlot: "diagram", diagram: scene.diagram };
      case "cta":
        return { ...base, templateSlot: "cta", ctaText: input.script.cta };
    }
    throw new PipelineError("render_props_invalid", `Unsupported slot for ${sceneId}`);
  });

  assertSceneSlotsMatchScript(scenes, input.script.scenes);

  const props: EduVerticalRenderProps = {
    templateId: EDU_VERTICAL_TEMPLATE_ID,
    templateVersion: EDU_VERTICAL_TEMPLATE_VERSION,
    fps: MVP_FPS,
    width: MVP_WIDTH,
    height: MVP_HEIGHT,
    audio: {
      storageKey: input.audioStorageKey,
      durationMs: input.totalDurationMs,
      ...(input.audioSrc ? { src: input.audioSrc } : {}),
    },
    scenes,
    captions,
  };

  return parseEduVerticalRenderProps(props);
}

export type { SceneTimingPlan };
