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
    // Dọn dẹp đóng worker BullMQ và xóa queue test; cả suite chạy song song thì vượt 10 s mặc định.
    hookTimeout: 60_000,
    // Phần lớn test worker là tích hợp (PostgreSQL, Redis, BullMQ); máy dev chậm thì 5 s mặc định không đủ.
    testTimeout: 30_000,
  },
});
