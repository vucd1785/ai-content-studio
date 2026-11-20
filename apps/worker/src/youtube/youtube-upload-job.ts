import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import {
  decryptToken,
  GoogleApiError,
  type GoogleFetch,
  refreshAccessToken,
  type YoutubeEnv,
} from "@studio/config/youtube";
import {
  isYoutubeShort,
  YOUTUBE_CATEGORY_EDUCATION,
  type YoutubeUploadArtifact,
  youtubeUploadArtifactSchema,
  youtubeUploadJobPayloadSchema,
  youtubeVideoUrl,
} from "@studio/contracts";
import {
  claimJob,
  completeJob,
  failJob,
  getArtifactById,
  getYoutubeConnection,
  getYoutubeUpload,
  getYoutubeUploadByJob,
  JobStateError,
  loadJobContext,
  recordJobProgress,
  type StudioDb,
  setYoutubeConnectionError,
  updateYoutubeUpload,
  uploadIdFromThumbnailJobKey,
  type YoutubeUploadRow,
} from "@studio/db";
import { probeMp4 } from "../cli/ffprobe.js";
import { writeJsonArtifact } from "../jobs/job-support.js";
import {
  type ClientDeps,
  classifyYoutubeError,
  getVideo,
  queryUploadStatus,
  setThumbnail,
  startResumableUpload,
  type UploadMetadata,
  uploadFile,
  type VideoResource,
  waitForProcessing,
} from "./youtube-client.js";

/**
 * Job `upload` (ADR-031 mục 4, vai `publish`, queue `upload`): đăng bản xuất lên YouTube với các ô Director đã xác
 * nhận, rồi đặt ảnh bìa. Trạng thái bền nằm ở `youtube_uploads`:
 * - URI phiên resumable lưu trước khi gửi byte nào; chạy lại thì hỏi phiên cũ và gửi tiếp.
 * - Có `video_id` thì mọi lần chạy lại bỏ qua upload: không bao giờ tạo video thứ hai từ một lần bấm.
 * Lỗi không đổi trạng thái run (video đã xuất vẫn dùng được). Lỗi mạng ném ra để BullMQ thử lại.
 */

export type YoutubeJobDeps = {
  dataDir: string;
  /**
   * Cấu hình OAuth; hàm thì gọi mỗi lần job chạy (worker đọc lại `.env`, vì Director có thể vừa lưu Client ID và
   * secret từ giao diện, ADR-031 bổ sung 2026-11-16).
   */
  youtube: YoutubeEnv | null | (() => YoutubeEnv | null);
  fetch?: GoogleFetch;
  sleep?: ClientDeps["sleep"];
  chunkBytes?: number;
  /** Chờ YouTube xử lý trước khi đặt ảnh bìa (mặc định 10 phút, mỗi 20 giây). */
  processing?: { timeoutMs: number; intervalMs: number };
};

export type YoutubeJobResult =
  | { status: "skipped"; reason: string }
  | { status: "failed"; errorCode: string }
  | { status: "completed"; videoId: string };

const PROCESSING_DEFAULT = { timeoutMs: 10 * 60 * 1000, intervalMs: 20_000 };
const RECONNECT_MESSAGE =
  "Google từ chối quyền truy cập (hết hạn hoặc đã thu hồi). Cần kết nối lại YouTube ở Bộ nhận diện kênh.";

/**
 * YouTube tự xếp video vào Shorts (dọc/vuông, không quá 3 phút); Studio chỉ cần biết để đưa link `/shorts/`.
 * Đo file xuất bằng ffprobe; không đo được thì dựa vào khung của run.
 */
function detectShort(file: string, aspectRatio: string): boolean {
  try {
    const probe = probeMp4(file);
    return isYoutubeShort(probe.width, probe.height, probe.durationSeconds);
  } catch {
    return aspectRatio !== "16:9";
  }
}

function insideDataDir(dataDir: string, key: string): string {
  const root = resolve(dataDir);
  const target = resolve(root, key);
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error("artifact_key_outside_data_dir");
  }
  return target;
}

/** Thông điệp tiếng Việt cho mã lỗi; kèm thông điệp ngắn của Google (không chứa token). */
function messageFor(code: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  switch (code) {
    case "youtube_quota":
      return `Hết hạn mức đăng của YouTube hôm nay. Hạn mức đặt lại lúc 14–15 giờ (giờ Việt Nam). (${detail})`;
    case "youtube_auth":
      return RECONNECT_MESSAGE;
    case "youtube_rejected":
      return `YouTube từ chối: ${detail}`;
    default:
      return `Lỗi mạng khi gọi YouTube: ${detail}`;
  }
}

