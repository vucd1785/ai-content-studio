import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES } from "./constants.js";
import {
  assertSafeStorageKey,
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
    expect(() => assertSafeStorageKey("uploads/00000000-0000-4000-8000-000000000001.t\0xt")).toThrow(
      StorageValidationError,
    );
  });

  it("U3 rejects pdf without %PDF signature", () => {
    expect(() => validateUploadContent("pdf", Buffer.from("NOTPDF"))).toThrow(StorageValidationError);
  });

  it("U4 rejects buffer larger than 10 MiB", () => {
    const huge = Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0);
    huge.write("%PDF", 0);
    expect(() => validateUploadContent("pdf", huge)).toThrow(StorageValidationError);
  });
});
