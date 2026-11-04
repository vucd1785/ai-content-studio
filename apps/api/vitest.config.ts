import { defineConfig } from "vitest/config";

/**
 * Test tích hợp chạy trên DB riêng `studio_test` (P3-13), không bao giờ trên DB `studio` mà worker thật đọc.
 * Tạo và migrate DB test: `pnpm --filter @studio/db db:test:prepare`.
 */
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio_test";
if (!new URL(testDatabaseUrl).pathname.endsWith("_test")) {
  throw new Error("TEST_DATABASE_URL phải trỏ tới DB có tên kết thúc bằng _test");
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: { DATABASE_URL: testDatabaseUrl },
    // Dọn dữ liệu test trong afterAll (xóa cascade từng project) quá 10 s mặc định trên máy dev chậm.
    hookTimeout: 60_000,
  },
});
