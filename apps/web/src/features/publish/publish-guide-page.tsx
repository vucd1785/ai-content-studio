import { vi } from "@/i18n/vi";
import {
  GUIDE_DISCLAIMER,
  GUIDE_INTRO,
  GUIDE_SECTIONS,
  GUIDE_UPDATED,
} from "./publish-guide-content";

/** Trang "Hướng dẫn đăng bài" (ADR-018): một quy trình cho mọi video, không theo từng video. */
export function PublishGuidePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{vi.publishGuide.heading}</h1>
        <p className="text-muted-foreground text-sm">
          {GUIDE_INTRO} <span className="whitespace-nowrap">({GUIDE_UPDATED})</span>
        </p>
      </header>
      <nav aria-label={vi.publishGuide.tocLabel} className="flex flex-wrap gap-2">
        {GUIDE_SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#/publish-guide`}
            onClick={(event) => {
              event.preventDefault();
              document
                .getElementById(`guide-${section.id}`)
                ?.scrollIntoView({ behavior: "smooth" });
            }}
            className="bg-card rounded-full border px-3 py-1 text-sm"
          >
            {section.title.replace(/^\d+\.\s*/, "")}
          </a>
        ))}
      </nav>
      {GUIDE_SECTIONS.map((section) => (
        <section
          key={section.id}
          id={`guide-${section.id}`}
          aria-labelledby={`guide-${section.id}-title`}
          className="bg-card flex flex-col gap-3 rounded-2xl border p-5"
        >
          <h2 id={`guide-${section.id}-title`} className="text-lg font-semibold">
            {section.title}
          </h2>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed">
            {section.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {section.links === undefined ? null : (
            <ul className="flex flex-col gap-1 text-sm">
              {section.links.map((link) => (
                <li key={link.href}>
                  <a
                    className="text-primary font-semibold underline"
                    href={link.href}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {link.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <p className="text-muted-foreground text-xs">{GUIDE_DISCLAIMER}</p>
    </div>
  );
}
