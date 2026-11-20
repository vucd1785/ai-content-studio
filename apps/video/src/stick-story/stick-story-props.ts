import { audioKitFile, isSfxId } from "@studio/audio-kit";
import { MAX_ACTORS_BY_SHOT_SIZE, remotionCaptionSchema } from "@studio/contracts";
import { z } from "zod/v4";
import {
  MVP_FPS,
  MVP_HEIGHT,
  MVP_WIDTH,
  RenderPropsError,
  WIDE_HEIGHT,
  WIDE_WIDTH,
} from "../render-props/common";

/**
 * Render props của template `StickStory` (P6-09; 05 mục Template `StickStory`; ADR-014).
 * Director 2026-11-03: video chỉ có hoạt hình và phụ đề lời thoại; không chữ phủ màn hình,
 * không khung bảng code/sơ đồ, nên props không có `onScreenText` và `board`.
 * Ngoại lệ duy nhất (ADR-021, Director 2026-11-12): thẻ tiêu đề ở đầu và thẻ kênh ở cuối video (`cards`).
 * File này không import motion kit (worker typecheck không có JSX); version kit được ghim ở đây và
 * test của `apps/video` buộc nó khớp `MOTION_KIT_VERSION` của `packages/motion-kit`.
 */
export const STICK_STORY_TEMPLATE_ID = "StickStory" as const;
export const STICK_STORY_COMPOSITION_ID = "StickStory";
/**
 * Version của composition; tăng khi đổi cách vẽ hoặc tiếng (1.2.0: vẽ `props`, P6-19; 1.4.0: `illustration`;
 * 1.5.0: nhạc nền, SFX, ADR-019; 1.6.0: thẻ mở đầu, kết thúc, ADR-021; 1.7.0: khung ngang 16:9, ADR-022; 1.8.0: lớp chiều sâu, tông ánh sáng, ADR-023; 1.9.0: hiệu ứng, hành động, góc máy mới, ADR-025; 1.10.0: cảnh kết mời theo dõi, ADR-026; 1.11.0: avatar kênh trên thẻ kết, ADR-028; 1.12.0: bố cục khung ngang, khung minh họa, cờ, thẻ kết mới, ADR-029). Tạo lại file của `@studio/audio-kit` cũng phải tăng version này để cache
 * MP4 không trả bản trộn cũ.
 */
export const STICK_STORY_BASE_VERSION = "1.13.0";
/** Version motion kit mà template này được dựng và kiểm với; phải bằng `MOTION_KIT_VERSION`. */
export const STICK_STORY_MOTION_KIT_VERSION = "0.12.1";

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
/** Chữ trên thẻ: một dòng, không xuống dòng, không ký tự điều khiển. */
const cardTextSchema = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((text) => !/[\n\r\t]/u.test(text), "Thẻ chỉ có một dòng");

/** Thời lượng thẻ (frame, 30 fps): tiêu đề 2,4 giây đầu; thẻ kênh 3 giây cuối (ADR-021). */
export const INTRO_CARD_FRAMES = 72;
export const OUTRO_CARD_FRAMES = 90;

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
    /** Trang phục (ADR-032). */
    outfit: z.enum(["spacesuit", "lab_coat", "hard_hat", "business_suit"]).optional(),
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
    /** Tông ánh sáng của shot (ADR-023). */
    mood: z.enum(["day", "warm", "cool", "night", "danger", "wonder"]).optional(),
    /** Hiệu ứng điểm nhấn của shot (ADR-025). */
    effects: z
      .array(z.enum(["flash", "impact", "speed_lines", "sparkle", "idea", "confetti", "question"]))
      .max(2)
      .optional(),
    /** Minh họa khi giải thích (ADR-014 bổ sung 2026-11-11): chỉ hình, không chữ. */
    illustration: z
      .object({
        style: z.enum(["scene", "bubble", "board"]),
        owner: characterKeySchema,
        items: z.array(assetIdSchema).min(1).max(3),
      })
      .strict()
      .optional(),
  })
  .strict();

