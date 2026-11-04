import { MAX_ACTORS_BY_SHOT_SIZE, remotionCaptionSchema } from "@studio/contracts";
import { z } from "zod/v4";
import { MVP_FPS, MVP_HEIGHT, MVP_WIDTH, RenderPropsError } from "../render-props/common";

/**
 * Render props của template `StickStory` (P6-09; 05 mục Template `StickStory`; ADR-014).
 * Director 2026-11-03: video chỉ có hoạt hình và phụ đề lời thoại; không chữ phủ màn hình,
 * không khung bảng code/sơ đồ, nên props không có `onScreenText` và `board`.
 * File này không import motion kit (worker typecheck không có JSX); version kit được ghim ở đây và
 * test của `apps/video` buộc nó khớp `MOTION_KIT_VERSION` của `packages/motion-kit`.
 */
export const STICK_STORY_TEMPLATE_ID = "StickStory" as const;
export const STICK_STORY_COMPOSITION_ID = "StickStory";
/** Version của composition; tăng khi đổi cách vẽ. */
export const STICK_STORY_BASE_VERSION = "1.1.0";
/** Version motion kit mà template này được dựng và kiểm với; phải bằng `MOTION_KIT_VERSION`. */
export const STICK_STORY_MOTION_KIT_VERSION = "0.2.0";

/** `<version template>+kit.<version kit>` (05): đổi kit thì đổi `templateVersion`, nên cache không dùng nhầm MP4 cũ. */
export function stickStoryTemplateVersion(
  baseVersion = STICK_STORY_BASE_VERSION,
  kitVersion = STICK_STORY_MOTION_KIT_VERSION,
): string {
  return `${baseVersion}+kit.${kitVersion}`;
}

const assetIdSchema = z.string().regex(/^[a-z0-9_]{1,64}$/);
const characterKeySchema = z.string().regex(/^[a-z0-9_]{1,32}$/);
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const frameRangeSchema = z
  .object({ from: z.number().int().nonnegative(), to: z.number().int().positive() })
  .strict();

const actorSchema = z
  .object({
    character: characterKeySchema,
    /** Id tài sản `character_skin` của nhân vật trong kênh. */
    skin: assetIdSchema,
    action: assetIdSchema,
    expression: assetIdSchema,
    slot: z.enum(["left", "center", "right"]),
    /** Khoảng frame tuyệt đối nhân vật mở miệng (lời của chính nhân vật). */
    speakingRanges: z.array(frameRangeSchema),
  })
  .strict();

const shotSchema = z
  .object({
    /** `s<n>`; shot do code chia thêm để đúng luật nhịp có hậu tố chữ (`s3b`). */
    shotId: z.string().regex(/^s[0-9]{1,3}[a-z]?$/),
    sceneId: z.string().regex(/^[a-z0-9-]{1,40}$/),
    fromFrame: z.number().int().nonnegative(),
    durationInFrames: z.number().int().positive(),
    background: assetIdSchema,
    shotSize: z.enum(["wide", "medium", "close", "high"]),
    camera: assetIdSchema,
    focus: characterKeySchema,
    actors: z.array(actorSchema).min(1).max(3),
    props: z.array(assetIdSchema).max(3),
    ambience: z.array(z.enum(["vignette", "dust", "foreground_blur"])).max(3),
  })
  .strict();

