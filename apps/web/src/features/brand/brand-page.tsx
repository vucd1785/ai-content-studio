import { CharacterAvatar, type CharacterKey } from "@/components/ui/character-avatar";
import { YoutubeConnectCard } from "@/features/youtube/youtube-connect";
import { vi } from "@/i18n/vi";
import { BrandContactForm } from "./brand-contact";

const CHARACTERS: { key: CharacterKey; pose: string; colorVar: string }[] = [
  { key: "ti", pose: "wave", colorVar: "var(--speaker-ti)" },
  { key: "bit", pose: "idle", colorVar: "var(--speaker-bit)" },
  { key: "dau", pose: "idea", colorVar: "var(--speaker-dau)" },
];

const PALETTE: [string, string][] = [
  ["#f4efe6", vi.brand.colors.paper],
  ["#1f2a44", vi.brand.colors.ink],
  ["#f26b3a", vi.brand.colors.orange],
  ["#8fe9ff", vi.brand.colors.screen],
  ["#6cc04a", vi.brand.colors.leaf],
  ["#2bb3a3", vi.brand.colors.dau],
];

/**
 * Bộ nhận diện kênh (P7-09): logo, bảng màu, font, ba nhân vật và màu thoại theo ui-kit. Sửa kênh, chọn giọng
 * và nghe thử cần API kênh (P6-11) nên mang nhãn "Sắp có"; không có thao tác giả.
 */
export function BrandPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-semibold">{vi.shell.navBrand}</h1>
        <span className="bg-warning-bg text-warning rounded-full px-3 py-1 text-xs font-semibold">
          {vi.shell.comingSoon}: {vi.brand.editLater}
        </span>
      </div>
      <BrandContactForm />
      <YoutubeConnectCard />
      <section
        aria-label={vi.brand.identity}
        className="bg-card flex flex-wrap gap-6 rounded-2xl border p-5"
      >
        <div className="flex flex-col items-center gap-2">
          <img src="/assets/brand/logo_mark.svg" alt="" className="size-20" />
          <span className="text-sm font-semibold">{vi.app.name}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <h2 className="text-lg font-semibold">{vi.brand.palette}</h2>
          <ul className="flex flex-wrap gap-3">
            {PALETTE.map(([hex, name]) => (
              <li key={hex} className="flex items-center gap-2 text-sm">
                <span className="size-8 rounded-lg border" style={{ background: hex }} />
                <span className="flex flex-col">
                  <span className="font-semibold">{name}</span>
                  <code className="text-muted-foreground text-xs">{hex}</code>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm">
            <span className="font-semibold">{vi.brand.font}:</span> Be Vietnam Pro (SIL OFL 1.1)
          </p>
        </div>
      </section>
      <section aria-label={vi.brand.characters} className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{vi.brand.characters}</h2>
        <ul className="grid gap-3 md:grid-cols-3">
          {CHARACTERS.map((c) => (
            <li
              key={c.key}
              className="bg-card flex flex-col items-center gap-2 rounded-2xl border p-4"
            >
              <CharacterAvatar character={c.key} pose={c.pose} size={120} />
              <span className="text-lg font-semibold" style={{ color: c.colorVar }}>
                {(vi.scriptReview.speakers as Record<string, string>)[c.key]}
              </span>
              <span className="text-muted-foreground text-xs">{vi.brand.speakerColor}</span>
              <span className="text-muted-foreground text-xs">
                {vi.brand.voice}: {vi.shell.comingSoon}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
