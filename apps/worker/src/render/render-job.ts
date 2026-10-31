import { randomUUID } from "node:crypto";
import {
  alignmentArtifactSchema,
  audioManifestArtifactSchema,
  captionTimingOverrideSchema,
  parseScript,
  storyboardArtifactSchema,
} from "@studio/contracts";
import { findLatestRunArtifact, qaJobKeyAfterRender, type StudioDb } from "@studio/db";
import { buildEduVerticalRenderProps, type SceneMediaArtifacts } from "../cli/build-render-props.js";
import { PipelineError } from "../cli/paths.js";
import { readJsonArtifact, writeJsonArtifact } from "../jobs/job-support.js";
import type { RenderBackend } from "./render-backend.js";
import { runStageJob, type StageJobResult } from "./stage-job.js";

export type RenderJobDeps = { dataDir: string; backend: RenderBackend };

/**
 * Job render (P3-06, role `video`, queue `render`): `producing_assets` → `preview_rendering` → `qa`.
 * Dựng `render_props` từ storyboard + audio + alignment (+ `caption_override` nếu có), render preview CRF cao,
 * rồi tạo job QA. Không gọi TTS hay LLM.
 */
export function runRenderJob(db: StudioDb, jobId: string, deps: RenderJobDeps): Promise<StageJobResult> {
  return runStageJob(
    db,
    jobId,
    {
      role: "video",
      enter: { from: "producing_assets", working: "preview_rendering" },
      done: "qa",
      resumeFrom: "preview_rendering",
      precheck: (context) =>
        context.job.idempotencyKey.startsWith("render:") ? null : "not_render_job",
    },
    async (context) => {
      const runId = context.workflowRun.id;
      const [storyboardRow, audioRow, alignmentRow, overrideRow] = await Promise.all([
        findLatestRunArtifact(db, runId, "storyboard"),
        findLatestRunArtifact(db, runId, "audio"),
        findLatestRunArtifact(db, runId, "alignment"),
        findLatestRunArtifact(db, runId, "caption_override"),
      ]);
      const storyboard =
        storyboardRow === null ? null : await readJsonArtifact(deps.dataDir, storyboardRow.storageKey, storyboardArtifactSchema);
      const manifest =
        audioRow === null ? null : await readJsonArtifact(deps.dataDir, audioRow.storageKey, audioManifestArtifactSchema);
      const alignment =
        alignmentRow === null ? null : await readJsonArtifact(deps.dataDir, alignmentRow.storageKey, alignmentArtifactSchema);
      if (storyboard === null || storyboardRow === null) {
        return { ok: false, errorCode: "storyboard_missing", message: "no readable storyboard" };
      }
      if (manifest === null || alignment === null || audioRow === null || alignmentRow === null) {
        return { ok: false, errorCode: "audio_missing", message: "no readable audio or alignment" };
      }

      const sceneArtifacts: SceneMediaArtifacts[] = [];
      for (const scene of manifest.scenes) {
        const aligned = alignment.scenes.find((item) => item.sceneId === scene.sceneId);
        if (aligned === undefined) {
          return { ok: false, errorCode: "audio_missing", message: `no alignment for ${scene.sceneId}` };
        }
        sceneArtifacts.push({ ...scene, alignment: aligned.alignment });
      }
      const captionOverride =
        overrideRow === null
          ? null
          : await readJsonArtifact(deps.dataDir, overrideRow.storageKey, captionTimingOverrideSchema);
      if (overrideRow !== null && captionOverride === null) {
        return { ok: false, errorCode: "caption_override_invalid", message: "caption_override is not readable" };
      }

      const audio = await deps.backend.buildAudio(manifest);
      let props;
      try {
        props = buildEduVerticalRenderProps({
          script: parseScript({
            schemaVersion: 1,
            language: "vi",
            title: storyboard.title,
            hook: storyboard.hook,
            cta: storyboard.cta,
            scenes: storyboard.scenes,
            sources: [],
          }),
          sceneArtifacts,
          audioStorageKey: audio.audioStorageKey,
          totalDurationMs: audio.totalDurationMs,
          audioSrc: audio.audioSrc,
          ...(captionOverride === null ? {} : { captionOverride }),
        });
      } catch (error) {
        if (error instanceof PipelineError) {
          return { ok: false, errorCode: error.code, message: error.message };
        }
        return { ok: false, errorCode: "render_props_invalid", message: error instanceof Error ? error.message : String(error) };
      }

      const rendered = await deps.backend.render("preview", props, audio.audioContentSha256);
      const propsKey = `artifacts/${runId}/render-props-${randomUUID()}.json`;
      const metadata = { idempotencyKey: context.job.idempotencyKey, jobId };
      return {
        ok: true,
        artifacts: [
          {
            type: "render_props",
            schemaVersion: "1",
            contentHash: await writeJsonArtifact(deps.dataDir, propsKey, props),
            storageKey: propsKey,
            metadata: { ...metadata, propsContentHash: rendered.contentHash, audioContentSha256: audio.audioContentSha256 },
          },
          {
            type: "preview",
            schemaVersion: "1",
            contentHash: rendered.contentHash,
            storageKey: rendered.storageKey,
            metadata: { ...metadata, purpose: "preview", cacheHit: rendered.cacheHit },
          },
        ],
        // preview ← render_props ← storyboard, audio, alignment (làm bẩn version).
        dependencies: [[1, 0]],
        parentArtifacts: [
          [0, storyboardRow.id],
          [0, audioRow.id],
          [0, alignmentRow.id],
          ...(overrideRow === null ? [] : ([[0, overrideRow.id]] as [number, string][])),
        ],
        nextJob: (renderJobId) => ({ role: "qa", queue: "media", idempotencyKey: qaJobKeyAfterRender(runId, renderJobId) }),
      };
    },
  );
}
