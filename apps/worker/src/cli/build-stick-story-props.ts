import { DEFAULT_MUSIC_MOOD, MUSIC_TRACKS, type SfxId } from "@studio/audio-kit";
import {
  assignWordsToLines,
  checkPacing,
  type FormatPack,
  isChannelNameSet,
  MAX_ACTORS_BY_SHOT_SIZE,
  msToFrames,
  normalizeWord,
  OUTRO_BEAT,
  type PacingViolation,
  SCENE_EDGE_PAD_MS,
  type ScriptV2,
  type ShotSize,
  TITLE_BEAT,
} from "@studio/contracts";
import { getCamera, getProp, getSkin, layoutProps } from "@studio/motion-kit";
import { type AspectRatio, frameDimensions } from "@studio/video/render-props/common";
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

/** Khung của run đọc từ cột `aspect_ratio` (ADR-022); giá trị lạ coi như khung dọc. */
export const runAspectRatio = (value: string | null | undefined): AspectRatio =>
  value === "16:9" ? "16:9" : "9:16";

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
  | { code: "pacing_fixed"; shotId: string; action: "split" | "shot_size_changed" }
  | { code: "prop_dropped"; shotId: string; propId: string };

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
 * Vị trí đứng của ảnh kết mời theo dõi (ADR-026): người cao nhất đứng giữa, hai người hai bên cùng chỉ vào
 * giữa phía trên (thẻ kết). Người thấp đứng giữa thì tay chỉ của người giữa và người bên phải chạm nhau.
 */
export function groupSlots(
  shots: readonly { actors: readonly { character: string }[] }[],
  heightOf: (character: string) => number,
): Map<string, Slot> {
  const slots = assignSlots(shots);
  const characters = [...slots.keys()];
  if (characters.length < 3) {
    return slots;
  }
  const tallest = characters.reduce((best, c) => (heightOf(c) > heightOf(best) ? c : best));
  const sides = characters.filter((c) => c !== tallest);
  return new Map<string, Slot>([
    [sides[0] as string, "left"],
    [sides[1] as string, "right"],
    [tallest, "center"],
    ...sides.slice(2).map((c) => [c, "center"] as [string, Slot]),
  ]);
}

