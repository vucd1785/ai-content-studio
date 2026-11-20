import type { GoogleFetch } from "@studio/config/youtube";

/**
 * YouTube giả trong bộ nhớ cho test (ADR-031): token, upload resumable, videos.list, thumbnails.set. Có thể cài lỗi
 * mạng, 5xx, mất phản hồi sau khúc cuối, 403 hạn mức, 403 ảnh bìa.
 */
export type FakeYoutube = {
  fetch: GoogleFetch;
  state: {
    received: number;
    size: number;
    videosCreated: number;
    sessionsOpened: number;
    metadata: unknown;
    thumbnails: number;
    uploadedBytes: Buffer[];
    calls: string[];
  };
  faults: {
    /** Lần PUT khúc thứ n (1-based) ném lỗi mạng trước khi server nhận. */
    networkOnChunk?: number;
    /** Lần PUT khúc thứ n trả 503. */
    serverErrorOnChunk?: number;
    /** Server nhận khúc cuối, tạo video, nhưng phản hồi mất (lỗi mạng phía client). */
    loseFinalResponse?: boolean;
    /** Mở phiên trả 403 với lý do này. */
    startError?: { status: number; reason: string };
    thumbnailError?: { status: number; reason: string };
    tokenError?: string;
    processing?: string[];
  };
};

export function createFakeYoutube(): FakeYoutube {
  const state: FakeYoutube["state"] = {
    received: 0,
    size: 0,
    videosCreated: 0,
    sessionsOpened: 0,
    metadata: null,
    thumbnails: 0,
    uploadedBytes: [],
    calls: [],
  };
  const faults: FakeYoutube["faults"] = {};
  let chunkCalls = 0;
  let completed = false;
  const video = () => ({
    id: "vid_ABC123",
    status: { privacyStatus: "private", uploadStatus: "uploaded" },
    snippet: { title: "t" },
  });
  const range = () => (state.received === 0 ? {} : { range: `bytes=0-${state.received - 1}` });

  const fetchImpl: GoogleFetch = async (url, init) => {
    const u = new URL(url);
    const headers = new Headers(init.headers);
    state.calls.push(`${init.method ?? "GET"} ${u.pathname}`);
    if (u.hostname === "oauth2.googleapis.com" && u.pathname === "/token") {
      if (faults.tokenError !== undefined) {
        return Response.json({ error: faults.tokenError }, { status: 400 });
      }
      return Response.json({ access_token: "ya29.fake", expires_in: 3600 });
    }
    if (u.pathname === "/upload/youtube/v3/videos" && init.method === "POST") {
      if (faults.startError !== undefined) {
        return Response.json(
          { error: { message: "nope", errors: [{ reason: faults.startError.reason }] } },
          { status: faults.startError.status },
        );
      }
      state.sessionsOpened += 1;
      state.size = Number(headers.get("x-upload-content-length"));
      state.metadata = JSON.parse(String(init.body));
      return new Response(null, {
        status: 200,
        headers: {
          location: `https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=S${state.sessionsOpened}`,
        },
      });
    }
    if (u.pathname === "/upload/youtube/v3/videos" && init.method === "PUT") {
      const cr = headers.get("content-range") ?? "";
      if (cr.startsWith("bytes */")) {
        return completed
          ? Response.json(video(), { status: 200 })
          : new Response(null, { status: 308, headers: range() });
      }
      chunkCalls += 1;
      if (faults.networkOnChunk === chunkCalls) {
        throw new TypeError("fetch failed");
      }
      if (faults.serverErrorOnChunk === chunkCalls) {
        return new Response("busy", { status: 503 });
      }
      const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(cr);
      if (m === null || Number(m[1]) !== state.received) {
        return Response.json({ error: { message: "bad range" } }, { status: 400 });
      }
      state.uploadedBytes.push(Buffer.from(init.body as Uint8Array));
      state.received = Number(m[2]) + 1;
      if (state.received >= state.size) {
        if (!completed) {
          completed = true;
          state.videosCreated += 1;
        }
        if (faults.loseFinalResponse === true) {
          faults.loseFinalResponse = false;
          throw new TypeError("socket hang up");
        }
        return Response.json(video(), { status: 201 });
      }
      return new Response(null, { status: 308, headers: range() });
    }
    if (u.pathname === "/youtube/v3/videos") {
      const next = faults.processing?.shift() ?? "succeeded";
      return Response.json({
        items: [{ ...video(), processingDetails: { processingStatus: next } }],
      });
    }
    if (u.pathname === "/upload/youtube/v3/thumbnails/set") {
      if (faults.thumbnailError !== undefined) {
        return Response.json(
          {
            error: { message: "no permission", errors: [{ reason: faults.thumbnailError.reason }] },
          },
          { status: faults.thumbnailError.status },
        );
      }
      state.thumbnails += 1;
      return Response.json({ items: [] });
    }
    return new Response("not found", { status: 404 });
  };
  return { fetch: fetchImpl, state, faults };
}
