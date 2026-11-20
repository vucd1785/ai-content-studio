import { join } from "node:path";
import { getFormatPack, type ScriptV2, scriptV2ArtifactSchema } from "@studio/contracts";
import {
  claimJob,
  completeJob,
  findLatestRunArtifact,
  isJobCancelled,
  isStoryboardJobKey,
  JobStateError,
  loadJobContext,
  loadRunBrandProfile,
  recordJobProgress,
  type StudioDb,
} from "@studio/db";
import { frameDimensions } from "@studio/video/render-props/common";
import type { z } from "zod/v4";
import {
  prepareStoryboardAssets,
  type ResolveAssets,
} from "../assets/generate/storyboard-assets.js";
import { applyAssetSubstitutions } from "../assets/generate/substitute.js";
import { runAspectRatio, sceneSlots } from "../cli/build-stick-story-props.js";
import { resolveRepoRoot } from "../cli/paths.js";
import { advanceTransition, readJsonArtifact, writeJsonArtifact } from "../jobs/job-support.js";
import { loadApprovedAssetCatalog } from "../llm/asset-catalog.js";
import type { CatalogEntry } from "../llm/script-v2-prompt.js";
import {
  createDefaultStoryboardRenderer,
  STILL_HOLD_FRAME,
  type StoryboardRenderer,
  stillRenderProps,
} from "./storyboard-backend.js";
import {
  checkStill,
  type StillSpec,
  type StoryboardV2Artifact,
  storyboardV2ArtifactSchema,
} from "./storyboard-checks.js";

/**
 * Job storyboard (P6-10; 04 mục Phase 6; ADR-014): queue `render`, vai `visual`, không gọi LLM.
 * Render một ảnh tĩnh cho mỗi cảnh của cả hai phương án script `2` rồi kiểm tự động.
 * Lỗi render hay lỗi kiểm **không** chặn cổng: job luôn ghi artifact `storyboard` (kèm `errors[]`) và
 * chuyển `storyboarding → waiting_script_approval`. Không ghi approval.
 */

export type StoryboardJobDeps = {
  dataDir: string;
  renderer?: StoryboardRenderer;
  loadAssetCatalog?: (brandSlug: string) => CatalogEntry[];
  /** ADR-017: dùng lại hoặc tạo tài sản cho yêu cầu `creative`. Không có thì cảnh dùng tài sản thay thế. */
  resolveAssets?: ResolveAssets;
  /** `packages/motion-kit/src`; test đặt thư mục tạm. */
  kitSrc?: string;
};

export type StoryboardJobResult =
  | { status: "skipped"; reason: string }
  | { status: "completed"; storyboardArtifactId: string; errorCount: number; issueCount: number };

/** Màu phụ đề theo nhân vật: bảng màu kênh theo thứ tự nhân vật (Tí cam, Bit xanh màn hình, Đậu xanh lá). */
export function speakerColors(
  palette: Record<string, string>,
  characters: readonly { characterKey: string }[],
): Record<string, string> {
  const order = [palette.accent, palette.screen, palette.leaf].filter(
    (c): c is string => typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c),
  );
  return Object.fromEntries(
    characters.map((c, i) => [c.characterKey, order[i % Math.max(1, order.length)] ?? "#ffffff"]),
  );
}

type StillShot = {
  id: string;
  shotSize: string;
  illustration?: unknown;
  props?: readonly string[] | undefined;
};

/** Shot chụp ảnh chính của cảnh: shot đầu có minh họa, không có thì shot đầu. */
export function primaryStillShot<T extends StillShot>(shots: readonly T[]): T | undefined {
  return shots.find((s) => s.illustration !== undefined) ?? shots[0];
}

/** Tối đa số ảnh thêm mỗi cảnh. */
export const MAX_EXTRA_STILLS = 3;

/**
 * Shot cần ảnh thêm (bổ sung 2026-11-12): các shot khác ảnh chính có minh họa hoặc đồ vật, trừ cỡ cận (không vẽ
 * minh họa, đồ vật). Ví dụ cầu vồng ở shot thứ hai của cảnh giải thích.
 */
export function extraStillShots<T extends StillShot>(shots: readonly T[]): T[] {
  const primary = primaryStillShot(shots);
  return shots
    .filter(
      (s) =>
        s !== primary &&
        s.shotSize !== "close" &&
        (s.illustration !== undefined || (s.props ?? []).length > 0),
    )
    .slice(0, MAX_EXTRA_STILLS);
}

