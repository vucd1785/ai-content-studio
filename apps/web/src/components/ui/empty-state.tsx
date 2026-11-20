import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Trạng thái trống hoặc lỗi có minh họa của bộ ui-kit (P7-04). Ảnh chỉ trang trí; chữ nằm trong DOM. */
export function EmptyState({
  illustration,
  title,
  children,
  action,
  className,
}: {
  illustration?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-card flex flex-col items-center gap-3 rounded-2xl border px-6 py-8 text-center",
        className,
      )}
    >
      {illustration === undefined ? null : (
        <img src={`/assets/illustrations/${illustration}.svg`} alt="" className="h-28 w-auto" />
      )}
      <p className="text-base font-semibold">{title}</p>
      {children === undefined ? null : (
        <div className="text-muted-foreground max-w-md text-sm">{children}</div>
      )}
      {action}
    </div>
  );
}