export async function runYoutubeUploadJob(
  db: StudioDb,
  jobId: string,
  deps: YoutubeJobDeps,
): Promise<YoutubeJobResult> {
  const context = await loadJobContext(db, jobId);
  if (context === null) {
    return { status: "skipped", reason: "job_not_found" };
  }
  if (context.job.queue !== "upload") {
    return { status: "skipped", reason: "not_upload_job" };
  }
  if (context.job.status === "completed" || context.job.status === "cancelled") {
    return { status: "skipped", reason: `job_${context.job.status}` };
  }
  try {
    await claimJob(db, { jobId, allowedRunStatuses: ["exported"] });
  } catch (error) {
    if (error instanceof JobStateError && error.code === "not_claimable") {
      return { status: "skipped", reason: error.message };
    }
    throw error;
  }
  const fail = async (errorCode: string, message: string): Promise<YoutubeJobResult> => {
    await failJob(db, { jobId, errorCode, errorMessage: message });
    return { status: "failed", errorCode };
  };

  const thumbUploadId = uploadIdFromThumbnailJobKey(context.job.idempotencyKey);
  const upload =
    thumbUploadId === null
      ? await getYoutubeUploadByJob(db, jobId)
      : await getYoutubeUpload(db, thumbUploadId);
  if (upload === null) {
    return fail("youtube_rejected", "Không tìm thấy yêu cầu đăng của job này.");
  }
  const payload = youtubeUploadJobPayloadSchema.safeParse({
    exportArtifactId: upload.exportArtifactId,
    brandProfileId: upload.brandProfileId,
    request: upload.request,
  });
  if (!payload.success) {
    return fail("youtube_rejected", "Yêu cầu đăng không hợp lệ.");
  }
  const request = payload.data.request;
  let youtube: YoutubeEnv | null;
  try {
    youtube = typeof deps.youtube === "function" ? deps.youtube() : deps.youtube;
  } catch (error) {
    return fail(
      "youtube_not_connected",
      `Cấu hình YouTube trong .env không hợp lệ: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (youtube === null) {
    return fail("youtube_not_connected", "Chưa cấu hình YouTube trong .env của worker.");
  }
  const connection = await getYoutubeConnection(db, upload.brandProfileId);
  if (connection === null) {
    return fail("youtube_not_connected", "Kênh chưa kết nối YouTube.");
  }
  const exported = await getArtifactById(db, upload.exportArtifactId);
  if (exported === null || exported.type !== "export") {
    return fail("youtube_rejected", "Không tìm thấy bản xuất.");
  }
  const client: ClientDeps = {
    fetch: deps.fetch ?? fetch,
    ...(deps.sleep === undefined ? {} : { sleep: deps.sleep }),
    ...(deps.chunkBytes === undefined ? {} : { chunkBytes: deps.chunkBytes }),
  };

  try {
    let accessToken: string;
    try {
      accessToken = await refreshAccessToken(
        client.fetch,
        youtube,
        decryptToken(youtube.tokenKey, connection.refreshTokenEnc, upload.brandProfileId),
      );
    } catch (error) {
      if (classifyYoutubeError(error) === "youtube_auth" || !(error instanceof GoogleApiError)) {
        await setYoutubeConnectionError(db, upload.brandProfileId, RECONNECT_MESSAGE);
        return fail("youtube_auth", RECONNECT_MESSAGE);
      }
      throw error;
    }
    await setYoutubeConnectionError(db, upload.brandProfileId, null);

    let videoId = upload.videoId;
    let uploaded: VideoResource | null = null;
    if (videoId === null) {
      const file = insideDataDir(deps.dataDir, exported.storageKey);
      const size = (await stat(file)).size;
      let session = upload.sessionUri;
      let from = 0;
      if (session !== null) {
        try {
          const status = await queryUploadStatus(client, session, size);
          if (status.done) {
            uploaded = status.video;
          } else {
            from = status.next;
          }
        } catch (error) {
          // Phiên hết hạn (404/410): mở phiên mới. Lỗi khác ném ra.
          if (!(error instanceof GoogleApiError) || ![404, 410].includes(error.status)) {
            throw error;
          }
          session = null;
        }
      }
      if (uploaded === null) {
        if (session === null) {
          const metadata: UploadMetadata = {
            snippet: {
              title: request.title,
              description: request.description,
              tags: request.tags,
              categoryId: YOUTUBE_CATEGORY_EDUCATION,
              defaultLanguage: "vi",
              defaultAudioLanguage: "vi",
            },
            status: {
              privacyStatus: request.privacy,
              ...(request.publishAt === undefined ? {} : { publishAt: request.publishAt }),
              selfDeclaredMadeForKids: request.madeForKids,
              containsSyntheticMedia: request.containsSyntheticMedia,
              embeddable: true,
            },
          };
          session = await startResumableUpload(client, accessToken, metadata, size);
          await updateYoutubeUpload(db, upload.id, { sessionUri: session });
        }
        let lastReported = 0;
        uploaded = await uploadFile(client, session, file, size, from, (sent) => {
          if (sent - lastReported >= 16 * 1024 * 1024 || sent === size) {
            lastReported = sent;
            void recordJobProgress(db, jobId, { stage: "youtube_upload", sent, total: size }).catch(
              () => {},
            );
          }
        });
      }
      videoId = uploaded.id;
      await updateYoutubeUpload(db, upload.id, { videoId, sessionUri: null });
    }

    const thumb = await placeThumbnail(
      db,
      deps,
      client,
      accessToken,
      upload,
      videoId,
      exported.metadata,
    );
    const video = (await getVideo(client, accessToken, videoId).catch(() => null)) ?? uploaded;
    const isShort = detectShort(
      insideDataDir(deps.dataDir, exported.storageKey),
      context.workflowRun.aspectRatio,
    );
    const artifact: YoutubeUploadArtifact = youtubeUploadArtifactSchema.parse({
      schemaVersion: 1,
      videoId,
      url: youtubeVideoUrl(videoId, isShort),
      isShort,
      channelId: connection.channelId,
      channelTitle: connection.channelTitle,
      exportArtifactId: upload.exportArtifactId,
      privacyStatus: video?.status?.privacyStatus ?? "unknown",
      publishAt: video?.status?.publishAt ?? null,
      title: video?.snippet?.title ?? request.title,
      thumbnail: thumb.state,
      thumbnailReason: thumb.reason,
      uploadedAt: new Date().toISOString(),
    });
    const runId = context.workflowRun.id;
    const key = `artifacts/${runId}/youtube-upload-${upload.id}-${jobId}.json`;
    const contentHash = await writeJsonArtifact(deps.dataDir, key, artifact);
    const [row] = await completeJob(db, {
      jobId,
      artifacts: [
        {
          type: "youtube_upload",
          schemaVersion: "1",
          contentHash,
          storageKey: key,
          metadata: {
            idempotencyKey: context.job.idempotencyKey,
            jobId,
            uploadId: upload.id,
            videoId,
            privacyStatus: artifact.privacyStatus,
            publishAt: artifact.publishAt,
            isShort,
          },
        },
      ],
      parentArtifacts: [[0, upload.exportArtifactId]],
      runTransition: { from: "exported", to: "exported" },
    });
    if (row !== undefined) {
      await updateYoutubeUpload(db, upload.id, { resultArtifactId: row.id });
    }
    return { status: "completed", videoId };
  } catch (error) {
    const code = classifyYoutubeError(error);
    if (code === "youtube_network") {
      // BullMQ thử lại; lần sau hỏi phiên cũ, không đăng trùng.
      throw error;
    }
    return fail(code, messageFor(code, error));
  }
}

/** Đặt ảnh bìa nếu còn `pending`. Lỗi ảnh bìa không làm hỏng lần đăng: ghi trạng thái và lý do. */
async function placeThumbnail(
  db: StudioDb,
  deps: YoutubeJobDeps,
  client: ClientDeps,
  accessToken: string,
  upload: YoutubeUploadRow,
  videoId: string,
  exportMetadata: unknown,
): Promise<{ state: "set" | "failed" | "skipped"; reason: string | null }> {
  if (upload.thumbnail === "set" || upload.thumbnail === "skipped") {
    return { state: upload.thumbnail, reason: upload.thumbnailReason };
  }
  const save = async (state: "set" | "failed" | "skipped", reason: string | null) => {
    await updateYoutubeUpload(db, upload.id, { thumbnail: state, thumbnailReason: reason });
    return { state, reason };
  };
  const key = (exportMetadata as { thumbnailKey?: unknown } | null)?.thumbnailKey;
  if (typeof key !== "string" || !key.endsWith(".jpg")) {
    return save("skipped", "Bản xuất này chưa có ảnh bìa.");
  }
  let jpeg: Buffer;
  try {
    jpeg = await readFile(insideDataDir(deps.dataDir, key));
  } catch {
    return save("skipped", "Không đọc được file ảnh bìa.");
  }
  const status = await waitForProcessing(client, accessToken, videoId, {
    ...(deps.processing ?? PROCESSING_DEFAULT),
  }).catch(() => "unknown");
  if (status !== "succeeded") {
    return save(
      "failed",
      status === "failed" || status === "terminated"
        ? "YouTube xử lý video lỗi nên chưa đặt được ảnh bìa."
        : "YouTube chưa xử lý xong video. Bấm Đặt lại ảnh bìa sau ít phút.",
    );
  }
  try {
    await setThumbnail(client, accessToken, videoId, jpeg);
    return save("set", null);
  } catch (error) {
    const reason =
      error instanceof GoogleApiError && error.status === 403
        ? "Kênh chưa được đặt ảnh bìa tùy chỉnh (cần xác minh kênh bằng số điện thoại trong YouTube Studio)."
        : `Không đặt được ảnh bìa: ${error instanceof Error ? error.message : String(error)}`;
    return save("failed", reason);
  }
}
