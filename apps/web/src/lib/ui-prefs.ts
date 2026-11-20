import { useSyncExternalStore } from "react";

/**
 * Lựa chọn giao diện lưu trên máy (P7-04): theme và chế độ bố cục. Chỉ là tiện ích cho một người xem;
 * storage lỗi (chế độ riêng tư, bị chặn) thì dùng mặc định.
 */
export type Theme = "light" | "dark";
/** Làm việc: ba vùng. Tập trung: ẩn panel giám sát. Giám sát: xưởng mở rộng. */
export type LayoutMode = "work" | "focus" | "monitor";
export type UiPrefs = { theme: Theme; mode: LayoutMode };

const KEY = "studio.ui-prefs";
const DEFAULTS: UiPrefs = { theme: "light", mode: "work" };
const listeners = new Set<() => void>();

function read(): UiPrefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw === null ? {} : (JSON.parse(raw) as Partial<UiPrefs>);
    return {
      theme: parsed.theme === "dark" ? "dark" : "light",
      mode: parsed.mode === "focus" || parsed.mode === "monitor" ? parsed.mode : "work",
    };
  } catch {
    return DEFAULTS;
  }
}

let current: UiPrefs = typeof window === "undefined" ? DEFAULTS : read();

export function applyTheme(theme: Theme): void {
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }
}

export function setUiPrefs(patch: Partial<UiPrefs>): void {
  current = { ...current, ...patch };
  applyTheme(current.theme);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Không lưu được thì vẫn đổi trong phiên này.
  }
  for (const listener of listeners) {
    listener();
  }
}

export function useUiPrefs(): UiPrefs {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => current,
    () => DEFAULTS,
  );
}

/** Gọi một lần khi khởi động để áp theme đã lưu trước khi vẽ. */
export function initUiPrefs(): void {
  current = read();
  applyTheme(current.theme);
}
