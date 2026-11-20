import { open } from "node:fs/promises";
import {
  GoogleApiError,
  type GoogleFetch,
  googleError,
  googleFetch,
  YOUTUBE_API,
  YOUTUBE_UPLOAD_API,
} from "@studio/config/youtube";
import type { YoutubeErrorCode } from "@studio/contracts";

/**
 * Client YouTube Data API v3 của worker (ADR-031 mục 4): upload resumable có resume, đọc trạng thái xử lý, đặt ảnh
 * bìa. Mọi lời gọi qua `googleFetch` (allowlist host, không theo redirect). Không log token.
 */

/** Khúc 8 MB, bội số của 256 KB theo yêu cầu của upload resumable. */
export const CHUNK_BYTES = 8 * 1024 * 1024;
const CHUNK_TIMEOUT_MS = 5 * 60 * 1000;
/** Số lần thử lại liên tiếp cho một khúc khi lỗi mạng hoặc 5xx. */
const MAX_CHUNK_RETRIES = 5;

export type VideoResource = {
  id: string;
  status?: { privacyStatus?: string; publishAt?: string; uploadStatus?: string };
  snippet?: { title?: string };
  processingDetails?: { processingStatus?: string };
};

export type UploadMetadata = {
  snippet: {
    title: string;
    description: string;
    tags: string[];
    categoryId: string;
    defaultLanguage: string;
    defaultAudioLanguage: string;
  };
  status: {
    privacyStatus: "private" | "unlisted" | "public";
    publishAt?: string;
    selfDeclaredMadeForKids: boolean;
    containsSyntheticMedia: boolean;
    embeddable: boolean;
  };
};

export type ClientDeps = {
  fetch: GoogleFetch;
  /** Chờ giữa các lần thử lại (test thay bằng hàm không chờ). */
  sleep?: (ms: number) => Promise<void>;
  /** Kích thước khúc (test dùng khúc nhỏ); mặc định `CHUNK_BYTES`. */
  chunkBytes?: number;
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Phân loại lỗi thành mã của job (ADR-031 mục 4). */
export function classifyYoutubeError(error: unknown): YoutubeErrorCode {
  if (!(error instanceof GoogleApiError)) {
    return "youtube_network";
  }
  if (
    ["quotaExceeded", "uploadLimitExceeded", "dailyLimitExceeded", "rateLimitExceeded"].includes(
      error.code,
    )
  ) {
    return "youtube_quota";
  }
  if (
    error.status === 401 ||
    error.code === "invalid_grant" ||
    error.code === "unauthorized_client"
  ) {
    return "youtube_auth";
  }
  if (error.status === 0 || error.status >= 500) {
    return "youtube_network";
  }
  return "youtube_rejected";
}

const transient = (error: unknown) =>
  !(error instanceof GoogleApiError) || error.status === 0 || error.status >= 500;

/** Mở phiên upload resumable; trả URI phiên (host phải nằm trong allowlist). */
export async function startResumableUpload(
  deps: ClientDeps,
  accessToken: string,
  metadata: UploadMetadata,
  size: number,
): Promise<string> {
  const url = `${YOUTUBE_UPLOAD_API}/videos?uploadType=resumable&part=snippet,status`;
  const res = await googleFetch(deps.fetch, url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json; charset=UTF-8",
      "x-upload-content-length": String(size),
      "x-upload-content-type": "video/mp4",
    },
    body: JSON.stringify(metadata),
  });
  if (!res.ok) {
    throw await googleError(res);
  }
  const location = res.headers.get("location");
  if (location === null) {
    throw new GoogleApiError("no_session", 502, "YouTube không trả URI phiên upload");
  }
  const session = new URL(location);
  if (session.protocol !== "https:" || session.hostname !== "www.googleapis.com") {
    throw new GoogleApiError("host_not_allowed", 0, "URI phiên upload ngoài host cho phép");
  }
  return session.toString();
}

type ChunkResult = { done: true; video: VideoResource } | { done: false; next: number };

/** Đọc phản hồi của một lần PUT vào phiên: 200/201 là xong, 308 là còn tiếp từ byte `next`. */
async function readSessionResponse(res: Response): Promise<ChunkResult> {
  if (res.status === 200 || res.status === 201) {
    const video = (await res.json()) as VideoResource;
    if (typeof video.id !== "string") {
      throw new GoogleApiError("no_video_id", 502, "YouTube không trả videoId");
    }
    return { done: true, video };
  }
  if (res.status === 308 && res.headers.get("location") === null) {
    const range = res.headers.get("range");
    const match = range === null ? null : /^bytes=0-(\d+)$/.exec(range);
    return { done: false, next: match === null ? 0 : Number(match[1]) + 1 };
  }
  if (res.status >= 300 && res.status < 400) {
    throw new GoogleApiError(
      "unexpected_redirect",
      res.status,
      "YouTube chuyển hướng ngoài dự kiến",
    );
  }
  throw await googleError(res);
}

