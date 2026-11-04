import type { FC } from "react";
import { getBackground, getCamera, getExpression, getMotion, getSkin } from "../assets/index.js";
import { Actor, type SpeakingRange } from "../rig/actor.js";
import type { Pose } from "../rig/pose.js";
import { Ambience } from "./ambience.js";
import {
  actorSlotX,
  defaultFacing,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  framingTransform,
  shotFraming,
} from "./framing.js";
import type { AmbienceKind, ShotSize, SlotName } from "./types.js";

export type StageActor = {
  /** Id tài sản `character_skin`. */
  skin: string;
  /** Id tài sản `action` hoặc `pose`. */
  action: string;
  /** Id tài sản `expression`. */
  expression: string;
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
  ambience?: readonly AmbienceKind[];
  lightShaft?: boolean;
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
  ambience = [],
  lightShaft = false,
}) => {
  const bg = getBackground(background);
  const stage = bg.stage;
  const t = durationInFrames <= 1 ? 0 : (frame - startFrame) / (durationInFrames - 1);
  const shotSlots = actors.map((a) => a.slot);
  const view = shotFraming(
    stage,
    shotSize,
    actors.map((a) => ({ skin: getSkin(a.skin), slot: a.slot })),
    focus,
    getCamera(camera),
    t,
  );
  const Bg = bg.Component;
  return (
    <svg
      viewBox={`0 0 ${FRAME_WIDTH} ${FRAME_HEIGHT}`}
      width={FRAME_WIDTH}
      height={FRAME_HEIGHT}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{`Shot ${background} ${shotSize}`}</title>
      <rect x={0} y={0} width={FRAME_WIDTH} height={FRAME_HEIGHT} fill="#000" />
      <g transform={framingTransform(view)}>
        <Bg frame={frame} lightShaft={lightShaft} />
        <Ambience kinds={ambience} layer="back" frame={frame} />
        {actors.map((a) => {
          const facing = a.facing ?? defaultFacing(a.slot, shotSlots);
          return (
            <g
              key={`${a.skin}-${a.slot}`}
              transform={`translate(${actorSlotX(stage, a.slot, shotSlots)} ${stage.groundY}) scale(${stage.actorScale})`}
            >
              <Actor
                skin={getSkin(a.skin)}
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
        <Ambience kinds={ambience} layer="front" frame={frame} />
      </g>
      <Ambience kinds={ambience} layer="screen" frame={frame} />
    </svg>
  );
};