export const stickStoryRenderPropsSchema = z
  .object({
    templateId: z.literal(STICK_STORY_TEMPLATE_ID),
    templateVersion: z.string().min(1),
    motionKitVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    fps: z.literal(MVP_FPS),
    width: z.literal(MVP_WIDTH),
    height: z.literal(MVP_HEIGHT),
    audio: z
      .object({
        storageKey: z.string().min(1),
        durationMs: z.number().int().positive(),
        src: z.string().min(1).optional(),
      })
      .strict(),
    brand: z
      .object({
        fontFamily: z.string().min(1).max(120),
        textColor: colorSchema,
        captionBackground: z.string().min(1).max(40),
        /** Màu phụ đề theo `speaker`; `narrator` hoặc người nói thiếu màu dùng `textColor`. */
        speakerColors: z.record(characterKeySchema, colorSchema),
        introAssetId: assetIdSchema.nullable(),
        outroAssetId: assetIdSchema.nullable(),
      })
      .strict(),
    scenes: z
      .array(
        z
          .object({
            sceneId: z.string().regex(/^[a-z0-9-]{1,40}$/),
            fromMs: z.number().int().nonnegative(),
            durationMs: z.number().int().positive(),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    shots: z.array(shotSchema).min(1).max(64),
    captions: z.array(remotionCaptionSchema),
    sfx: z.array(
      z.object({ assetId: assetIdSchema, fromFrame: z.number().int().nonnegative() }).strict(),
    ),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      !/^\d+\.\d+\.\d+\+kit\.\d+\.\d+\.\d+$/.test(value.templateVersion) ||
      !value.templateVersion.endsWith(`+kit.${value.motionKitVersion}`)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "templateVersion phải có dạng <version>+kit.<motionKitVersion>",
        path: ["templateVersion"],
      });
    }
    // Shot nối liền nhau, phủ đúng tổng frame của các cảnh.
    let expected = 0;
    value.shots.forEach((shot, i) => {
      if (shot.fromFrame !== expected) {
        ctx.addIssue({
          code: "custom",
          message: `Shot ${shot.shotId} phải bắt đầu ở frame ${expected}`,
          path: ["shots", i, "fromFrame"],
        });
      }
      expected = shot.fromFrame + shot.durationInFrames;
      if (!shot.actors.some((a) => a.character === shot.focus)) {
        ctx.addIssue({
          code: "custom",
          message: `focus ${shot.focus} phải là một nhân vật trong shot`,
          path: ["shots", i, "focus"],
        });
      }
      // Bổ sung ADR-013 2026-11-03: ba người chỉ ở `wide`, `high`.
      if (shot.actors.length > MAX_ACTORS_BY_SHOT_SIZE[shot.shotSize]) {
        ctx.addIssue({
          code: "custom",
          message: `Cỡ ${shot.shotSize} có tối đa ${MAX_ACTORS_BY_SHOT_SIZE[shot.shotSize]} nhân vật`,
          path: ["shots", i, "actors"],
        });
      }
    });
    const sceneIds = new Set(value.scenes.map((s) => s.sceneId));
    value.shots.forEach((shot, i) => {
      if (!sceneIds.has(shot.sceneId)) {
        ctx.addIssue({
          code: "custom",
          message: `Cảnh lạ: ${shot.sceneId}`,
          path: ["shots", i, "sceneId"],
        });
      }
    });
    value.scenes.forEach((scene, i) => {
      const prev = value.scenes[i - 1];
      const from = prev === undefined ? 0 : prev.fromMs + prev.durationMs;
      if (scene.fromMs !== from) {
        ctx.addIssue({
          code: "custom",
          message: `Scene ${scene.sceneId} fromMs phải là ${from}`,
          path: ["scenes", i, "fromMs"],
        });
      }
    });
  });

export type StickStoryRenderProps = z.infer<typeof stickStoryRenderPropsSchema>;
export type StickStoryShot = StickStoryRenderProps["shots"][number];

export function parseStickStoryRenderProps(input: unknown): StickStoryRenderProps {
  const parsed = stickStoryRenderPropsSchema.safeParse(input);
  if (!parsed.success) {
    throw new RenderPropsError(parsed.error.message);
  }
  return parsed.data;
}

/** Tổng frame = frame cuối của shot cuối. */
export function stickStoryDurationInFrames(props: Pick<StickStoryRenderProps, "shots">): number {
  const last = props.shots[props.shots.length - 1];
  return last === undefined ? 1 : last.fromFrame + last.durationInFrames;
}
