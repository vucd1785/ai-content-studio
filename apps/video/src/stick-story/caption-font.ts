import { continueRender, delayRender } from "remotion";
import beVietnamBold from "../fonts/BeVietnamPro-Bold.ttf";
import beVietnamExtraBold from "../fonts/BeVietnamPro-ExtraBold.ttf";

/**
 * Font phụ đề `StickStory` (ADR-013 bổ sung 2026-11-09): Be Vietnam Pro, SIL OFL 1.1, file trong repo nên render
 * không cần mạng và lần nào cũng như nhau. Font của brand kit đứng sau làm dự phòng.
 */
export const CAPTION_FONT_FAMILY = "Be Vietnam Pro";

export function captionFontStack(brandFont: string): string {
  return `'${CAPTION_FONT_FAMILY}', ${brandFont}`;
}

const FACES: readonly { src: string; weight: string }[] = [
  { src: beVietnamBold, weight: "700" },
  { src: beVietnamExtraBold, weight: "800" },
];

// Nạp một lần khi bundle chạy trong trình duyệt; render chờ font xong mới chụp frame.
if (typeof window !== "undefined" && typeof FontFace !== "undefined") {
  const handle = delayRender(`Nạp font ${CAPTION_FONT_FAMILY}`);
  Promise.all(
    FACES.map(async ({ src, weight }) => {
      const face = new FontFace(CAPTION_FONT_FAMILY, `url(${src}) format("truetype")`, { weight });
      document.fonts.add(await face.load());
    }),
  )
    .catch((error: unknown) => {
      // Thiếu font thì dùng font dự phòng của brand kit, không chặn render.
      console.warn(`Không nạp được font ${CAPTION_FONT_FAMILY}`, error);
    })
    .finally(() => continueRender(handle));
}
