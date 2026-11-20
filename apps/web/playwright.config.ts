import { defineConfig, devices } from "@playwright/test";

/**
 * E2E giao diện (P7-10, P2-13). API được chặn bằng `page.route` và trả dữ liệu mẫu trong `e2e/mock-api.ts`;
 * không cần API, DB hay worker thật. Ảnh chụp ghi vào `data/ui-screens/` (không commit).
 */
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5174",
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm exec vite --host 127.0.0.1 --port 5174 --strictPort",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
