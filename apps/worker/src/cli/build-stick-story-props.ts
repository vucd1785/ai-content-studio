import {
  assignWordsToLines,
  checkPacing,
  type FormatPack,
  MAX_ACTORS_BY_SHOT_SIZE,
  msToFrames,
  normalizeWord,
  type PacingViolation,
  SCENE_EDGE_PAD_MS,
  type ScriptV2,
  type ShotSize,
} from "@studio/contracts";
import {
  parseStickStoryRenderProps,
  STICK_STORY_MOTION_KIT_VERSION,
  STICK_STORY_TEMPLATE_ID,
  type StickStoryRenderProps,
  stickStoryTemplateVersion,
} from "@studio/video/stick-story/props";
import {
  buildSceneTimingFromArtifacts,
  buildSpeakerCaptions,
  type SceneLineWordWarning,
  type SceneMediaArtifacts,
} from "./build-render-props.js";
import { PipelineError } from "./paths.js";

/** Cắt cảnh trước từ khóa 2 frame (ADR-014, 05 mục Template `StickStory`). */
export const CUT_LEAD_FRAMES = 2;

export type CastMemberLook = {
  characterKey: string;
  /** `brand_characters.skin_asset_id`. */
  skinAssetId: string;
  /** Màu phụ đề của nhân vật. */
  color: string;
};

export type StickStoryWarning =
  | SceneLineWordWarning
  | { code: "cut_word_not_found"; sceneId: string; shotId: string; cutOnWord: string }
  | { code: "pacing_violation"; violation: PacingViolation }
  | { code: "pacing_fixed"; shotId: string; action: "split" | "shot_size_changed" };

type Slot = "left" | "center" | "right";
type TimedShot = StickStoryRenderProps["shots"][number];

/**
 * Vị trí đứng theo luật liền mạch (P6-01): trong một cảnh, nhân vật xuất hiện đầu tiên đứng bên trái,
 * người thứ hai bên phải, người thứ ba ở giữa, và giữ nguyên bên đó qua mọi shot của cảnh.
 */
export function assignSlots(shots: readonly { actors: readonly { character: string }[] }[]) {
  const order: Slot[] = ["left", "right", "center"];
  const slots = new Map<string, Slot>();
  for (const shot of shots) {
    for (const actor of shot.actors) {
      if (!slots.has(actor.character)) {
        slots.set(actor.character, order[slots.size] ?? "center");
      }
    }
  }
  return slots;
}

/**
 * Cỡ cảnh thay thế khi phải đổi để hai shot liền nhau không trùng (05: `medium` ↔ `close`).
 * Shot ba người chỉ đổi giữa `wide` và `high` (bổ sung ADR-013 2026-11-03).
 */
function alternateSize(
  size: ShotSize,
  avoid: readonly (ShotSize | undefined)[],
  actorCount: number,
): ShotSize {
  const prefs: Record<ShotSize, ShotSize[]> = {
    medium: ["close", "wide", "high"],
    close: ["medium", "wide", "high"],
    wide: ["medium", "close", "high"],
    high: ["medium", "close", "wide"],
  };
  return (
    prefs[size].find((s) => !avoid.includes(s) && MAX_ACTORS_BY_SHOT_SIZE[s] >= actorCount) ?? size
  );
}

/**
 * Sửa luật nhịp bằng code (05): shot dài hơn `maxStaticSec` được chia đều, các phần xen kẽ cỡ cảnh
 * thay thế, giữ nguyên nhân vật và hành động; hai shot liền nhau trùng cỡ thì đổi cỡ của shot sau.
 */
