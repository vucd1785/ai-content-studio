import { type ReactNode, useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";

/**
 * Hộp thoại xác nhận cho hành động không đảo ngược được (P7-04). Dùng `<dialog>` của trình duyệt: khóa focus
 * trong hộp, Esc để đóng. Focus mặc định ở nút an toàn (giữ nguyên), không ở nút nguy hiểm.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const safeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) {
      return;
    }
    if (open && !dialog.open) {
      // jsdom chưa có showModal: vẫn mở được để test.
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
      safeRef.current?.focus();
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="bg-card text-card-foreground m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border p-6 shadow-xl backdrop:bg-black/40"
    >
      <h2 id={titleId} className="text-lg font-semibold">
        {title}
      </h2>
      <div className="text-muted-foreground mt-2 text-sm">{children}</div>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button ref={safeRef} type="button" variant="outline" onClick={onCancel} disabled={pending}>
          {cancelLabel}
        </Button>
        <Button type="button" variant="destructive" onClick={onConfirm} disabled={pending}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
