import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import {
  ALLOWED_UPLOAD_EXTENSIONS,
  type AllowedUploadExtension,
  MAX_UPLOAD_BYTES,
  STORAGE_KEY_PATTERN,
} from "./constants.js";

export class StorageValidationError extends Error {
  readonly code:
    | "storage_key_invalid"
    | "storage_path_escape"
    | "upload_type_invalid"
    | "upload_content_invalid"
    | "upload_too_large";

  constructor(code: StorageValidationError["code"], message: string) {
    super(message);
    this.name = "StorageValidationError";
    this.code = code;
  }
}

export function assertSafeStorageKey(storageKey: string): void {
  if (
    storageKey.includes("\0") ||
    storageKey.includes("..") ||
    storageKey.startsWith("/") ||
    storageKey.includes("\\")
  ) {
    throw new StorageValidationError("storage_key_invalid", "Storage key is not allowed");
  }
  if (!STORAGE_KEY_PATTERN.test(storageKey)) {
    throw new StorageValidationError("storage_key_invalid", "Storage key format is not allowed");
  }
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

/** realpath của `DATA_DIR/uploads`; từ chối khi chính thư mục uploads là symlink/junction ra ngoài DATA_DIR. */
async function resolveUploadsRoot(dataDir: string): Promise<string> {
  const rootReal = await realpath(dataDir);
  const uploadsDir = join(rootReal, "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const uploadsReal = await realpath(uploadsDir);
  if (!isInside(rootReal, uploadsReal)) {
    throw new StorageValidationError("storage_path_escape", "Path escapes upload directory");
  }
  return uploadsReal;
}

export async function resolveStoragePath(dataDir: string, storageKey: string): Promise<string> {
  assertSafeStorageKey(storageKey);
  const uploadsReal = await resolveUploadsRoot(dataDir);

  const fileName = storageKey.slice("uploads/".length);
  if (fileName.includes("/") || fileName.includes("\\")) {
    throw new StorageValidationError("storage_key_invalid", "Storage key is not allowed");
  }

  const candidate = resolve(uploadsReal, fileName);
  if (!isInside(uploadsReal, candidate)) {
    throw new StorageValidationError("storage_path_escape", "Path escapes upload directory");
  }

  return candidate;
}

export function extensionFromFilename(filename: string): AllowedUploadExtension | null {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) {
    return null;
  }
  const ext = base.slice(dot + 1).toLowerCase();
  if ((ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(ext)) {
    return ext as AllowedUploadExtension;
  }
  return null;
}

export function validateUploadContent(ext: AllowedUploadExtension, buffer: Buffer): void {
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new StorageValidationError("upload_too_large", "File exceeds maximum size");
  }
  if (ext === "pdf") {
    if (buffer.length < 4 || buffer.subarray(0, 4).toString("ascii") !== "%PDF") {
      throw new StorageValidationError("upload_content_invalid", "PDF signature invalid");
    }
    return;
  }
  if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp") {
    // ADR-030: sniff chữ ký thật của ảnh; đuôi đổi tên không qua được.
    if (imageKind(buffer) !== (ext === "jpeg" ? "jpg" : ext)) {
      throw new StorageValidationError("upload_content_invalid", "Image signature invalid");
    }
    return;
  }
  if (buffer.includes(0)) {
    throw new StorageValidationError("upload_content_invalid", "Text file contains NUL byte");
  }
  if (buffer.subarray(0, 4).toString("ascii") === "%PDF") {
    throw new StorageValidationError(
      "upload_content_invalid",
      "Text extension does not match PDF content",
    );
  }
}

/** Loại ảnh theo chữ ký đầu file; không phải ảnh nhận thì null. */
export function imageKind(buffer: Buffer): "png" | "jpg" | "webp" | null {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export function generateStorageKey(ext: AllowedUploadExtension): string {
  return `uploads/${randomUUID()}.${ext}`;
}

export async function writeUploadFile(
  dataDir: string,
  buffer: Buffer,
  ext: AllowedUploadExtension,
): Promise<{ storageKey: string; byteSize: number; mediaType: string; contentHash: string }> {
  validateUploadContent(ext, buffer);
  const storageKey = generateStorageKey(ext);
  const targetPath = await resolveStoragePath(dataDir, storageKey);
  await mkdir(dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.tmp-${randomUUID()}`;
  try {
    await writeFile(tempPath, buffer, { flag: "wx" });
    await rename(tempPath, targetPath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }

  const uploadsRoot = await resolveUploadsRoot(dataDir);
  const writtenReal = await realpath(targetPath);
  if (!isInside(uploadsRoot, writtenReal)) {
    await rm(targetPath, { force: true });
    throw new StorageValidationError("storage_path_escape", "Path escapes upload directory");
  }

  const contentHash = createHash("sha256").update(buffer).digest("hex");
  const mediaType =
    ext === "pdf"
      ? "application/pdf"
      : ext === "md"
        ? "text/markdown"
        : ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : ext === "jpg" || ext === "jpeg"
              ? "image/jpeg"
              : "text/plain";
  return { storageKey, byteSize: buffer.length, mediaType, contentHash };
}

export async function removeUploadFile(dataDir: string, storageKey: string): Promise<void> {
  try {
    const path = await resolveStoragePath(dataDir, storageKey);
    await rm(path, { force: true });
  } catch {
    // best-effort cleanup
  }
}

export async function readUploadFile(dataDir: string, storageKey: string): Promise<Buffer> {
  const path = await resolveStoragePath(dataDir, storageKey);
  const uploadsRoot = await resolveUploadsRoot(dataDir);
  const fileReal = await realpath(path);
  if (!isInside(uploadsRoot, fileReal)) {
    throw new StorageValidationError("storage_path_escape", "Path escapes upload directory");
  }
  return readFile(fileReal);
}

export async function consumeStreamWithLimit(
  stream: AsyncIterable<Buffer>,
  maxBytes: number,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new StorageValidationError("upload_too_large", "File exceeds maximum size");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function fileExistsAtKey(dataDir: string, storageKey: string): Promise<boolean> {
  try {
    const path = await resolveStoragePath(dataDir, storageKey);
    const handle = await open(path, "r");
    await handle.close();
    return true;
  } catch {
    return false;
  }
}
