import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLongRunningFetch, DEFAULT_TTS_TIMEOUT_MS, ttsTimeoutMs } from "./media-client.js";

let server: Server;
let base = "";

beforeAll(async () => {
  // Trả lời sau `?delay=` ms, kèm body request để kiểm POST.
  server = createServer((req, res) => {
    const delay = Number(new URL(req.url ?? "/", "http://x").searchParams.get("delay") ?? 0);
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString("utf8");
    });
    req.on("end", () => {
      setTimeout(() => {
        res.writeHead(201, { "content-type": "application/json" });
        res.end(JSON.stringify({ method: req.method, body, type: req.headers["content-type"] }));
      }, delay);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("fetch cho TTS chạy lâu (P3-11)", () => {
  it("chờ server trả lời chậm, giữ status, body và header JSON", async () => {
    const fetchLong = createLongRunningFetch(2_000);
    const response = await fetchLong(`${base}/synthesize?delay=300`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Xin chào" }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      method: "POST",
      body: JSON.stringify({ text: "Xin chào" }),
      type: "application/json",
    });
  });

  it("server im lặng quá timeout thì báo lỗi, không treo", async () => {
    const fetchShort = createLongRunningFetch(100);
    await expect(
      fetchShort(`${base}/synthesize?delay=1000`, { method: "POST", body: "{}" }),
    ).rejects.toThrow(/TTS không trả lời sau 100 ms/);
  });

  it("TTS_TIMEOUT_MS hợp lệ thì dùng, sai thì về mặc định 30 phút", () => {
    expect(ttsTimeoutMs({ TTS_TIMEOUT_MS: "600000" })).toBe(600_000);
    expect(ttsTimeoutMs({ TTS_TIMEOUT_MS: "abc" })).toBe(DEFAULT_TTS_TIMEOUT_MS);
    expect(ttsTimeoutMs({})).toBe(30 * 60 * 1000);
  });
});
