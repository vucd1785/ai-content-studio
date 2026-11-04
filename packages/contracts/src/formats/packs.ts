import { z } from "zod/v4";

/**
 * Gói thể loại (ADR-013, 05 mục Gói thể loại). Thêm gói là thêm dữ liệu, có version.
 * Brief ghi `format_id` + `format_version`; script `2` dùng nhịp, dàn nhân vật và luật nhịp của gói.
 */

const characterKeySchema = z.string().regex(/^[a-z0-9_]{1,32}$/);

export const formatBeatSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]{1,32}$/),
    label: z.string().min(1).max(60),
    requiresSource: z.boolean(),
  })
  .strict();

export const formatPackSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]{1,32}$/),
    version: z.number().int().min(1),
    displayName: z.string().min(1).max(60),
    beats: z.array(formatBeatSchema).min(1).max(12),
    defaultCast: z.array(characterKeySchema).min(1).max(4),
    allowNarrator: z.boolean(),
    research: z.enum(["required", "optional", "off"]),
    durationSec: z
      .object({ min: z.number().int().min(10), max: z.number().int().max(600) })
      .strict(),
    pacing: z
      .object({
        cutsPerMinute: z
          .object({ min: z.number().positive(), max: z.number().positive() })
          .strict(),
        maxStaticSec: z.number().positive(),
        noSameShotSizeInARow: z.literal(true),
      })
      .strict(),
    qaRules: z.array(z.string().regex(/^[a-z0-9_]{1,64}$/)),
  })
  .strict()
  .superRefine((pack, ctx) => {
    const ids = new Set<string>();
    pack.beats.forEach((beat, i) => {
      if (ids.has(beat.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Nhịp trùng: ${beat.id}`,
          path: ["beats", i, "id"],
        });
      }
      ids.add(beat.id);
      if (pack.research === "off" && beat.requiresSource) {
        ctx.addIssue({
          code: "custom",
          message: "Gói không research thì không được có nhịp cần nguồn",
          path: ["beats", i, "requiresSource"],
        });
      }
    });
    if (pack.durationSec.min > pack.durationSec.max) {
      ctx.addIssue({ code: "custom", message: "durationSec.min > max", path: ["durationSec"] });
    }
    const cpm = pack.pacing.cutsPerMinute;
    if (cpm.min > cpm.max) {
      ctx.addIssue({ code: "custom", message: "cutsPerMinute.min > max", path: ["pacing"] });
    }
    // Shot dài nhất `maxStaticSec` ép số cắt ≥ 60 / maxStaticSec; mức này không được vượt
    // `cutsPerMinute.min`, nếu không phần dưới của khoảng nhịp không bao giờ đạt được.
    if (60 / pack.pacing.maxStaticSec > cpm.min + 1e-9) {
      ctx.addIssue({
        code: "custom",
        message: "60 / maxStaticSec lớn hơn cutsPerMinute.min",
        path: ["pacing", "maxStaticSec"],
      });
    }
  });

export type FormatBeat = z.infer<typeof formatBeatSchema>;
export type FormatPack = z.infer<typeof formatPackSchema>;

/**
 * `story` v1 "Hoạt hình": gói chung cho mọi chủ đề (ADR-013 bổ sung (2) 2026-11-03). Brief mới luôn dùng gói này;
 * giao diện không có ô chọn thể loại. Không có người dẫn: Tí, Bit, Đậu nói hết lời thoại.
 */
const STORY_V1: FormatPack = formatPackSchema.parse({
  id: "story",
  version: 1,
  displayName: "Hoạt hình",
  beats: [
    { id: "cold_open", label: "Mở ngay vào tình huống", requiresSource: false },
    { id: "premise", label: "Đặt vấn đề hoặc câu hỏi", requiresSource: false },
    { id: "play", label: "Diễn giải bằng tình huống vui", requiresSource: false },
    { id: "fact", label: "Sự thật có nguồn", requiresSource: true },
    { id: "payoff", label: "Cú chốt", requiresSource: false },
  ],
  defaultCast: ["ti", "bit", "dau"],
  allowNarrator: false,
  research: "required",
  durationSec: { min: 30, max: 90 },
  pacing: { cutsPerMinute: { min: 20, max: 27 }, maxStaticSec: 3, noSameShotSizeInARow: true },
  qaRules: [],
});

/**
 * `what_if` v1 "Nếu như…?": Director chốt 2026-11-03, thời lượng 30–60 giây. Chỉ giữ để đọc brief và run cũ;
 * brief mới không chọn được (ADR-013 bổ sung (2)).
 */
const WHAT_IF_V1: FormatPack = formatPackSchema.parse({
  id: "what_if",
  version: 1,
  displayName: "Nếu như…?",
  beats: [
    { id: "cold_open", label: "Mở ngay vào tình huống", requiresSource: false },
    { id: "premise", label: "Đặt giả thuyết", requiresSource: false },
    { id: "fun", label: "Tưởng tượng vui", requiresSource: false },
    { id: "fact", label: "Sự thật có nguồn", requiresSource: true },
    { id: "twist", label: "Cú twist kết", requiresSource: false },
  ],
  defaultCast: ["ti", "bit", "dau"],
  allowNarrator: false,
  research: "required",
  durationSec: { min: 30, max: 60 },
  pacing: { cutsPerMinute: { min: 20, max: 27 }, maxStaticSec: 3, noSameShotSizeInARow: true },
  qaRules: [],
});

export const FORMAT_PACKS: readonly FormatPack[] = [STORY_V1, WHAT_IF_V1];

/** Gói của mọi brief mới. */
export const DEFAULT_FORMAT = { id: "story", version: 1 } as const;

/** Gói theo id và version của brief; không có thì `undefined`. */
export function getFormatPack(id: string, version: number): FormatPack | undefined {
  return FORMAT_PACKS.find((p) => p.id === id && p.version === version);
}

/** Thời lượng brief có nằm trong khoảng của gói không. */
export function isDurationAllowed(pack: FormatPack, durationSec: number): boolean {
  return durationSec >= pack.durationSec.min && durationSec <= pack.durationSec.max;
}
