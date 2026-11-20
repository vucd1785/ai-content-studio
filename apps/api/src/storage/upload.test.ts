import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES } from "./constants.js";
import {
  assertSafeStorageKey,
  extensionFromFilename,
  imageKind,
  StorageValidationError,
  validateUploadContent,
} from "./upload.js";

describe("storage upload (U1–U4)", () => {
  it("U1 rejects traversal and absolute storage keys", () => {
    expect(() => assertSafeStorageKey("uploads/../secret.txt")).toThrow(StorageValidationError);
    expect(() => assertSafeStorageKey("/uploads/00000000-0000-4000-8000-000000000001.txt")).toThrow(
      StorageValidationError,
    );
  });

  it("U2 rejects NUL in storage key", () => {
    expect(() =>
      assertSafeStorageKey("uploads/00000000-0000-4000-8000-000000000001.t\0xt"),
    ).toThrow(StorageValidationError);
  });

  it("U3 rejects pdf without %PDF signature", () => {
    expect(() => validateUploadContent("pdf", Buffer.from("NOTPDF"))).toThrow(
      StorageValidationError,
    );
  });

  it("U4 rejects buffer larger than 10 MiB", () => {
    const huge = Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0);
    huge.write("%PDF", 0);
    expect(() => validateUploadContent("pdf", huge)).toThrow(StorageValidationError);
  });
});

describe("ảnh tải lên cho video (ADR-030)", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")]);

  it("nhận png, jpg, jpeg, webp theo đuôi; svg, gif vẫn bị từ chối", () => {
    expect(extensionFromFilename("ban-do-chile.png")).toBe("png");
    expect(extensionFromFilename("anh.JPEG")).toBe("jpeg");
    expect(extensionFromFilename("anh.webp")).toBe("webp");
    expect(extensionFromFilename("ve.svg")).toBeNull();
    expect(extensionFromFilename("dong.gif")).toBeNull();
  });

  it("sniff chữ ký thật: đúng loại thì qua, đổi đuôi hoặc nội dung lạ thì từ chối", () => {
    expect(imageKind(png)).toBe("png");
    expect(imageKind(jpg)).toBe("jpg");
    expect(imageKind(webp)).toBe("webp");
    expect(() => validateUploadContent("png", png)).not.toThrow();
    expect(() => validateUploadContent("jpeg", jpg)).not.toThrow();
    expect(() => validateUploadContent("webp", webp)).not.toThrow();
    expect(() => validateUploadContent("png", jpg)).toThrow(StorageValidationError);
    expect(() => validateUploadContent("jpg", Buffer.from("<svg onload=x>"))).toThrow(
      StorageValidationError,
    );
  });
});