/** Hỏi phiên đã nhận tới byte nào (hoặc đã xong). Dùng khi lỗi mạng giữa chừng và khi job chạy lại. */
export async function queryUploadStatus(
  deps: ClientDeps,
  sessionUri: string,
  size: number,
): Promise<ChunkResult> {
  const res = await googleFetch(deps.fetch, sessionUri, {
    method: "PUT",
    headers: { "content-range": `bytes */${size}` },
    redirect: "manual",
  });
  return readSessionResponse(res);
}

/**
 * Gửi file từ byte `from` tới hết, theo khúc. Lỗi mạng hoặc 5xx: chờ, hỏi lại phiên rồi gửi tiếp (không mở phiên
 * mới, nên không tạo video thứ hai). Lỗi khác ném ra để job ghi mã lỗi.
 */
export async function uploadFile(
  deps: ClientDeps,
  sessionUri: string,
  filePath: string,
  size: number,
  from: number,
  onProgress?: (sent: number) => void,
): Promise<VideoResource> {
  const sleep = deps.sleep ?? defaultSleep;
  const handle = await open(filePath, "r");
  try {
    let offset = from;
    let failures = 0;
    for (;;) {
      if (offset >= size) {
        // Đã gửi đủ mà chưa nhận 200: hỏi lại phiên.
        const status = await queryUploadStatus(deps, sessionUri, size);
        if (status.done) {
          return status.video;
        }
        offset = status.next;
        if (offset >= size) {
          throw new GoogleApiError("upload_incomplete", 502, "YouTube chưa xác nhận đủ dữ liệu");
        }
      }
      const length = Math.min(deps.chunkBytes ?? CHUNK_BYTES, size - offset);
      const chunk = Buffer.alloc(length);
      await handle.read(chunk, 0, length, offset);
      let result: ChunkResult;
      try {
        const res = await googleFetch(deps.fetch, sessionUri, {
          method: "PUT",
          headers: {
            "content-range": `bytes ${offset}-${offset + length - 1}/${size}`,
            "content-type": "video/mp4",
          },
          body: chunk,
          redirect: "manual",
          timeoutMs: CHUNK_TIMEOUT_MS,
        });
        result = await readSessionResponse(res);
        failures = 0;
      } catch (error) {
        if (!transient(error) || failures >= MAX_CHUNK_RETRIES) {
          throw error;
        }
        failures += 1;
        await sleep(Math.min(60_000, 1000 * 2 ** failures));
        try {
          result = await queryUploadStatus(deps, sessionUri, size);
        } catch (queryError) {
          if (!transient(queryError)) {
            throw queryError;
          }
          // Hỏi phiên cũng lỗi mạng: gửi lại khúc hiện tại ở vòng sau.
          continue;
        }
      }
      if (result.done) {
        onProgress?.(size);
        return result.video;
      }
      offset = result.next;
      onProgress?.(offset);
    }
  } finally {
    await handle.close();
  }
}

/** Đọc trạng thái video (xử lý, chế độ hiển thị). */
export async function getVideo(
  deps: ClientDeps,
  accessToken: string,
  videoId: string,
): Promise<VideoResource | null> {
  const url = `${YOUTUBE_API}/videos?part=status,processingDetails,snippet&id=${encodeURIComponent(videoId)}`;
  const res = await googleFetch(deps.fetch, url, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
  });
  if (!res.ok) {
    throw await googleError(res);
  }
  const body = (await res.json()) as { items?: VideoResource[] };
  return body.items?.[0] ?? null;
}

/** Chờ YouTube xử lý xong (Shorts chỉ nhận ảnh bìa sau `succeeded`). Trả trạng thái cuối cùng đọc được. */
export async function waitForProcessing(
  deps: ClientDeps,
  accessToken: string,
  videoId: string,
  options: { timeoutMs: number; intervalMs: number; now?: () => number },
): Promise<string> {
  const sleep = deps.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const deadline = now() + options.timeoutMs;
  for (;;) {
    const video = await getVideo(deps, accessToken, videoId);
    const status = video?.processingDetails?.processingStatus ?? "unknown";
    if (status === "succeeded" || status === "failed" || status === "terminated") {
      return status;
    }
    if (now() + options.intervalMs > deadline) {
      return status;
    }
    await sleep(options.intervalMs);
  }
}

/** Đặt ảnh bìa (JPEG). */
export async function setThumbnail(
  deps: ClientDeps,
  accessToken: string,
  videoId: string,
  jpeg: Buffer,
): Promise<void> {
  const url = `${YOUTUBE_UPLOAD_API}/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`;
  const res = await googleFetch(deps.fetch, url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "image/jpeg",
    },
    body: new Uint8Array(jpeg),
  });
  if (!res.ok) {
    throw await googleError(res);
  }
}
