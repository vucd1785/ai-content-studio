import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import {
  type AlignRequest,
  type AlignResponse,
  alignRequestSchema,
  alignResponseSchema,
  type RevalidateGateRequest,
  revalidateGateRequestSchema,
  type SynthesizeRequest,
  type SynthesizeResponse,
  synthesizeRequestSchema,
  synthesizeResponseSchema,
} from "@studio/contracts";

export type TtsClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
};

/**
 * Giới hạn chờ TTS (P3-17, Director 2026-11-01): mặc định **không giới hạn**, vì TTS và alignment trên CPU yếu
 * có thể mất hàng chục phút một cảnh. Đặt `TTS_TIMEOUT_MS` (số mili giây dương) nếu muốn có giới hạn.
 * Lỗi thật (TTS trả mã lỗi, mất kết nối) vẫn báo ngay kèm chi tiết.
 */
export function ttsTimeoutMs(env: Record<string, string | undefined> = process.env): number | null {
  const raw = Number(env.TTS_TIMEOUT_MS);
  return Number.isInteger(raw) && raw > 0 ? raw : null;
}

/** Thông điệp lỗi trong body của `services/tts` (`{error: {code, message}}` hoặc `{detail: …}`), cắt 500 ký tự. */
export function ttsErrorDetail(json: unknown): string | null {
  if (typeof json !== "object" || json === null) {
    return null;
  }
  const body = json as Record<string, unknown>;
  const candidate = body.error ?? body.detail;
  if (typeof candidate === "string") {
    return candidate.slice(0, 500);
  }
  if (typeof candidate === "object" && candidate !== null) {
    const { code, message } = candidate as Record<string, unknown>;
    const parts = [code, message].filter(
      (part): part is string => typeof part === "string" && part !== "",
    );
    return parts.length === 0
      ? JSON.stringify(candidate).slice(0, 500)
      : parts.join(": ").slice(0, 500);
  }
  return null;
}

async function failureMessage(action: string, response: Response): Promise<string> {
  let detail: string | null = null;
  try {
    detail = ttsErrorDetail(await response.json());
  } catch {
    detail = null;
  }
  return `TTS ${action} lỗi ${response.status}${detail === null ? "" : `: ${detail}`}`;
}

/**
 * `fetch` tối giản trên `node:http(s)` cho service TTS nội bộ. `fetch` của Node (undici) bỏ cuộc khi server chưa
 * trả header sau 300 s, ngắn hơn thời gian TTS trên CPU yếu. Ở đây chỉ hủy khi socket im lặng quá `timeoutMs`;
 * `null` là chờ đến khi TTS trả lời hoặc kết nối lỗi.
 */
export function createLongRunningFetch(timeoutMs: number | null): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const request = url.protocol === "https:" ? httpsRequest : httpRequest;
    const body = typeof init?.body === "string" ? init.body : undefined;
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    return new Promise<Response>((resolve, reject) => {
      const req = request(
        url,
        {
          method: init?.method ?? "GET",
          headers:
            body === undefined
              ? headers
              : { ...headers, "content-length": Buffer.byteLength(body).toString() },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("error", reject);
          res.on("end", () =>
            resolve(new Response(Buffer.concat(chunks), { status: res.statusCode ?? 500 })),
          );
        },
      );
      if (timeoutMs !== null) {
        req.setTimeout(timeoutMs, () =>
          req.destroy(new Error(`TTS không trả lời sau ${timeoutMs} ms (TTS_TIMEOUT_MS)`)),
        );
      }
      req.on("error", reject);
      if (body !== undefined) {
        req.write(body);
      }
      req.end();
    });
  }) as typeof fetch;
}

export class TtsMediaClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: TtsClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? createLongRunningFetch(ttsTimeoutMs());
  }

  async synthesize(body: SynthesizeRequest): Promise<SynthesizeResponse> {
    const payload = synthesizeRequestSchema.parse(body);
    const response = await this.fetchImpl(`${this.baseUrl}/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(await failureMessage("synthesize", response));
    }
    const json: unknown = await response.json();
    return synthesizeResponseSchema.parse(json);
  }

  async revalidateGate(body: RevalidateGateRequest): Promise<AlignResponse> {
    const payload = revalidateGateRequestSchema.parse(body);
    const response = await this.fetchImpl(`${this.baseUrl}/align/revalidate-gate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(await failureMessage("revalidate-gate", response));
    }
    const json: unknown = await response.json();
    return alignResponseSchema.parse(json);
  }

  async align(body: AlignRequest): Promise<AlignResponse> {
    const payload = alignRequestSchema.parse(body);
    const response = await this.fetchImpl(`${this.baseUrl}/align`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(await failureMessage("align", response));
    }
    const json: unknown = await response.json();
    return alignResponseSchema.parse(json);
  }
}
