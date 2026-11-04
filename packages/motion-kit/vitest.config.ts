import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Các test quét mọi tổ hợp tài sản; máy dev chỉ có CPU chậm.
    testTimeout: 60000,
  },
});
