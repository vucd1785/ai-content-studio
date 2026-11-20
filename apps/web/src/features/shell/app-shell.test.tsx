import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi as vitest } from "vitest";
import { vi } from "@/i18n/vi";
import { installFakeApi } from "@/test/fake-api";
import { AppShell } from "./app-shell";

/** Từ điều khiển English thường gặp; không được xuất hiện trên nút (tiêu chí P2-05). */
const ENGLISH_CONTROL_WORDS =
  /\b(log ?in|log ?out|sign ?in|sign ?out|submit|cancel|save|new|create|project|delete|edit|ok|approve|reject|settings|loading|back|next|upload)\b/i;

function dictionaryValues(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (typeof node === "object" && node !== null) {
    return Object.values(node).flatMap(dictionaryValues);
  }
  return [];
}

function renderShell() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AppShell />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  installFakeApi();
});

afterEach(() => {
  cleanup();
  vitest.unstubAllGlobals();
});

describe("AppShell", () => {
  it("không có chuỗi điều khiển tiếng Anh trên các nút; mọi nhãn nút lấy từ từ điển vi", async () => {
    renderShell();
    await screen.findByText(vi.shell.projectsEmpty);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    const allowed = new Set(dictionaryValues(vi));
    for (const button of buttons) {
      const label = button.textContent?.trim() ?? "";
      expect(label).not.toBe("");
      expect(allowed.has(label), label).toBe(true);
      expect(ENGLISH_CONTROL_WORDS.test(label), label).toBe(false);
    }
  });

  it("ba vùng: điều hướng, vùng chính là trang tổng quan, panel giám sát (P7-04)", async () => {
    renderShell();
    expect(screen.getByRole("main", { name: vi.shell.regionWorkspace })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: vi.home.heading })).toBeTruthy();
    expect(screen.getByRole("complementary", { name: vi.shell.regionProjects })).toBeTruthy();
    expect(screen.getByRole("complementary", { name: vi.shell.regionMonitor })).toBeTruthy();
    expect(screen.getByTestId("worker-status").textContent).toBe(vi.worker.stopped);
    expect(
      screen.getByRole("button", { name: vi.shell.navOverview }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("chế độ Tập trung ẩn panel giám sát; theme Tối đặt lớp dark và được nhớ (P7-04)", async () => {
    renderShell();
    await screen.findByRole("heading", { name: vi.home.heading });
    fireEvent.click(screen.getByRole("button", { name: vi.shell.modes.focus }));
    expect(screen.queryByRole("complementary", { name: vi.shell.regionMonitor })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: vi.shell.themes.dark }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem("studio.ui-prefs")).toContain('"theme":"dark"');
    fireEvent.click(screen.getByRole("button", { name: vi.shell.themes.light }));
    fireEvent.click(screen.getByRole("button", { name: vi.shell.modes.work }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("điều hướng ghi vào hash: Kho hình động mở màn riêng (P7-04)", async () => {
    renderShell();
    await screen.findByRole("heading", { name: vi.home.heading });
    fireEvent.click(screen.getByRole("button", { name: vi.shell.navLibrary }));
    expect(window.location.hash).toBe("#/library");
    expect(await screen.findByRole("heading", { name: vi.shell.navLibrary })).toBeTruthy();
  });

  it("từ điển vi không chứa từ điều khiển English (trừ tên sản phẩm và thuật ngữ Brief)", () => {
    for (const value of dictionaryValues(vi)) {
      if (value === vi.app.name) continue;
      expect(ENGLISH_CONTROL_WORDS.test(value), value).toBe(false);
    }
  });
});
