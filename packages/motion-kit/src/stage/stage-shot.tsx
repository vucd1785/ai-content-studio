import type { FC, ReactNode } from "react";
import {
  getBackground,
  getCamera,
  getExpression,
  getMotion,
  getProp,
  getSkin,
} from "../assets/index.js";
import { Actor, type SpeakingRange } from "../rig/actor.js";
import { rnd } from "../rig/math.js";
import { applyOutfit, type OutfitKind } from "../rig/outfit.js";
import type { Pose } from "../rig/pose.js";
import { Ambience } from "./ambience.js";
import { type EffectAnchor, Effects, impactShake } from "./effects.js";
import {
  actorSlotX,
  backgroundScale,
  defaultFacing,
  type FrameSize,
  framingTransform,
  isLandscape,
  reserveShift,
  shotFraming,
  shotReserve,
  VERTICAL_FRAME,
} from "./framing.js";
import {
  boardThemeFor,
  Illustration,
  type IllustrationStyle,
  renderedIllustrationStyle,
} from "./illustration.js";
import { MoodGrade, MoodLight, PARALLAX, parallaxOffset } from "./lighting.js";
import { layoutProps } from "./props.js";
import type {
  AmbienceKind,
  EffectKind,
  Mood,
  PropAsset,
  ShotSize,
  SlotName,
  StageLayout,
} from "./types.js";

export type StageActor = {
  /** Id tài sản `character_skin`. */
  skin: string;
  /** Id tài sản `action` hoặc `pose`. */
  action: string;
  /** Id tài sản `expression`. */
  expression: string;
  /** Trang phục khi câu chuyện cần (ADR-032). */
  outfit?: OutfitKind;
  slot: SlotName;
  /** Mặc định: nhân vật bên trái nhìn sang phải, bên phải nhìn sang trái. */
  facing?: 1 | -1;
  speakingRanges?: readonly SpeakingRange[];
  fromPose?: Pose;
  seed: number;
};

export type StageShotProps = {
  /** Frame tuyệt đối của composition. */
  frame: number;
  startFrame: number;
  durationInFrames: number;
  background: string;
  shotSize: ShotSize;
  /** Id tài sản `camera`; mặc định `cam_static`. */
  camera?: string;
  /** Chỉ số trong `actors` của nhân vật được lấy nét. */
  focus: number;
  actors: readonly StageActor[];
  /** Id tài sản `prop` (P6-19); đặt theo `layoutProps`, đồ vật thừa không vẽ. */
  props?: readonly string[];
  ambience?: readonly AmbienceKind[];
  lightShaft?: boolean;
  /**
   * Minh họa khi giải thích (ADR-014 bổ sung 2026-11-11): bong bóng nghĩ trên đầu `owner` (chỉ số trong
   * `actors`) hoặc bảng trắng; `items` là id tài sản `prop`. Không vẽ ở cỡ cận.
   */
  illustration?: { style: IllustrationStyle; items: readonly string[]; owner: number };
  /** Khung hình (ADR-022); mặc định khung dọc 1080×1920. */
  frameSize?: FrameSize;
  /** Tông ánh sáng (ADR-023); không có thì vẽ như trước. */
  mood?: Mood;
  /** Hiệu ứng điểm nhấn (ADR-025), neo vào nhân vật được lấy nét. */
  effects?: readonly EffectKind[];
};

/**
 * Một shot hoàn chỉnh: bối cảnh, nhân vật, camera, không khí. Chỉ vẽ trong hệ 1080×1920, không phụ đề.
 * Template (`StickStory`, P6-09) đặt nhiều shot theo frame cắt và vẽ phụ đề phía trên.
 */
