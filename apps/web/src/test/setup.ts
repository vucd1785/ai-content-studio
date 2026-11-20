import { beforeEach } from "vitest";

/** Mỗi test bắt đầu ở trang tổng quan (P7-04: vị trí nằm trên hash của URL) và theme mặc định. */
beforeEach(() => {
  if (typeof window !== "undefined") {
    window.history.replaceState(null, "", "/");
    try {
      window.localStorage.clear();
    } catch {
      // jsdom luôn có localStorage; giữ an toàn nếu bị chặn.
    }
  }
});
