export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** ADR-030: ảnh PNG, JPEG, WebP Director tải lên thành hình dùng trong video (không phải tài liệu đọc). */
export const IMAGE_UPLOAD_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;

export const ALLOWED_UPLOAD_EXTENSIONS = ["md", "txt", "pdf", ...IMAGE_UPLOAD_EXTENSIONS] as const;

export type AllowedUploadExtension = (typeof ALLOWED_UPLOAD_EXTENSIONS)[number];

export const STORAGE_KEY_PATTERN = /^uploads\/[0-9a-f-]{36}\.(md|txt|pdf|png|jpg|jpeg|webp)$/;