export const StageShot: FC<StageShotProps> = ({
  frame,
  startFrame,
  durationInFrames,
  background,
  shotSize,
  camera = "cam_static",
  focus,
  actors,
  props = [],
  ambience = [],
  lightShaft = false,
  illustration,
  frameSize = VERTICAL_FRAME,
  mood,
  effects = [],
}) => {
  const W = frameSize.width;
  const H = frameSize.height;
  const bg = getBackground(background);
  const stage = bg.stage;
  const t = durationInFrames <= 1 ? 0 : (frame - startFrame) / (durationInFrames - 1);
  const placed = layoutProps(
    props,
    actors.map((a) => a.slot),
    shotSize,
    getProp,
  );
  const floorProps = placed.floor.map((p) => ({
    ...p,
    asset: getProp(p.id) as Extract<PropAsset, { placement: "floor" }>,
  }));
  const shotSlots = [...actors.map((a) => a.slot), ...floorProps.map((p) => p.slot)];
  const showIllustration =
    illustration !== undefined && shotSize !== "close" && illustration.items.length > 0;
  const endCardWide = camera === "cam_end_card" && isLandscape(frameSize);
  const reserve = shotReserve({
    frame: frameSize,
    camera,
    shotSize,
    hasIllustration: showIllustration,
  });
  const view = shotFraming(
    stage,
    shotSize,
    actors.map((a) => ({ skin: getSkin(a.skin), slot: a.slot })),
    focus,
    getCamera(camera),
    t,
    floorProps.map((p) => ({ halfWidth: p.asset.halfWidth, slot: p.slot })),
    frameSize,
    // ADR-029: khung ngang dồn nhân vật sang trái để minh họa có nửa khung; khung kết dồn sang phải để thẻ
    // hồ sơ kênh đứng bên trái.
    reserve === undefined ? {} : { reserve },
  );
  // Khung kết ngang (ADR-029): bối cảnh có thể không đủ rộng để máy lùi sang trái, nên lớp nhân vật tự dời
  // cho tâm nhóm vào giữa phần phải khung; thẻ hồ sơ kênh ở phần trái không che ai.
  const groupSpans = actors.map((a) => {
    const x = actorSlotX(stage, a.slot, shotSlots);
    const half = getSkin(a.skin).bodyHalfWidth * stage.actorScale;
    return [x - half, x + half] as const;
  });
  const actorShift =
    groupSpans.length === 0
      ? 0
      : reserveShift(
          view,
          frameSize,
          {
            x0: Math.min(...groupSpans.map((g) => g[0])),
            x1: Math.max(...groupSpans.map((g) => g[1])),
          },
          reserve,
        );
  /** Vị trí x (thế giới) của một chỗ đứng, đã dời theo `actorShift`; bối cảnh không dời. */
  const slotX = (slot: SlotName) => actorSlotX(stage, slot, shotSlots) + actorShift;
  const Bg = bg.Component;
  // Minh họa (ADR-014 bổ sung 2026-11-11, 2026-11-12 (3)): `board` vẽ trên màn hình; `scene` vẽ trong khung cảnh,
  // sau lưng nhân vật, bằng phép đổi ngược từ hệ màn hình về hệ thế giới để vùng hình vẫn nằm trên đầu nhân vật.
  const illustrationLayer =
    illustration !== undefined && renderedIllustrationStyle(illustration.style) === "scene"
      ? "world"
      : "screen";
  let illustrationNode: ReactNode = null;
  if (showIllustration && illustration !== undefined) {
    const toScreen = (wx: number, wy: number) => ({
      x: W / 2 + (wx - view.cx) * view.zoom,
      y: H / 2 + (wy - view.cy) * view.zoom,
    });
    const heads = actors.map((a) =>
      toScreen(slotX(a.slot), stage.groundY - getSkin(a.skin).height * stage.actorScale),
    );
    const owner = heads[illustration.owner] ?? heads[focus] ?? heads[0];
    // Bề ngang trên màn hình của mọi nhân vật, tính cả thân: khung ngang đặt minh họa sang bên còn trống.
    const bodies = actors.map((a) => {
      const x = toScreen(slotX(a.slot), 0).x;
      const half = getSkin(a.skin).bodyHalfWidth * stage.actorScale * view.zoom;
      return [x - half, x + half] as const;
    });
    const actorsSpan =
      bodies.length === 0
        ? undefined
        : { x0: Math.min(...bodies.map((b) => b[0])), x1: Math.max(...bodies.map((b) => b[1])) };
    illustrationNode = (
      <Illustration
        style={illustration.style}
        items={illustration.items}
        frame={frame}
        startFrame={startFrame}
        ownerX={owner?.x ?? W / 2}
        headTopY={Math.min(...heads.map((h) => h.y), H)}
        frameSize={frameSize}
        boardTheme={boardThemeFor(background)}
        {...(actorsSpan === undefined ? {} : { actorsSpan })}
      />
    );
  }
  // Hiệu ứng (ADR-025) neo vào người được lấy nét, tính trong hệ màn hình như minh họa.
  let effectNode: ReactNode = null;
  if (effects.length > 0) {
    const target = actors[focus] ?? actors[0];
    const skin = target === undefined ? undefined : getSkin(target.skin);
    const x = target === undefined ? stage.slots.center : slotX(target.slot);
    const toY = (wy: number) => H / 2 + (wy - view.cy) * view.zoom;
    const toX = (wx: number) => W / 2 + (wx - view.cx) * view.zoom;
    const h = (skin?.height ?? 400) * stage.actorScale;
    const headY = stage.groundY + (skin?.headAnchor.y ?? -300) * stage.actorScale;
    const anchor: EffectAnchor = {
      headX: toX(x),
      headY: toY(headY),
      headTopY: toY(stage.groundY - h),
      bodyY: toY(stage.groundY - h * 0.45),
      height: h * view.zoom,
    };
    effectNode = (
      <Effects
        kinds={effects}
        frame={frame}
        startFrame={startFrame}
        anchor={anchor}
        frameSize={frameSize}
      />
    );
  }
  const shake = effects.includes("impact")
    ? impactShake(frame - startFrame, frameSize)
    : { dx: 0, dy: 0 };
  const shaking = shake.dx !== 0 || shake.dy !== 0;
  const screenToWorld = `translate(${view.cx.toFixed(2)} ${view.cy.toFixed(2)}) scale(${(1 / view.zoom).toFixed(5)}) translate(${-W / 2} ${-H / 2})`;
  // Khung ngang (ADR-022): bối cảnh vẽ cho khung dọc được phóng đều quanh điểm giữa mặt đất cho đủ bề ngang.
  const bgScale = backgroundScale(stage, frameSize);
  const pivotX = (stage.bounds.x0 + stage.bounds.x1) / 2;
  const inBgScale = (node: ReactNode): ReactNode =>
    bgScale === 1 ? (
      node
    ) : (
      <g
        transform={`translate(${pivotX} ${stage.groundY}) scale(${bgScale.toFixed(4)}) translate(${-pivotX} ${-stage.groundY})`}
      >
        {node}
      </g>
    );
  // Lớp xa và tiền cảnh (ADR-023) trượt lệch so với lớp giữa theo vị trí camera.
  const layer = (Layer: FC<{ frame: number }> | undefined, factor: number): ReactNode => {
    if (Layer === undefined) {
      return null;
    }
    const off = parallaxOffset(stage, view, factor);
    return (
      <g transform={`translate(${off.dx.toFixed(2)} ${off.dy.toFixed(2)})`}>
        {inBgScale(<Layer frame={frame} />)}
      </g>
    );
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} xmlns="http://www.w3.org/2000/svg">
      <title>{`Shot ${background} ${shotSize}`}</title>
      <rect x={0} y={0} width={W} height={H} fill="#000" />
      <g
        transform={
          shaking
            ? `translate(${(W / 2 + shake.dx).toFixed(2)} ${(H / 2 + shake.dy).toFixed(2)}) scale(1.03) translate(${-W / 2} ${-H / 2})`
            : undefined
        }
      >
        <g transform={framingTransform(view, frameSize)}>
          {layer(bg.Far, PARALLAX.far)}
          {inBgScale(<Bg frame={frame} lightShaft={lightShaft} />)}
          {mood === undefined ? null : (
            <g transform={screenToWorld}>
              <MoodGrade mood={mood} target="scene" frameSize={frameSize} />
            </g>
          )}
          <Ambience kinds={ambience} layer="back" frame={frame} />
          {illustrationNode !== null && illustrationLayer === "world" ? (
            <g transform={screenToWorld}>{illustrationNode}</g>
          ) : null}
          {floorProps.map((p) => {
            const Prop = p.asset.Component;
            return (
              <g
                key={`prop-${p.id}`}
                transform={`translate(${slotX(p.slot)} ${stage.groundY}) scale(${stage.actorScale})`}
              >
                <Prop frame={frame} t={t} seed={propSeed(p.id)} />
              </g>
            );
          })}
          {placed.air.map((id) => {
            const asset = getProp(id);
            if (asset.placement !== "air") {
              return null;
            }
            const Prop = asset.Component;
            const target = floorProps[0];
            const path = airPath(
              stage,
              target === undefined
                ? undefined
                : {
                    x: slotX(target.slot),
                    height: target.asset.height * stage.actorScale,
                  },
            );
            return (
              <Prop
                key={`prop-${id}`}
                frame={frame}
                t={t}
                seed={propSeed(id)}
                from={path.from}
                to={path.to}
                scale={stage.actorScale}
              />
            );
          })}
          {actors.map((a) => {
            // Khung kết ngang: mọi người quay sang trái, chỉ về thẻ hồ sơ kênh.
            const facing = a.facing ?? (endCardWide ? -1 : defaultFacing(a.slot, shotSlots));
            return (
              <g
                key={`${a.skin}-${a.slot}`}
                transform={`translate(${slotX(a.slot)} ${stage.groundY}) scale(${stage.actorScale})`}
              >
                <Actor
                  skin={applyOutfit(getSkin(a.skin), a.outfit)}
                  action={getMotion(a.action)}
                  expression={getExpression(a.expression)}
                  frame={frame}
                  startFrame={startFrame}
                  {...(a.fromPose === undefined ? {} : { fromPose: a.fromPose })}
                  {...(a.speakingRanges === undefined ? {} : { speakingRanges: a.speakingRanges })}
                  seed={a.seed}
                  facing={facing}
                />
              </g>
            );
          })}
          {bg.Near === undefined ? null : (
            <g filter="url(#mk-near-blur)">
              <defs>
                <filter id="mk-near-blur" x="-10%" y="-10%" width="120%" height="120%">
                  <feGaussianBlur stdDeviation="5" />
                </filter>
              </defs>
              {layer(bg.Near, PARALLAX.near)}
            </g>
          )}
          {mood === undefined ? null : (
            <g transform={screenToWorld}>
              <MoodGrade mood={mood} target="actors" frameSize={frameSize} />
            </g>
          )}
          <Ambience kinds={ambience} layer="front" frame={frame} />
        </g>
        {mood === undefined ? null : <MoodLight mood={mood} frame={frame} frameSize={frameSize} />}
        <Ambience kinds={ambience} layer="screen" frame={frame} frameSize={frameSize} />
      </g>
      {illustrationNode !== null && illustrationLayer === "screen" ? illustrationNode : null}
      {effectNode}
    </svg>
  );
};

