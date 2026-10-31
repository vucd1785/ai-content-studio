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

/** Mặc định 30 phút: TTS và alignment chạy CPU có thể mất nhiều phút cho một cảnh (P3-11). */
export const DEFAULT_TTS_TIMEOUT_MS = 30 * 60 * 1000;

/** `TTS_TIMEOUT_MS` (số mili giây dương) hoặc mặc định. */
export function ttsTimeoutMs(env: Record<string, string | undefined> = process.env): number {
  const raw = Number(env.TTS_TIMEOUT_MS);
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_TTS_TIMEOUT_MS;
}

/**
 * `fetch` tối giản trên `node:http(s)` cho service TTS nội bộ. `fetch` của Node (undici) bỏ cuộc khi server chưa
 * trả header sau 300 s, ngắn hơn thời gian TTS trên CPU yếu; ở đây chỉ hủy khi socket im lặng quá `timeoutMs`.
 */
export function createLongRunningFetch(timeoutMs: number): typeof fetch {
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
      req.setTimeout(timeoutMs, () =>
        req.destroy(new Error(`TTS không trả lời sau ${timeoutMs} ms`)),
      );
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
    const json: unknown = await response.json();
    if (!response.ok) {
      throw new Error(`TTS synthesize failed (${response.status})`);
    }
    return synthesizeResponseSchema.parse(json);
  }

  async revalidateGate(body: RevalidateGateRequest): Promise<AlignResponse> {
    const payload = revalidateGateRequestSchema.parse(body);
    const response = await this.fetchImpl(`${this.baseUrl}/align/revalidate-gate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json: unknown = await response.json();
    if (!response.ok) {
      throw new Error(`TTS revalidate-gate failed (${response.status})`);
    }
    return alignResponseSchema.parse(json);
  }

  async align(body: AlignRequest): Promise<AlignResponse> {
    const payload = alignRequestSchema.parse(body);
    const response = await this.fetchImpl(`${this.baseUrl}/align`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json: unknown = await response.json();
    if (!response.ok) {
      throw new Error(`TTS align failed (${response.status})`);
    }
    return alignResponseSchema.parse(json);
  }
}
