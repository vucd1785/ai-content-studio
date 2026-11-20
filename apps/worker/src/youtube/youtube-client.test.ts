import { randomBytes } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GoogleApiError } from "@studio/config/youtube";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFakeYoutube } from "./fake-youtube.js";
import {
  classifyYoutubeError,
  queryUploadStatus,
  setThumbnail,
  startResumableUpload,
  type UploadMetadata,
  uploadFile,
  waitForProcessing,
} from "./youtube-client.js";

const META: UploadMetadata = {
  snippet: {
    title: "t",
    description: "d",
    tags: [],
    categoryId: "27",
    defaultLanguage: "vi",
    defaultAudioLanguage: "vi",
  },
  status: {
    privacyStatus: "private",
    selfDeclaredMadeForKids: false,
    containsSyntheticMedia: false,
    embeddable: true,
  },
};
const SIZE = 1000;
const CHUNK = 256;
let dir: string;
let file: string;
let bytes: Buffer;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "yt-"));
  file = join(dir, "video.mp4");
  bytes = randomBytes(SIZE);
  await writeFile(file, bytes);
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const noSleep = async () => {};

describe("upload resumable (ADR-031 mục 4)", () => {
  it("gửi theo khúc, nhận videoId; dữ liệu nhận đủ và đúng thứ tự", async () => {
    const yt = createFakeYoutube();
    const deps = { fetch: yt.fetch, sleep: noSleep, chunkBytes: CHUNK };
    const session = await startResumableUpload(deps, "tok", META, SIZE);
    const video = await uploadFile(deps, session, file, SIZE, 0);
    expect(video.id).toBe("vid_ABC123");
    expect(Buffer.concat(yt.state.uploadedBytes).equals(bytes)).toBe(true);
    expect(yt.state.videosCreated).toBe(1);
    expect(yt.state.metadata).toEqual(META);
  });

  it("đứt mạng và 503 giữa chừng: hỏi lại phiên rồi gửi tiếp, vẫn một phiên, một video", async () => {
    const yt = createFakeYoutube();
    yt.faults.networkOnChunk = 2;
    yt.faults.serverErrorOnChunk = 3;
    const deps = { fetch: yt.fetch, sleep: noSleep, chunkBytes: CHUNK };
    const session = await startResumableUpload(deps, "tok", META, SIZE);
    const video = await uploadFile(deps, session, file, SIZE, 0);
    expect(video.id).toBe("vid_ABC123");
    expect(Buffer.concat(yt.state.uploadedBytes).equals(bytes)).toBe(true);
    expect(yt.state.sessionsOpened).toBe(1);
    expect(yt.state.videosCreated).toBe(1);
  });

  it("mất phản hồi sau khúc cuối: hỏi phiên nhận video đã tạo, không đăng trùng", async () => {
    const yt = createFakeYoutube();
    yt.faults.loseFinalResponse = true;
    const deps = { fetch: yt.fetch, sleep: noSleep, chunkBytes: CHUNK };
    const session = await startResumableUpload(deps, "tok", META, SIZE);
    const video = await uploadFile(deps, session, file, SIZE, 0);
    expect(video.id).toBe("vid_ABC123");
    expect(yt.state.videosCreated).toBe(1);
  });

  it("job chạy lại giữa chừng: hỏi phiên cũ ra byte kế tiếp rồi gửi nốt", async () => {
    const yt = createFakeYoutube();
    const deps = { fetch: yt.fetch, sleep: noSleep, chunkBytes: CHUNK };
    const session = await startResumableUpload(deps, "tok", META, SIZE);
    // Gửi một khúc rồi "worker tắt".
    yt.faults.networkOnChunk = 2;
    await expect(
      uploadFile(
        {
          ...deps,
          sleep: async () => {
            throw new Error("tắt");
          },
        },
        session,
        file,
        SIZE,
        0,
      ),
    ).rejects.toThrow("tắt");
    const status = await queryUploadStatus(deps, session, SIZE);
    expect(status).toEqual({ done: false, next: CHUNK });
    const video = await uploadFile(deps, session, file, SIZE, CHUNK);
    expect(video.id).toBe("vid_ABC123");
    expect(Buffer.concat(yt.state.uploadedBytes).equals(bytes)).toBe(true);
  });

  it("403 hạn mức ra youtube_quota; lỗi khác không thử lại", async () => {
    const yt = createFakeYoutube();
    yt.faults.startError = { status: 403, reason: "uploadLimitExceeded" };
    const error = await startResumableUpload({ fetch: yt.fetch }, "tok", META, SIZE).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(GoogleApiError);
    expect(classifyYoutubeError(error)).toBe("youtube_quota");
    expect(classifyYoutubeError(new GoogleApiError("invalid_grant", 400, "x"))).toBe(
      "youtube_auth",
    );
    expect(classifyYoutubeError(new GoogleApiError("invalidTitle", 400, "x"))).toBe(
      "youtube_rejected",
    );
    expect(classifyYoutubeError(new GoogleApiError("network", 0, "x"))).toBe("youtube_network");
  });

  it("chờ xử lý xong rồi đặt ảnh bìa; 403 ảnh bìa báo lỗi rõ", async () => {
    const yt = createFakeYoutube();
    yt.faults.processing = ["processing", "processing", "succeeded"];
    const deps = { fetch: yt.fetch, sleep: noSleep };
    const status = await waitForProcessing(deps, "tok", "vid_ABC123", {
      timeoutMs: 60_000,
      intervalMs: 1,
    });
    expect(status).toBe("succeeded");
    await setThumbnail(deps, "tok", "vid_ABC123", Buffer.from([0xff, 0xd8, 0xff]));
    expect(yt.state.thumbnails).toBe(1);
    yt.faults.thumbnailError = { status: 403, reason: "forbidden" };
    const error = await setThumbnail(deps, "tok", "vid_ABC123", Buffer.from([1])).catch((e) => e);
    expect(error).toBeInstanceOf(GoogleApiError);
    expect(error.status).toBe(403);
  });

  it("hết thời gian chờ xử lý thì trả trạng thái hiện tại", async () => {
    const yt = createFakeYoutube();
    yt.faults.processing = Array(10).fill("processing");
    let t = 0;
    const status = await waitForProcessing(
      {
        fetch: yt.fetch,
        sleep: async (ms) => {
          t += ms;
        },
      },
      "tok",
      "v",
      { timeoutMs: 50, intervalMs: 20, now: () => t },
    );
    expect(status).toBe("processing");
  });
});
