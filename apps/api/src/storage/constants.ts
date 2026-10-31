export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_UPLOAD_EXTENSIONS = ["md", "txt", "pdf"] as const;

export type AllowedUploadExtension = (typeof ALLOWED_UPLOAD_EXTENSIONS)[number];

export const STORAGE_KEY_PATTERN = /^uploads\/[0-9a-f-]{36}\.(md|txt|pdf)$/;
