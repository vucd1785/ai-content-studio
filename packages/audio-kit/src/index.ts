/**
 * Thư viện âm thanh của kênh (ADR-019): nhạc nền và hiệu ứng âm thanh tự tạo bằng code trong repo
 * (`src/synth.ts`, chạy `pnpm --dir packages/audio-kit generate`). Không tải nhạc ngoài nên không có
 * license bên thứ ba; file WAV trong `assets/` là sản phẩm của chủ dự án (xem `LICENSE.md`).
 *
 * File này chỉ là danh mục, không import gì, để cả worker và composition Remotion dùng chung.
 */

/** Không khí nhạc nền mà kịch bản chọn (`ScriptV2.music`). Thứ tự này là thứ tự trong prompt. */
export const MUSIC_MOODS = ["vui_tuoi", "to_mo", "nhe_nhang", "soi_dong"] as const;
export type MusicMood = (typeof MUSIC_MOODS)[number];

/** Nhạc mặc định khi kịch bản không chọn (kịch bản cũ, chế độ không có trường `music`). */
export const DEFAULT_MUSIC_MOOD: MusicMood = "vui_tuoi";

export type MusicTrack = {
  id: `music_${MusicMood}`;
  mood: MusicMood;
  /** Tên hiển thị tiếng Việt. */
  label: string;
  /** Mô tả ngắn cho prompt và trang Tài sản. */
  description: string;
  file: string;
  bpm: number;
};

export const MUSIC_TRACKS: Record<MusicMood, MusicTrack> = {
  vui_tuoi: {
    id: "music_vui_tuoi",
    mood: "vui_tuoi",
    label: "Vui tươi",
    description: "ukulele gảy, chuông nhỏ, trống nhẹ; hợp chuyện đời thường, hài nhẹ",
    file: "music_vui_tuoi.wav",
    bpm: 112,
  },
  to_mo: {
    id: "music_to_mo",
    mood: "to_mo",
    label: "Tò mò",
    description: "pizzicato nhún nhảy, mõ gỗ; hợp câu hỏi bí ẩn, khám phá, giải mã",
    file: "music_to_mo.wav",
    bpm: 96,
  },
  nhe_nhang: {
    id: "music_nhe_nhang",
    mood: "nhe_nhang",
    label: "Nhẹ nhàng",
    description: "nền pad ấm, rải hợp âm chậm; hợp thiên nhiên, cảm xúc, ngủ, sức khỏe",
    file: "music_nhe_nhang.wav",
    bpm: 84,
  },
  soi_dong: {
    id: "music_soi_dong",
    mood: "soi_dong",
    label: "Sôi động",
    description: "trống bốn nhịp, bass nảy; hợp công nghệ, thử thách, tốc độ",
    file: "music_soi_dong.wav",
    bpm: 128,
  },
};

export const SFX_IDS = [
  "sfx_pop",
  "sfx_whoosh",
  "sfx_ding",
  "sfx_boing",
  "sfx_sparkle",
  "sfx_scribble",
  "sfx_blip",
] as const;
export type SfxId = (typeof SFX_IDS)[number];

export type SfxClip = {
  id: SfxId;
  label: string;
  file: string;
  /** Âm lượng khi trộn với giọng đọc (0..1). */
  volume: number;
};

export const SFX_CLIPS: Record<SfxId, SfxClip> = {
  sfx_pop: { id: "sfx_pop", label: "Bật ra", file: "sfx_pop.wav", volume: 0.45 },
  sfx_whoosh: { id: "sfx_whoosh", label: "Vút qua", file: "sfx_whoosh.wav", volume: 0.3 },
  sfx_ding: { id: "sfx_ding", label: "Ting", file: "sfx_ding.wav", volume: 0.35 },
  sfx_boing: { id: "sfx_boing", label: "Bùng nhún", file: "sfx_boing.wav", volume: 0.4 },
  sfx_sparkle: { id: "sfx_sparkle", label: "Lấp lánh", file: "sfx_sparkle.wav", volume: 0.35 },
  sfx_scribble: { id: "sfx_scribble", label: "Bút vẽ", file: "sfx_scribble.wav", volume: 0.35 },
  sfx_blip: { id: "sfx_blip", label: "Bíp", file: "sfx_blip.wav", volume: 0.3 },
};

/** Thư mục con trong `publicDir` của Remotion nơi worker chép file của thư viện. */
export const AUDIO_KIT_PUBLIC_DIR = "audio-kit";

/**
 * Mức nhạc nền khi trộn (biên độ 0..1): `base` lúc không ai nói, `duck` lúc có lời thoại.
 * Nhạc lên xuống trong `rampFrames`, vào dần đầu video và tắt dần cuối video.
 */
export const MUSIC_MIX = {
  base: 0.5,
  duck: 0.22,
  rampFrames: 8,
  fadeInFrames: 20,
  fadeOutFrames: 45,
} as const;

export function isMusicMood(value: unknown): value is MusicMood {
  return typeof value === "string" && (MUSIC_MOODS as readonly string[]).includes(value);
}

export function isSfxId(value: unknown): value is SfxId {
  return typeof value === "string" && (SFX_IDS as readonly string[]).includes(value);
}

/** Id tài sản nhạc (`music_<mood>`) hoặc SFX → tên file trong `assets/`. */
export function audioKitFile(assetId: string): string | null {
  if (isSfxId(assetId)) {
    return SFX_CLIPS[assetId].file;
  }
  const mood = assetId.startsWith("music_") ? assetId.slice("music_".length) : "";
  return isMusicMood(mood) ? MUSIC_TRACKS[mood].file : null;
}