/** Ảnh tĩnh của một cảnh: shot chính (hoặc `shotId`), câu neo của shot đó làm phụ đề mẫu (05). */
export function sceneStillSpec(
  script: ScriptV2,
  sceneIndex: number,
  cast: ReadonlyMap<string, { skinAssetId: string }>,
  colors: Record<string, string>,
  shotId?: string,
): StillSpec | null {
  const scene = script.scenes[sceneIndex];
  // Cảnh có minh họa thì chụp shot có minh họa để Director thấy nó ở Cổng 1.
  const shot =
    shotId === undefined
      ? primaryStillShot(scene?.shots ?? [])
      : scene?.shots.find((s) => s.id === shotId);
  if (scene === undefined || shot === undefined) {
    return null;
  }
  const line = scene.lines.find((l) => l.id === shot.lineId) ?? scene.lines[0];
  const slots = sceneSlots(
    scene,
    (character) => cast.get(character)?.skinAssetId ?? `skin_${character}`,
  );
  const placeholders = (script.assetRequests ?? [])
    .filter((req) => req.sceneIds.includes(scene.id))
    .map((req) => req.fallbackAssetId)
    .filter((id) =>
      [
        shot.background,
        shot.camera,
        ...(shot.props ?? []),
        ...(shot.illustration?.items ?? []),
        ...shot.actors.flatMap((a) => [a.action, a.expression]),
      ].includes(id),
    );
  return {
    background: shot.background,
    shotSize: shot.shotSize,
    camera: shot.camera ?? "cam_static",
    focus: shot.focus,
    props: shot.props ?? [],
    ...(shot.mood === undefined ? {} : { mood: shot.mood }),
    ...(shot.effects === undefined ? {} : { effects: [...shot.effects] }),
    ...(shot.illustration === undefined
      ? {}
      : { illustration: { ...shot.illustration, items: [...shot.illustration.items] } }),
    actors: shot.actors.map((a) => ({
      character: a.character,
      skin: cast.get(a.character)?.skinAssetId ?? `skin_${a.character}`,
      action: a.action,
      expression: a.expression,
      ...(a.outfit === undefined ? {} : { outfit: a.outfit }),
      slot: slots.get(a.character) ?? "center",
    })),
    caption: {
      speaker: line?.speaker ?? "narrator",
      text: line?.text ?? "",
      color: colors[line?.speaker ?? ""] ?? "#ffffff",
    },
    placeholderAssetIds: [...new Set(placeholders)],
  };
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export async function runStoryboardJob(
  db: StudioDb,
  jobId: string,
  deps: StoryboardJobDeps,
): Promise<StoryboardJobResult> {
  const context = await loadJobContext(db, jobId);
  if (context === null) {
    return { status: "skipped", reason: "job_not_found" };
  }
  if (context.agentRun.role !== "visual" || !isStoryboardJobKey(context.job.idempotencyKey)) {
    return { status: "skipped", reason: "not_storyboard_job" };
  }
  if (context.job.status === "completed" || context.job.status === "cancelled") {
    return { status: "skipped", reason: `job_${context.job.status}` };
  }
  try {
    await claimJob(db, { jobId, allowedRunStatuses: ["storyboarding"] });
  } catch (error) {
    if (error instanceof JobStateError) {
      return { status: "skipped", reason: error.message };
    }
    throw error;
  }

  const runId = context.workflowRun.id;
  const artifact: StoryboardV2Artifact = {
    schemaVersion: 2,
    scriptArtifactId: null,
    variants: [],
    errors: [],
  };
  try {
    const scriptRow = await findLatestRunArtifact(db, runId, "script");
    const brand = await loadRunBrandProfile(db, runId);
    if (scriptRow === null || scriptRow.schemaVersion !== "2") {
      throw new Error("run không có script schema 2");
    }
    if (brand === null) {
      throw new Error("project không có kênh");
    }
    artifact.scriptArtifactId = scriptRow.id;
    const catalog = (deps.loadAssetCatalog ?? loadApprovedAssetCatalog)(brand.slug);
    const meta = scriptRow.metadata as {
      formatId?: unknown;
      formatVersion?: unknown;
      creativeMode?: unknown;
    };
    const format = getFormatPack(String(meta.formatId), Number(meta.formatVersion));
    if (format === undefined) {
      throw new Error(`gói thể loại lạ: ${String(meta.formatId)} v${String(meta.formatVersion)}`);
    }
    const schema = scriptV2ArtifactSchema({
      cast: brand.characters.map((c) => ({ characterKey: c.characterKey, speaks: c.speaks })),
      assetCatalog: catalog.map((a) => ({ id: a.id, kind: a.kind })),
      format,
      mode: meta.creativeMode === "creative" ? "creative" : "standard",
    });
    const script = await readJsonArtifact(
      deps.dataDir,
      scriptRow.storageKey,
      schema as z.ZodType<{ variants: ScriptV2[] }>,
    );
    if (script === null) {
      throw new Error("không đọc được artifact script schema 2");
    }
    const cast = new Map(brand.characters.map((c) => [c.characterKey, c]));
    const colors = speakerColors(brand.palette, brand.characters);
    const fontFamily = brand.fonts.body ?? "system-ui, 'Segoe UI', sans-serif";
    // Tiến độ thật (ADR-009): số ảnh đã chụp trên tổng cảnh của hai phương án.
    const totalStills = script.variants.reduce((n, v) => n + v.scenes.length, 0);
    let doneStills = 0;
    const progress = (phase: "assets" | "stills") =>
      totalStills > 0
        ? recordJobProgress(db, jobId, {
            done: doneStills,
            total: totalStills,
            unit: "image",
            phase,
          })
        : Promise.resolve(false);
    // ADR-017 mục 2: tài sản mới tạo xong trước khi chụp ảnh; renderer tạo sau để bundle thấy kho mới.
    if (meta.creativeMode === "creative") {
      await progress("assets");
    }
    const assets =
      meta.creativeMode === "creative"
        ? await prepareStoryboardAssets(db, {
            runId,
            agentRunId: context.agentRun.id,
            scriptArtifactId: scriptRow.id,
            topic: context.brief.topic,
            variants: script.variants,
            kitSrc:
              deps.kitSrc ??
              join(resolveRepoRoot(import.meta.url), "packages", "motion-kit", "src"),
            ...(deps.resolveAssets === undefined ? {} : { resolveAssets: deps.resolveAssets }),
          })
        : { substitutions: new Map(), changed: false, errors: [] };
    for (const e of assets.errors) {
      artifact.errors.push({ variantIndex: e.variantIndex, sceneId: null, message: e.message });
    }
    const renderer = deps.renderer ?? createDefaultStoryboardRenderer();
    await progress("stills");
    for (const [vi, original] of script.variants.entries()) {
      const variantIndex = (vi + 1) as 1 | 2;
      const variant = applyAssetSubstitutions(
        original,
        assets.substitutions.get(variantIndex) ?? [],
      );
      const scenes: StoryboardV2Artifact["variants"][number]["scenes"] = [];
      // ADR-022: ảnh storyboard cùng khung với video của run.
      const aspect = runAspectRatio(context.workflowRun.aspectRatio);
      const frameSize = frameDimensions(aspect);
      for (const [si, scene] of variant.scenes.entries()) {
        if (await isJobCancelled(db, jobId)) {
          return { status: "skipped", reason: "cancelled" };
        }
        const spec = sceneStillSpec(variant, si, cast, colors);
        if (spec === null) {
          artifact.errors.push({ variantIndex, sceneId: scene.id, message: "cảnh không có shot" });
          doneStills += 1;
          continue;
        }
        let issues: ReturnType<typeof checkStill> = [];
        try {
          issues = checkStill(spec, frameSize);
        } catch (error) {
          artifact.errors.push({
            variantIndex,
            sceneId: scene.id,
            message: `kiểm hình: ${message(error)}`,
          });
        }
        const stillKey = `artifacts/${runId}/storyboard/v${variantIndex}-${scene.id}.png`;
        let rendered: string | null = stillKey;
        try {
          await renderer.renderStill(
            stillRenderProps(
              spec,
              { fontFamily, textColor: "#ffffff", speakerColors: colors },
              aspect,
            ),
            STILL_HOLD_FRAME,
            join(deps.dataDir, stillKey),
          );
        } catch (error) {
          rendered = null;
          artifact.errors.push({
            variantIndex,
            sceneId: scene.id,
            message: `render ảnh: ${message(error)}`,
          });
        }
        const extraStills: { shotId: string; stillKey: string | null }[] = [];
        for (const extra of extraStillShots(scene.shots)) {
          const extraSpec = sceneStillSpec(variant, si, cast, colors, extra.id);
          if (extraSpec === null) {
            continue;
          }
          const extraKey = `artifacts/${runId}/storyboard/v${variantIndex}-${scene.id}-${extra.id}.png`;
          try {
            await renderer.renderStill(
              stillRenderProps(
                extraSpec,
                {
                  fontFamily,
                  textColor: "#ffffff",
                  speakerColors: colors,
                },
                aspect,
              ),
              STILL_HOLD_FRAME,
              join(deps.dataDir, extraKey),
            );
            extraStills.push({ shotId: extra.id, stillKey: extraKey });
          } catch (error) {
            extraStills.push({ shotId: extra.id, stillKey: null });
            artifact.errors.push({
              variantIndex,
              sceneId: scene.id,
              message: `render ảnh ${extra.id}: ${message(error)}`,
            });
          }
        }
        scenes.push({
          sceneId: scene.id,
          shotId: primaryStillShot(scene.shots)?.id ?? "",
          stillKey: rendered,
          issues,
          ...(extraStills.length === 0 ? {} : { extraStills }),
        });
        doneStills += 1;
        await progress("stills");
      }
      artifact.variants.push({ variantIndex, scenes });
    }
  } catch (error) {
    artifact.errors.push({ variantIndex: null, sceneId: null, message: message(error) });
  }
  return finishStoryboard(db, jobId, deps.dataDir, runId, context.job.idempotencyKey, artifact);
}

async function finishStoryboard(
  db: StudioDb,
  jobId: string,
  dataDir: string,
  runId: string,
  idempotencyKey: string,
  artifact: StoryboardV2Artifact,
): Promise<StoryboardJobResult> {
  const parsed = storyboardV2ArtifactSchema.parse(artifact);
  const key = `artifacts/${runId}/storyboard-${jobId}.json`;
  const contentHash = await writeJsonArtifact(dataDir, key, parsed);
  try {
    const [row] = await completeJob(db, {
      jobId,
      artifacts: [
        {
          type: "storyboard",
          schemaVersion: "2",
          contentHash,
          storageKey: key,
          metadata: {
            idempotencyKey,
            jobId,
            errorCount: parsed.errors.length,
            issueCount: parsed.variants.reduce(
              (n, v) => n + v.scenes.reduce((m, s) => m + s.issues.length, 0),
              0,
            ),
          },
        },
      ],
      ...(parsed.scriptArtifactId === null
        ? {}
        : { parentArtifacts: [[0, parsed.scriptArtifactId]] }),
      runTransition: advanceTransition("storyboarding", "waiting_script_approval"),
    });
    if (row === undefined) {
      throw new Error("complete_job_failed");
    }
    return {
      status: "completed",
      storyboardArtifactId: row.id,
      errorCount: parsed.errors.length,
      issueCount: (row.metadata as { issueCount: number }).issueCount,
    };
  } catch (error) {
    if (error instanceof JobStateError) {
      return { status: "skipped", reason: error.message };
    }
    throw error;
  }
}

/**
 * BullMQ đã hết lượt cho job storyboard (process chết giữa chừng): không đưa run sang `failed` mà vẫn
 * mở cổng script với artifact chỉ có lỗi (04: không có cạnh `storyboarding → failed`).
 */
export async function finishStoryboardAfterCrash(
  db: StudioDb,
  jobId: string,
  dataDir: string,
  error: unknown,
): Promise<boolean> {
  const context = await loadJobContext(db, jobId);
  if (
    context === null ||
    !isStoryboardJobKey(context.job.idempotencyKey) ||
    !["queued", "running"].includes(context.job.status) ||
    context.workflowRun.status !== "storyboarding"
  ) {
    return false;
  }
  if (context.job.status === "queued") {
    await claimJob(db, { jobId, allowedRunStatuses: ["storyboarding"] });
  }
  const scriptRow = await findLatestRunArtifact(db, context.workflowRun.id, "script");
  await finishStoryboard(db, jobId, dataDir, context.workflowRun.id, context.job.idempotencyKey, {
    schemaVersion: 2,
    scriptArtifactId: scriptRow?.id ?? null,
    variants: [],
    errors: [{ variantIndex: null, sceneId: null, message: `worker dừng: ${message(error)}` }],
  });
  return true;
}
