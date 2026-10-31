import { realpath } from "node:fs/promises";
import { isAbsolute, posix, relative, resolve, win32 } from "node:path";

/**
 * Resolve `storage_key` trong volume `data/` (08-SECURITY mục Upload).
 * Key có ký tự null, path tuyệt đối hay đoạn `..` bị từ chối trước khi chạm đĩa.
 * Sau đó path thật (đã theo symlink) phải nằm trong `dataDir`; thiếu file cũng trả `null`.
 */
export function isUnsafeStorageKey(storageKey: string): boolean {
  if (storageKey === "" || storageKey.includes("\0")) {
    return true;
  }
  if (posix.isAbsolute(storageKey) || win32.isAbsolute(storageKey)) {
    return true;
  }
  return storageKey.split(/[\\/]/).some((segment) => segment === "..");
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

export async function resolveStorageKey(
  dataDir: string,
  storageKey: string,
): Promise<string | null> {
  if (isUnsafeStorageKey(storageKey)) {
    return null;
  }
  try {
    const target = await realpath(resolve(dataDir, storageKey));
    return isInside(await realpath(dataDir), target) ? target : null;
  } catch {
    return null;
  }
}