export function fixPacing(
  shots: readonly TimedShot[],
  pack: FormatPack,
  fps: number,
): { shots: TimedShot[]; warnings: StickStoryWarning[] } {
  const warnings: StickStoryWarning[] = [];
  const maxFrames = Math.floor(pack.pacing.maxStaticSec * fps);
  const split: TimedShot[] = [];
  for (const shot of shots) {
    if (shot.durationInFrames <= maxFrames) {
      split.push(shot);
      continue;
    }
    const parts = Math.ceil(shot.durationInFrames / maxFrames);
    const base = Math.floor(shot.durationInFrames / parts);
    let from = shot.fromFrame;
    for (let k = 0; k < parts; k++) {
      const len = k === parts - 1 ? shot.fromFrame + shot.durationInFrames - from : base;
      split.push({
        ...shot,
        shotId: k === 0 ? shot.shotId : `${shot.shotId}${String.fromCharCode(97 + k)}`,
        fromFrame: from,
        durationInFrames: len,
      });
      from += len;
    }
    warnings.push({ code: "pacing_fixed", shotId: shot.shotId, action: "split" });
  }
  if (pack.pacing.noSameShotSizeInARow) {
    for (let i = 1; i < split.length; i++) {
      const prev = split[i - 1] as TimedShot;
      const cur = split[i] as TimedShot;
      if (prev.shotSize === cur.shotSize) {
        const next = split[i + 1];
        split[i] = {
          ...cur,
          shotSize: alternateSize(cur.shotSize, [prev.shotSize, next?.shotSize], cur.actors.length),
        };
        warnings.push({ code: "pacing_fixed", shotId: cur.shotId, action: "shot_size_changed" });
      }
    }
  }
  return { shots: split, warnings };
}

/**
 * Dựng `render_props` của `StickStory` từ phương án script `2` đã duyệt và audio, alignment theo câu
 * (P6-08). Code tính frame cắt, vị trí đứng, khoảng mở miệng; sửa luật nhịp được thì sửa, còn lại
 * thành warning `pacing_violation` cho QA.
 */
