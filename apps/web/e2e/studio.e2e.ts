import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { IDS, installMockApi, REPO, type Scenario } from "./mock-api";

/**
 * E2E giao diện mới (P7-10): luồng chính trên API giả, ảnh chụp sáng/tối ở 1440 và 1280, tablet, bàn phím.
 * Ảnh ghi vào data/ui-screens/ để Director xem; không commit.
 */
const SHOTS = join(REPO, "data", "ui-screens");
mkdirSync(SHOTS, { recursive: true });

const SIZES = {
  w1440: { width: 1440, height: 900 },
  w1280: { width: 1280, height: 800 },
  tablet: { width: 1024, height: 768 },
} as const;

async function open(page: Page, scenario: Scenario, hash: string, theme: "light" | "dark") {
  await installMockApi(page, scenario);
  await page.addInitScript((t) => {
    window.localStorage.setItem("studio.ui-prefs", JSON.stringify({ theme: t, mode: "work" }));
  }, theme);
  await page.goto(`/${hash}`);
}

async function shot(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: false });
}

const PROJECT = `#/projects/${IDS.p1}`;

for (const theme of ["light", "dark"] as const) {
  for (const [sizeName, size] of Object.entries(SIZES)) {
    test(`tổng quan ${theme} ${sizeName}`, async ({ page }) => {
      await page.setViewportSize(size);
      await open(page, { status: "waiting_script_approval" }, "#/", theme);
      await expect(page.getByRole("heading", { name: "Dự án của bạn" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Cần bạn xử lý" })).toBeVisible();
      // Trang tổng quan không có nút duyệt; chỉ có "Mở để duyệt →" để đi tới cổng.
      await expect(page.getByRole("button", { name: /^Duyệt/ })).toHaveCount(0);
      // Nút chế độ và theme dùng được cả ở tablet.
      await expect(page.getByRole("button", { name: "Tối" })).toBeVisible();
      await shot(page, `01-dashboard-${theme}-${sizeName}`);
    });
  }
}

test("đăng nhập: chưa có phiên thì hiện form tiếng Việt", async ({ page }) => {
  await page.setViewportSize(SIZES.w1440);
  await page.route("**/api/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"authenticated":false}',
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("alert")).toHaveText("Vui lòng nhập mật khẩu.");
  await shot(page, "00-login-light-w1440");
});

for (const theme of ["light", "dark"] as const) {
  test(`đang chạy bình thường ${theme}`, async ({ page }) => {
    await page.setViewportSize(SIZES.w1440);
    await open(page, { status: "producing_assets" }, `${PROJECT}/running`, theme);
    await expect(page.getByTestId("run-steps")).toBeVisible();
    await expect(page.getByTestId("progress-assets")).toContainText("cảnh 3/7");
    await shot(page, `02-running-${theme}-w1440`);
  });
}

test("brief: ô nhiều dòng có bộ đếm, cột phải có bắt đầu và tài liệu", async ({ page }) => {
  await page.setViewportSize(SIZES.w1440);
  await open(page, { status: "waiting_script_approval" }, `${PROJECT}/brief`, "light");
  const form = page.getByRole("form", { name: "Brief" });
  await expect(form.getByLabel("Chủ đề")).toHaveJSProperty("tagName", "TEXTAREA");
  await expect(form.getByLabel("Ghi chú")).toHaveJSProperty("tagName", "TEXTAREA");
  await expect(page.getByRole("heading", { name: "Tài liệu tham khảo" })).toBeVisible();
  await page.screenshot({ path: join(SHOTS, "01b-brief-light-w1440.png"), fullPage: true });
});

test("đang chạy lỗi: hộp lỗi dễ hiểu, chi tiết thu gọn, chạy lại", async ({ page }) => {
  await page.setViewportSize(SIZES.w1440);
  await open(
    page,
    {
      status: "failed",
      failure: {
        role: "voice",
        code: "synthesis_failed",
        message: "Scene c6: socket hang up",
      },
    },
    `${PROJECT}/running`,
    "light",
  );
  const error = page.getByTestId("run-error");
  await expect(error).toContainText("Đọc lời (TTS) thất bại.");
  await expect(error.getByText("Scene c6: socket hang up")).toBeHidden();
  await error.getByText("Chi tiết kỹ thuật").click();
  await expect(error.getByText(/socket hang up/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Chạy lại bước lỗi" })).toBeVisible();
  await shot(page, "03-running-error-light-w1440");
});

test("worker tắt: thông báo riêng, khác lỗi của bước", async ({ page }) => {
  await page.setViewportSize(SIZES.w1440);
  await open(
    page,
    { status: "producing_assets", workerAlive: false },
    `${PROJECT}/running`,
    "light",
  );
  await expect(page.getByText("Worker đã tắt").first()).toBeVisible();
  await shot(page, "03b-worker-offline-light-w1440");
});

test("hủy lượt chạy: hộp thoại, focus ở Giữ lượt chạy, Esc đóng", async ({ page }) => {
  await page.setViewportSize(SIZES.w1440);
  await open(page, { status: "producing_assets" }, `${PROJECT}/running`, "light");
  await page.getByRole("button", { name: "Hủy lượt chạy" }).click();
  const dialog = page.getByRole("dialog", { name: "Hủy lượt chạy này?" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Giữ lượt chạy" })).toBeFocused();
  await shot(page, "04-cancel-dialog-light-w1440");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

for (const theme of ["light", "dark"] as const) {
  test(`cổng 1 ${theme}: hai phương án, storyboard, tài sản mới`, async ({ page }) => {
    await page.setViewportSize(SIZES.w1440);
    await open(page, { status: "waiting_script_approval" }, `${PROJECT}/script`, theme);
    const first = page.getByRole("article", { name: "Phương án 1" });
    await expect(first.getByRole("region", { name: "Tài sản hình động mới" })).toContainText(
      "Mới tạo · được duyệt cùng phương án này",
    );
    await expect(page.getByRole("button", { name: "Duyệt phương án 1" })).toBeVisible();
    await shot(page, `05-gate1-${theme}-w1440`);
    await first.getByRole("button", { name: "Storyboard cảnh mo-dau" }).click();
    await expect(page.getByRole("button", { name: "Đóng" })).toBeFocused();
    await shot(page, `05b-gate1-still-${theme}-w1440`);
    await page.keyboard.press("Escape");
  });
}

for (const passed of [true, false]) {
  test(`cổng 2 QA ${passed ? "đạt" : "lỗi"}`, async ({ page }) => {
    await page.setViewportSize(SIZES.w1440);
    await open(
      page,
      { status: "waiting_final_approval", qaPassed: passed },
      `${PROJECT}/final`,
      "light",
    );
    await expect(page.getByTestId("qa-status")).toBeVisible();
    const approve = page.getByRole("button", { name: "Duyệt và xuất bản này" });
    if (passed) {
      await expect(approve).toBeEnabled();
    } else {
      await expect(approve).toBeDisabled();
    }
    await shot(page, `06-gate2-${passed ? "passed" : "blocked"}-light-w1440`);
  });
}

for (const [hash, name] of [
  ["#/usage", "07-usage"],
  ["#/library", "08-library"],
  ["#/brand", "09-brand"],
] as const) {
  test(`trang ${name}`, async ({ page }) => {
    await page.setViewportSize(SIZES.w1440);
    await open(page, { status: "producing_assets" }, hash, "light");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await shot(page, `${name}-light-w1440`);
  });
}

test("chế độ Tập trung và Giám sát", async ({ page }) => {
  await page.setViewportSize(SIZES.w1440);
  await open(page, { status: "producing_assets" }, `${PROJECT}/running`, "light");
  await page.getByRole("button", { name: "Tập trung" }).click();
  await expect(page.getByRole("complementary", { name: "Giám sát" })).toHaveCount(0);
  await shot(page, "10-focus-light-w1440");
  await page.getByRole("button", { name: "Giám sát" }).click();
  await expect(page.getByRole("heading", { name: "Studio 3D theo dõi các vai trò" })).toBeVisible();
  await page.waitForTimeout(5000);
  await shot(page, "11-monitor-light-w1440");
});

test("bàn phím: Tab tới điều hướng có viền focus rõ", async ({ page }) => {
  await page.setViewportSize(SIZES.w1440);
  await open(page, { status: "producing_assets" }, "#/", "light");
  await expect(page.getByRole("heading", { name: "Dự án của bạn" })).toBeVisible();
  let found = false;
  for (let i = 0; i < 12 && !found; i++) {
    await page.keyboard.press("Tab");
    found = await page.evaluate(() => document.activeElement?.textContent === "Tổng quan");
  }
  expect(found).toBe(true);
  const outline = await page.evaluate(
    () => getComputedStyle(document.activeElement as Element).outlineStyle,
  );
  expect(outline).toBe("solid");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/$/);
});

test("bản cuối đã xuất: bộ đăng bài ba mạng, sao chép, nhắc thiếu liên hệ (ADR-018)", async ({
  page,
}) => {
  await page.setViewportSize(SIZES.w1440);
  await open(page, { status: "exported" }, `${PROJECT}/final`, "light");
  const kit = page.getByTestId("publish-kit");
  await expect(kit.getByRole("heading", { name: "Bộ đăng bài" })).toBeVisible();
  await expect(kit.getByRole("tab", { name: "YouTube" })).toHaveAttribute("aria-selected", "true");
  await expect(kit.getByLabel("Tiêu đề")).toHaveValue(/Vì sao thức khuya/);
  await expect(kit.getByRole("note")).toContainText("thiếu liên hệ bản quyền");
  await kit.getByRole("tab", { name: "TikTok" }).click();
  await expect(kit.getByLabel("Chú thích")).toHaveValue(/#GiacNgu/);
  await kit.getByRole("tab", { name: "YouTube" }).click();
  await shot(page, "12-publish-kit-light-w1440");
});

test("trang hướng dẫn đăng bài và ô liên hệ bản quyền (ADR-018)", async ({ page }) => {
  await page.setViewportSize(SIZES.w1440);
  await open(page, { status: "exported" }, "#/publish-guide", "light");
  await expect(page.getByRole("heading", { name: "Hướng dẫn đăng bài", level: 1 })).toBeVisible();
  for (const name of [
    "2. YouTube (Shorts)",
    "3. Facebook (Reels)",
    "4. TikTok",
    "5. Bản quyền và AI",
  ]) {
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }
  await page.screenshot({ path: join(SHOTS, "13-publish-guide-light-w1440.png"), fullPage: true });
  await page.goto("/#/brand");
  await expect(page.getByLabel("Email hoặc trang liên hệ")).toBeVisible();
});
