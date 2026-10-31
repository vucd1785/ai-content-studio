import { type ApiErrorCode, apiErrorBodySchema } from "@studio/contracts";

/** Phần tối thiểu của schema Zod mà client cần (tránh phụ thuộc trực tiếp vào `zod`). */
type ResponseSchema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
};

export type ClientErrorCode = ApiErrorCode | "network_error" | "unknown_error";

export class ApiError extends Error {
  readonly code: ClientErrorCode;
  readonly status: number;

  constructor(code: ClientErrorCode, status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Gọi API cùng origin (`/api`, proxy Vite tới 127.0.0.1:3001). Cookie session đi kèm tự động.
 * Lỗi được chuẩn hoá về `ApiError` với `code` theo 07-API-CONTRACTS mục Lỗi.
 */
export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; formData?: FormData; schema: ResponseSchema<T> },
): Promise<T> {
  let response: Response;
  const init: RequestInit = { method: options.method ?? "GET", credentials: "same-origin" };
  if (options.formData !== undefined) {
    // Trình duyệt tự đặt multipart boundary; không tự set content-type.
    init.body = options.formData;
  } else if (options.body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(options.body);
  }
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError("network_error", 0, "network error");
  }

  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const parsed = apiErrorBodySchema.safeParse(payload);
    if (parsed.success) {
      throw new ApiError(parsed.data.error.code, response.status, parsed.data.error.message);
    }
    throw new ApiError("unknown_error", response.status, "unexpected error body");
  }
  const parsed = options.schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError("unknown_error", response.status, "unexpected response body");
  }
  return parsed.data;
}
