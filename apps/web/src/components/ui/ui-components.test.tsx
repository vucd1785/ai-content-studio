import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi as vitest } from "vitest";
import { vi } from "@/i18n/vi";
import { ConfirmDialog } from "./confirm-dialog";
import { StatusBadge } from "./status-badge";
import { Toaster, toast } from "./toast";

afterEach(() => cleanup());

describe("ConfirmDialog (P7-04)", () => {
  it("mở thì focus ở nút an toàn; Đóng gọi onCancel, xác nhận gọi onConfirm", () => {
    const onCancel = vitest.fn();
    const onConfirm = vitest.fn();
    render(
      <ConfirmDialog
        open
        title={vi.runControl.confirmTitle}
        confirmLabel={vi.runControl.confirmCancel}
        cancelLabel={vi.runControl.keepRunning}
        onCancel={onCancel}
        onConfirm={onConfirm}
      >
        {vi.runControl.cancelHint}
      </ConfirmDialog>,
    );
    const keep = screen.getByRole("button", { name: vi.runControl.keepRunning });
    expect(document.activeElement).toBe(keep);
    fireEvent.click(keep);
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: vi.runControl.confirmCancel }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("Toast (P7-04)", () => {
  it("hiện thông báo trong vùng aria-live", async () => {
    render(<Toaster />);
    act(() => toast(vi.toast.runStarted));
    expect(await screen.findByText(vi.toast.runStarted)).toBeTruthy();
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
  });
});

describe("StatusBadge (P7-04)", () => {
  it("luôn có chữ trạng thái tiếng Việt, không chỉ màu", () => {
    const { rerender } = render(<StatusBadge status="waiting_script_approval" />);
    expect(screen.getByText(vi.runControl.statuses.waiting_script_approval)).toBeTruthy();
    rerender(<StatusBadge status={null} />);
    expect(screen.getByText(vi.home.notStarted)).toBeTruthy();
    rerender(<StatusBadge status="failed" />);
    expect(screen.getByText(vi.runControl.statuses.failed)).toBeTruthy();
  });
});