export const stickStoryRenderPropsSchema = z
  .object({
    templateId: z.literal(STICK_STORY_TEMPLATE_ID),
    templateVersion: z.string().min(1),
    motionKitVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    fps: z.literal(MVP_FPS),
    /** Khung dọc 1080×1920 (mặc định) hoặc khung ngang 1920×1080 (ADR-022); cặp kiểm ở dưới. */
    width: z.union([z.literal(MVP_WIDTH), z.literal(WIDE_WIDTH)]),
    height: z.union([z.literal(MVP_HEIGHT), z.literal(WIDE_HEIGHT)]),
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
    /**
     * Thẻ chữ (ADR-021): tiêu đề video ở đầu, tên kênh và lời mời theo dõi ở cuối. Phủ lên hoạt hình ở phần trên
     * khung hình, không kéo dài video, không che phụ đề. Thiếu là video không thẻ.
     */
    cards: z
      .object({
        intro: z
          .object({
            title: cardTextSchema(80),
            /**
             * Frame kết thúc thẻ (ADR-026): cuối cảnh đọc tiêu đề, để chữ trắng hiện suốt lúc nhân vật đọc. Không
             * có hoặc ngắn hơn thì 2,4 giây đầu như ADR-021.
             */
            toFrame: z.number().int().min(0).optional(),
          })
          .strict()
          .optional(),
        outro: z
          .object({
            /** Null khi kênh chưa đặt tên: thẻ chỉ có lời mời. */
            channel: cardTextSchema(60).nullable(),
            /** Lời mời. ADR-026: chính câu nhân vật đọc ở cảnh kết, chữ trắng như thẻ tiêu đề. */
            cta: cardTextSchema(90),
            /** Nút đỏ dưới lời mời (ADR-026, ví dụ "Follow"); không có thì lời mời nằm trong nút đỏ như ADR-021. */
            button: cardTextSchema(24).optional(),
            /** Màu nhấn của tên kênh trên thẻ mời theo dõi (`palette.accent` của kênh, ADR-026). */
            accent: colorSchema.optional(),
            /**
             * Avatar kênh (ADR-028), khóa `staticFile` trong `render/public`: thay chữ tên kênh trên thẻ mời theo dõi
             * (logo đã có tên). Không có thì thẻ hiện tên kênh bằng chữ.
             */
            avatar: z
              .string()
              .regex(/^brand\/[a-z0-9-]{1,40}\/avatar-[0-9a-f]{12}\.(png|webp|jpg|jpeg)$/)
              .optional(),
            /**
             * Frame bắt đầu hiện thẻ (ADR-026): đầu cảnh mời theo dõi, để nút theo dõi hiện đúng lúc nhân vật chỉ
             * lên. Không có thì 3 giây cuối như ADR-021.
             */
            fromFrame: z.number().int().min(0).optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    /** Nhạc nền tự tạo (ADR-019): id `music_<mood>` của `@studio/audio-kit`; thiếu là video không nhạc. */
    music: z
      .object({
        assetId: z.string().refine((id) => audioKitFile(id)?.startsWith("music_") === true),
      })
      .strict()
      .optional(),
    /** Hiệu ứng âm thanh (ADR-019): id `sfx_*` của `@studio/audio-kit`, đặt theo frame tuyệt đối. */
    sfx: z.array(
      z
        .object({
          assetId: z.string().refine((id) => isSfxId(id), "SFX không có trong thư viện âm thanh"),
          fromFrame: z.number().int().nonnegative(),
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((value, ctx) => {
    const vertical = value.width === MVP_WIDTH && value.height === MVP_HEIGHT;
    const wide = value.width === WIDE_WIDTH && value.height === WIDE_HEIGHT;
    if (!vertical && !wide) {
      ctx.addIssue({
        code: "custom",
        message: `Khung hình phải là ${MVP_WIDTH}×${MVP_HEIGHT} hoặc ${WIDE_WIDTH}×${WIDE_HEIGHT}`,
        path: ["width"],
      });
    }
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