/** Vị trí đứng của một cảnh, dùng chung cho video và ảnh storyboard: cảnh mời theo dõi theo `groupSlots`. */
export function sceneSlots(
  scene: { beat: string; shots: readonly { actors: readonly { character: string }[] }[] },
  skinIdOf: (character: string) => string | undefined,
): Map<string, Slot> {
  if (scene.beat !== OUTRO_BEAT) {
    return assignSlots(scene.shots);
  }
  return groupSlots(scene.shots, (character) => {
    const skin = skinIdOf(character);
    try {
      return skin === undefined ? 0 : getSkin(skin).height;
    } catch {
      return 0;
    }
  });
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
 * Shot có từ hai nhân vật (ADR-024): phần lẻ cắt sang người nghe (lấy nét nhân vật kia), như dựng phim
 * cắt sang phản ứng thay vì nhìn mãi người nói. Miệng vẫn theo `speakingRanges` nên không lệch tiếng.
 */
export function fixPacing(
  shots: readonly TimedShot[],
  pack: FormatPack,
  fps: number,
  /** Cảnh giữ nguyên hình (ADR-026: cảnh mời theo dõi): không chia, không đổi cỡ. */
  holdSceneIds: ReadonlySet<string> = new Set(),
): { shots: TimedShot[]; warnings: StickStoryWarning[] } {
  const warnings: StickStoryWarning[] = [];
  const maxFrames = Math.floor(pack.pacing.maxStaticSec * fps);
  const split: TimedShot[] = [];
  for (const shot of shots) {
    if (shot.durationInFrames <= maxFrames || holdSceneIds.has(shot.sceneId)) {
      split.push(shot);
      continue;
    }
    const parts = Math.ceil(shot.durationInFrames / maxFrames);
    const base = Math.floor(shot.durationInFrames / parts);
    let from = shot.fromFrame;
    const listener = shot.actors.find((a) => a.character !== shot.focus);
    for (let k = 0; k < parts; k++) {
      const len = k === parts - 1 ? shot.fromFrame + shot.durationInFrames - from : base;
      split.push({
        ...shot,
        shotId: k === 0 ? shot.shotId : `${shot.shotId}${String.fromCharCode(97 + k)}`,
        fromFrame: from,
        durationInFrames: len,
        ...(k % 2 === 1 && listener !== undefined ? { focus: listener.character } : {}),
        // Hiệu ứng là điểm nhấn của khoảnh khắc cắt (ADR-025): chỉ phần đầu giữ.
        ...(k > 0 && shot.effects !== undefined ? { effects: undefined } : {}),
      });
      from += len;
    }
    warnings.push({ code: "pacing_fixed", shotId: shot.shotId, action: "split" });
  }
  if (pack.pacing.noSameShotSizeInARow) {
    for (let i = 1; i < split.length; i++) {
      const prev = split[i - 1] as TimedShot;
      const cur = split[i] as TimedShot;
      if (prev.shotSize === cur.shotSize && !holdSceneIds.has(cur.sceneId)) {
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

const MOVING_CAMERAS: Record<ShotSize, readonly string[]> = {
  wide: ["cam_pull_out", "cam_pan", "cam_push_in", "cam_static"],
  high: ["cam_pan", "cam_pull_out", "cam_static", "cam_push_in"],
  medium: ["cam_push_in", "cam_static", "cam_pan"],
  close: ["cam_push_in", "cam_static"],
};

/**
 * Đạo diễn máy quay bằng luật (ADR-014 bổ sung 2026-11-12), chạy sau `fixPacing`:
 * - người được lấy nét hoảng hốt hoặc ngạc nhiên ở cỡ không rộng: giật máy (`cam_bump`);
 * - shot rộng hoặc từ cao mở đầu cảnh mà đứng yên: lùi máy mở cảnh (`cam_pull_out`);
 * - cùng một kiểu máy ba shot liền: đổi sang kiểu khác hợp cỡ cảnh.
 * Chỉ dùng camera có trong kho (`hasCamera`), để kênh chưa có camera mới vẫn dựng được.
 */
export function directCameras(
  shots: readonly TimedShot[],
  hasCamera: (id: string) => boolean = () => true,
  holdSceneIds: ReadonlySet<string> = new Set(),
): TimedShot[] {
  const out: TimedShot[] = [];
  shots.forEach((shot, i) => {
    if (holdSceneIds.has(shot.sceneId)) {
      out.push(shot);
      return;
    }
    let camera = shot.camera;
    const focus = shot.actors.find((a) => a.character === shot.focus);
    const startsScene = i === 0 || shots[i - 1]?.sceneId !== shot.sceneId;
    const continuation = /[a-z]$/.test(shot.shotId);
    const startled =
      focus !== undefined &&
      (focus.expression === "expr_panic" ||
        focus.action.includes("panic") ||
        (focus.expression === "expr_surprised" && shot.shotSize === "close"));
    // Giật máy là điểm nhấn: không quá một lần trong ba shot liền.
    const recentBump = out.slice(-2).some((s) => s.camera === "cam_bump");
    if (
      !continuation &&
      startled &&
      !recentBump &&
      shot.shotSize !== "wide" &&
      hasCamera("cam_bump")
    ) {
      camera = "cam_bump";
    } else if (
      startsScene &&
      (shot.shotSize === "wide" || shot.shotSize === "high") &&
      camera === "cam_static" &&
      hasCamera("cam_pull_out")
    ) {
      camera = "cam_pull_out";
    } else {
      const a = out[i - 1]?.camera;
      const b = out[i - 2]?.camera;
      if (a === camera && b === camera) {
        camera = MOVING_CAMERAS[shot.shotSize].find((c) => c !== camera && hasCamera(c)) ?? camera;
      }
    }
    out.push(camera === shot.camera ? shot : { ...shot, camera });
  });
  return out;
}

/** Chữ nút đỏ của thẻ kết khi có cảnh mời theo dõi (ADR-026). */
export const FOLLOW_BUTTON = "Follow";

type CardRange = {
  sceneId: string;
  fromMs: number;
  durationMs: number;
  fromFrame: number;
  toFrame: number;
};

/**
 * Thẻ mở và kết theo cảnh `title`/`outro` (ADR-026). Câu nhân vật đọc ở hai cảnh này hiện bằng chữ trắng trên
 * thẻ, không bằng phụ đề màu dưới đáy, nên phụ đề của hai cảnh đó bị bỏ (`hideCaptionsIn`). Câu quá dài cho thẻ
 * thì giữ phụ đề và thẻ như ADR-021.
 */
export function storyCards(
  script: Pick<ScriptV2, "title" | "scenes">,
  channelName: string | null | undefined,
  ranges: readonly CardRange[],
  accentColor?: string | null,
  avatarSrc?: string | null,
) {
  const base = titleCards(script.title, channelName);
  const oneLine = (text: string) => text.replace(/\s+/gu, " ").trim();
  const range = (beat: string) => {
    const scene = script.scenes.find((s) => s.beat === beat);
    const r = scene === undefined ? undefined : ranges.find((x) => x.sceneId === scene.id);
    const text = oneLine(scene?.lines.map((l) => l.text).join(" ") ?? "");
    return r === undefined || text === "" ? undefined : { ...r, text };
  };
  const title = range(TITLE_BEAT);
  const outro = range(OUTRO_BEAT);
  const hideCaptionsIn: { fromMs: number; toMs: number }[] = [];
  let intro: { title: string; toFrame?: number } = base.intro;
  if (title !== undefined && title.text.length <= 80) {
    intro = { title: title.text, toFrame: title.toFrame };
    hideCaptionsIn.push({ fromMs: title.fromMs, toMs: title.fromMs + title.durationMs });
  }
  let outroCard: {
    channel: string | null;
    cta: string;
    button?: string;
    accent?: string;
    avatar?: string;
    fromFrame?: number;
  } = base.outro;
  if (outro !== undefined) {
    outroCard = { ...base.outro, fromFrame: outro.fromFrame };
    if (outro.text.length <= 90) {
      outroCard = {
        ...outroCard,
        cta: outro.text,
        button: FOLLOW_BUTTON,
        ...(accentColor != null && /^#[0-9a-fA-F]{6}$/.test(accentColor)
          ? { accent: accentColor }
          : {}),
        ...(avatarSrc == null ? {} : { avatar: avatarSrc }),
      };
      hideCaptionsIn.push({ fromMs: outro.fromMs, toMs: outro.fromMs + outro.durationMs });
    }
  }
  return { cards: { intro, outro: outroCard }, hideCaptionsIn };
}

/** Khoảng cách tối thiểu giữa hai SFX để tiếng không dồn dập (ADR-019). */
export const SFX_MIN_GAP_FRAMES = 20;

/**
 * Đặt SFX bằng luật, không gọi LLM (ADR-019): vút qua khi sang cảnh, lấp lánh khi hình hiện trong cảnh, tiếng
 * bút khi vẽ bảng, bùng nhún khi hoảng, lấp lánh khi ăn mừng, ting khi cận mặt ngạc nhiên. Chỉ đặt ở đầu shot
 * gốc (không ở phần do `fixPacing` chia thêm); hai tiếng cách nhau ít nhất `SFX_MIN_GAP_FRAMES`.
 */
export function planSfx(shots: readonly TimedShot[]): { assetId: SfxId; fromFrame: number }[] {
  const cues: { assetId: SfxId; fromFrame: number }[] = [];
  shots.forEach((shot, i) => {
    if (/[a-z]$/.test(shot.shotId)) {
      return;
    }
    const prev = shots[i - 1];
    if (prev !== undefined && prev.sceneId !== shot.sceneId) {
      cues.push({ assetId: "sfx_whoosh", fromFrame: Math.max(0, shot.fromFrame - 4) });
    }
    if (shot.illustration !== undefined && shot.shotSize !== "close") {
      cues.push({
        assetId: shot.illustration.style === "board" ? "sfx_scribble" : "sfx_sparkle",
        fromFrame: shot.fromFrame + 4,
      });
      return;
    }
    const focus = shot.actors.find((a) => a.character === shot.focus);
    if (focus === undefined) {
      return;
    }
    if (focus.action.includes("panic")) {
      cues.push({ assetId: "sfx_boing", fromFrame: shot.fromFrame + 3 });
    } else if (focus.action.includes("celebrate")) {
      cues.push({ assetId: "sfx_sparkle", fromFrame: shot.fromFrame + 5 });
    } else if (shot.shotSize === "close" && focus.expression === "expr_surprised") {
      cues.push({ assetId: "sfx_ding", fromFrame: shot.fromFrame + 2 });
    }
  });
  // Gần nhau quá thì giữ tiếng quan trọng hơn: sang cảnh, rồi minh họa, rồi phản ứng.
  const rank = (id: SfxId) =>
    id === "sfx_whoosh" ? 0 : id === "sfx_pop" || id === "sfx_scribble" ? 1 : 2;
  const kept: typeof cues = [];
  for (const cue of [...cues].sort(
    (a, b) => rank(a.assetId) - rank(b.assetId) || a.fromFrame - b.fromFrame,
  )) {
    if (kept.every((k) => Math.abs(k.fromFrame - cue.fromFrame) >= SFX_MIN_GAP_FRAMES)) {
      kept.push(cue);
    }
  }
  return kept.sort((a, b) => a.fromFrame - b.fromFrame);
}

/** Lời mời ở thẻ cuối (ADR-021); nhân vật cũng nói lời mời ở cảnh cuối (ADR-020). */
export const OUTRO_CTA = "Theo dõi để xem tiếp nhé!";

/** Thẻ tiêu đề và thẻ kênh (ADR-021): tiêu đề của phương án, tên kênh khi Director đã đặt. */
export function titleCards(title: string, channelName: string | null | undefined) {
  const oneLine = (text: string) => text.replace(/\s+/gu, " ").trim();
  return {
    intro: { title: oneLine(title).slice(0, 80) },
    outro: {
      channel: isChannelNameSet(channelName) ? oneLine(channelName).slice(0, 60) : null,
      cta: OUTRO_CTA,
    },
  };
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
    /** Tên kênh cho thẻ cuối (ADR-021); tên seed hoặc thiếu thì thẻ chỉ có lời mời. */
    channelName?: string | null;
    /** Màu nhấn của kênh (`palette.accent`), tô tên kênh trên thẻ mời theo dõi (ADR-026). */
    accentColor?: string | null;
    /** Khóa `staticFile` của avatar kênh (ADR-028), từ `publishBrandAvatar`. */
    avatarSrc?: string | null;
  };
  audioStorageKey: string;
  totalDurationMs: number;
  audioSrc?: string;
  /** Khung hình của run (ADR-022); mặc định dọc `9:16`. */
  aspectRatio?: AspectRatio;
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

    const slots = sceneSlots(scene, (character) => castByKey.get(character)?.skinAssetId);
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
        ...(shot.mood === undefined ? {} : { mood: shot.mood }),
        ...(shot.effects === undefined ? {} : { effects: shot.effects }),
        ...(shot.illustration === undefined ? {} : { illustration: shot.illustration }),
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
            ...(actor.outfit === undefined ? {} : { outfit: actor.outfit }),
            slot: slots.get(actor.character) ?? "center",
            speakingRanges: speaking.get(actor.character) ?? [],
          };
        }),
      });
    });
    sceneStartFrame = sceneEndFrame;
  });

  // ADR-026: cảnh mời theo dõi là hình kết cố định, dài bao nhiêu cũng giữ một shot.
  const holdSceneIds = new Set(
    input.script.scenes.filter((s) => s.beat === OUTRO_BEAT).map((s) => s.id),
  );
  const fixed = fixPacing(shots, input.format, fps, holdSceneIds);
  warnings.push(...fixed.warnings);
  fixed.shots = directCameras(
    fixed.shots,
    (id) => {
      try {
        getCamera(id);
        return true;
      } catch {
        return false;
      }
    },
    holdSceneIds,
  );
  // P6-19: đặt đồ vật sau khi đã đổi cỡ cảnh; đồ vật không có chỗ bị bỏ khỏi props và báo cảnh báo.
  fixed.shots = fixed.shots.map((shot) => {
    const layout = layoutProps(
      shot.props,
      shot.actors.map((a) => a.slot),
      shot.shotSize,
      getProp,
    );
    for (const propId of layout.dropped) {
      warnings.push({ code: "prop_dropped", shotId: shot.shotId, propId });
    }
    const kept = new Set([...layout.floor.map((p) => p.id), ...layout.air]);
    return { ...shot, props: [...new Set(shot.props)].filter((id) => kept.has(id)) };
  });
  for (const violation of checkPacing(
    fixed.shots.filter((s) => !holdSceneIds.has(s.sceneId)),
    input.format,
    fps,
  )) {
    warnings.push({ code: "pacing_violation", violation });
  }

  // ADR-026: câu của cảnh đọc tiêu đề và cảnh mời theo dõi hiện trên thẻ chữ trắng thay cho phụ đề.
  let frameCursor = 0;
  const storyCardsResult = storyCards(
    input.script,
    input.brand.channelName,
    plan.scenes.map((timing) => {
      const fromFrame = frameCursor;
      frameCursor += timing.durationInFrames;
      return {
        sceneId: timing.sceneId,
        fromMs: timing.fromMs,
        durationMs: timing.durationMs,
        fromFrame,
        toFrame: frameCursor,
      };
    }),
    input.brand.accentColor,
    input.brand.avatarSrc,
  );
  const shownCaptions = captions.filter(
    (c) =>
      !storyCardsResult.hideCaptionsIn.some((r) => c.startMs >= r.fromMs && c.startMs < r.toMs),
  );
  const props = parseStickStoryRenderProps({
    templateId: STICK_STORY_TEMPLATE_ID,
    templateVersion: stickStoryTemplateVersion(),
    motionKitVersion: STICK_STORY_MOTION_KIT_VERSION,
    fps,
    ...frameDimensions(input.aspectRatio ?? "9:16"),
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
    captions: shownCaptions,
    cards: storyCardsResult.cards,
    music: { assetId: MUSIC_TRACKS[input.script.music ?? DEFAULT_MUSIC_MOOD].id },
    sfx: planSfx(fixed.shots),
  });
  return { props, warnings };
}
