import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { vi } from "@/i18n/vi";

/** Ảnh storyboard cỡ lớn trong hộp thoại (P7-07). Esc hoặc nút Đóng để quay lại; focus về nút đóng. */
export function StillLightbox({
  src,
  alt,
  onClose,
}: {
  src: string | null;
  alt: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) {
      return;
    }
    if (src !== null && !dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
      closeRef.current?.focus();
    } else if (src === null && dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [src]);
  return (
    <dialog
      ref={ref}
      aria-label={alt}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="bg-card m-auto rounded-2xl border p-4 backdrop:bg-black/60"
    >
      {src === null ? null : (
        <div className="flex flex-col items-end gap-3">
          <Button ref={closeRef} type="button" variant="outline" size="sm" onClick={onClose}>
            {vi.scriptReview.closeStill}
          </Button>
          <img src={src} alt={alt} className="h-[78vh] w-auto rounded-xl" />
        </div>
      )}
    </dialog>
  );
}
