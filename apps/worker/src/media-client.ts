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

export class TtsMediaClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: TtsClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
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
