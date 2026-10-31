import { describe, expect, it } from "vitest";
import { parseByteRange } from "../routes/artifacts.js";
import { isUnsafeStorageKey, resolveStorageKey } from "./resolve-storage-key.js";

describe("resolve storage_key (08-SECURITY)", () => {
  it("từ chối `..`, ký tự null và path tuyệt đối trước khi đọc đĩa", async () => {
    for (const key of [
      "../x.mp4",
      "render/../../x.mp4",
      "render\\..\\x.mp4",
      "a\0.mp4",
      "/etc/passwd",
      "C:\\x.mp4",
      "\\\\host\\share\\x",
      "",
    ]) {
      expect(isUnsafeStorageKey(key), key).toBe(true);
      // dataDir không tồn tại: nếu hàm chạm đĩa thì cũng chỉ ra null, nhưng key không an toàn bị chặn sớm hơn.
      expect(await resolveStorageKey("/không-tồn-tại", key)).toBeNull();
    }
    for (const key of [
      "render/cache/EduVertical/preview-1.mp4",
      "a..b/c.wav",
      "render/public/x.wav",
    ]) {
      expect(isUnsafeStorageKey(key), key).toBe(false);
    }
  });
});

describe("parseByteRange", () => {
  it("một khoảng, khoảng mở, khoảng đuôi; nhiều khoảng thì bỏ qua; ngoài file thì null", () => {
    expect(parseByteRange(undefined, 10)).toBeUndefined();
    expect(parseByteRange("bytes=2-5", 10)).toEqual({ start: 2, end: 5 });
    expect(parseByteRange("bytes=4-", 10)).toEqual({ start: 4, end: 9 });
    expect(parseByteRange("bytes=-3", 10)).toEqual({ start: 7, end: 9 });
    expect(parseByteRange("bytes=5-99", 10)).toEqual({ start: 5, end: 9 });
    expect(parseByteRange("bytes=0-1,4-5", 10)).toBeUndefined();
    expect(parseByteRange("bytes=10-", 10)).toBeNull();
    expect(parseByteRange("bytes=5-2", 10)).toBeNull();
    expect(parseByteRange("bytes=-", 10)).toBeNull();
    expect(parseByteRange("items=0-1", 10)).toBeNull();
  });
});
