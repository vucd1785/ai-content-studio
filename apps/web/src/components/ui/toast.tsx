import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/**
 * Thông báo ngắn (P7-04): kết quả một thao tác vừa xong (đã lưu, đã gửi). Không thay thông báo lỗi tại chỗ của
 * form. Vùng `aria-live` để trình đọc màn hình đọc; tự tắt sau 4 giây.
 */
type Toast = { id: number; message: string; tone: "ok" | "info" };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};

export function toast(message: string, tone: Toast["tone"] = "ok"): void {
  const id = nextId++;
  toasts = [...toasts, { id, message, tone }].slice(-3);
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 4000);
}

export function Toaster() {
  const list = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => toasts,
    () => toasts,
  );
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2"
    >
      {list.map((t) => (
        <p
          key={t.id}
          className={cn(
            "rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-lg",
            t.tone === "ok" ? "bg-success-bg text-success" : "bg-info-bg text-info",
          )}
        >
          {t.message}
        </p>
      ))}
    </div>
  );
}