export function buildStickStoryRenderProps(input: {
  script: ScriptV2;
  sceneArtifacts: SceneMediaArtifacts[];
  cast: readonly CastMemberLook[];
  format: FormatPack;
  brand: {
    fontFamily: string;
    textColor: string;
    introAssetId?: string | null;
    outroAssetId?: string | null;
  };
  audioStorageKey: string;
  totalDurationMs: number;
  audioSrc?: string;
}): { props: StickStoryRenderProps; warnings: StickStoryWarning[] } {
  const fps = 30;
  const castByKey = new Map(input.cast.map((c) => [c.characterKey, c]));
  const { captions, warnings: lineWarnings } = buildSpeakerCaptions(input.sceneArtifacts);
  const warnings: StickStoryWarning[] = [...lineWarnings];
  const plan = buildSceneTimingFromArtifacts(input.sceneArtifacts);
  if (plan.scenes.length !== input.script.scenes.length) {
    throw new PipelineError("render_props_invalid", "Số cảnh của audio khác script");
  }

  const shots: TimedShot[] = [];
  let sceneStartFrame = 0;
  input.script.scenes.forEach((scene, si) => {
    const timing = plan.scenes[si];
    const media = input.sceneArtifacts[si];
    if (timing === undefined || media === undefined || timing.sceneId !== scene.id) {
      throw new PipelineError("render_props_invalid", `Cảnh ${scene.id} không khớp audio`);
    }
    if (media.lines === undefined) {
      throw new PipelineError("render_props_invalid", `Cảnh ${scene.id} thiếu ranh giới câu`);
    }
    const sceneEndFrame = sceneStartFrame + timing.durationInFrames;
    const assigned = assignWordsToLines(media.alignment.words, media.lines);
    const lineWords = new Map<string, { text: string; startMs: number; endMs: number }[]>();
    assigned.words.forEach((word, wi) => {
      const id = assigned.lineIds[wi] as string;
      lineWords.set(id, [...(lineWords.get(id) ?? []), word]);
    });
    /** ms trong cảnh (từ đầu WAV) → frame tuyệt đối; audio bắt đầu sau khoảng đệm đầu cảnh. */
    const toFrame = (ms: number) => sceneStartFrame + msToFrames(SCENE_EDGE_PAD_MS + ms, fps);

    const speaking = new Map<string, { from: number; to: number }[]>();
    for (const line of media.lines) {
      const words = lineWords.get(line.lineId) ?? [];
      const from = toFrame(words[0]?.startMs ?? line.startMs);
      const to = Math.max(from + 1, toFrame(words.at(-1)?.endMs ?? line.endMs));
      speaking.set(line.speaker, [...(speaking.get(line.speaker) ?? []), { from, to }]);
    }

    const slots = assignSlots(scene.shots);
    const starts = scene.shots.map((shot, hi) => {
      if (hi === 0) {
        return sceneStartFrame;
      }
      const words = lineWords.get(shot.lineId) ?? [];
      const target = normalizeWord(shot.cutOnWord);
      const word = words.find((w) => normalizeWord(w.text) === target);
      if (word === undefined) {
        warnings.push({
          code: "cut_word_not_found",
          sceneId: scene.id,
          shotId: shot.id,
          cutOnWord: shot.cutOnWord,
        });
        const line = media.lines?.find((l) => l.lineId === shot.lineId);
        return toFrame(line?.startMs ?? 0);
      }
      return Math.max(sceneStartFrame, toFrame(word.startMs) - CUT_LEAD_FRAMES);
    });
    // Frame cắt phải tăng dần và còn chỗ cho mỗi shot ít nhất một frame.
    for (let i = 1; i < starts.length; i++) {
      const min = (starts[i - 1] as number) + 1;
      const max = sceneEndFrame - (starts.length - i);
      starts[i] = Math.min(Math.max(starts[i] as number, min), max);
    }

    scene.shots.forEach((shot, hi) => {
      const from = starts[hi] as number;
      const to = starts[hi + 1] ?? sceneEndFrame;
      shots.push({
        shotId: shot.id,
        sceneId: scene.id,
        fromFrame: from,
        durationInFrames: to - from,
        background: shot.background,
        shotSize: shot.shotSize,
        camera: shot.camera ?? "cam_static",
        focus: shot.focus,
        props: shot.props ?? [],
        ambience: shot.ambience ?? [],
        actors: shot.actors.map((actor) => {
          const look = castByKey.get(actor.character);
          if (look === undefined) {
            throw new PipelineError(
              "render_props_invalid",
              `Nhân vật ${actor.character} không thuộc kênh`,
            );
          }
          return {
            character: actor.character,
            skin: look.skinAssetId,
            action: actor.action,
            expression: actor.expression,
            slot: slots.get(actor.character) ?? "center",
            speakingRanges: speaking.get(actor.character) ?? [],
          };
        }),
      });
    });
    sceneStartFrame = sceneEndFrame;
  });

  const fixed = fixPacing(shots, input.format, fps);
  warnings.push(...fixed.warnings);
  for (const violation of checkPacing(fixed.shots, input.format, fps)) {
    warnings.push({ code: "pacing_violation", violation });
  }

  const props = parseStickStoryRenderProps({
    templateId: STICK_STORY_TEMPLATE_ID,
    templateVersion: stickStoryTemplateVersion(),
    motionKitVersion: STICK_STORY_MOTION_KIT_VERSION,
    fps,
    width: 1080,
    height: 1920,
    audio: {
      storageKey: input.audioStorageKey,
      durationMs: input.totalDurationMs,
      ...(input.audioSrc === undefined ? {} : { src: input.audioSrc }),
    },
    brand: {
      fontFamily: input.brand.fontFamily,
      textColor: input.brand.textColor,
      captionBackground: "rgba(11,13,18,0.82)",
      speakerColors: Object.fromEntries(input.cast.map((c) => [c.characterKey, c.color])),
      introAssetId: input.brand.introAssetId ?? null,
      outroAssetId: input.brand.outroAssetId ?? null,
    },
    // ADR-014 bổ sung 2026-11-03: chỉ hoạt hình và phụ đề, cảnh không có `board`.
    scenes: plan.scenes.map((timing) => ({
      sceneId: timing.sceneId,
      fromMs: timing.fromMs,
      durationMs: timing.durationMs,
    })),
    shots: fixed.shots,
    captions,
    sfx: [],
  });
  return { props, warnings };
}