/** Seed tất định của đồ vật theo id, để hai đồ vật khác nhau không nhấp nháy cùng nhịp. */
function propSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) % 9973;
  }
  return 1 + rnd(h, 3) * 100;
}

/**
 * Đường bay của đồ vật `air`: xuất phát cao trên đầu nhân vật, từ phía xa tới giữa thân đồ vật `floor` đầu
 * tiên; không có đồ vật `floor` thì bay ngang qua cả bối cảnh từ trái sang phải ở độ cao đó.
 */
export function airPath(
  stage: StageLayout,
  target: { x: number; height: number } | undefined,
): { from: { x: number; y: number }; to: { x: number; y: number } } {
  // Trên đỉnh đầu người cao nhất (Tí 394 × actorScale) để gói tin không bay ngang mặt (ảnh P6-19).
  const y = stage.groundY - 470 * stage.actorScale;
  const left = stage.bounds.x0 - 80;
  const right = stage.bounds.x1 + 80;
  if (target === undefined) {
    return { from: { x: left, y }, to: { x: right, y } };
  }
  const fromX = target.x >= (stage.bounds.x0 + stage.bounds.x1) / 2 ? left : right;
  return { from: { x: fromX, y }, to: { x: target.x, y: stage.groundY - target.height * 0.6 } };
}
