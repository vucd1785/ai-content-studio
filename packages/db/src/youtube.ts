import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { insertQueuedJob } from "./agent-jobs.js";
import type { StudioDb } from "./db.js";
import { publishEvents } from "./events.js";
import {
  agentRuns,
  artifacts,
  jobs,
  projects,
  workflowRuns,
  youtubeConnections,
  youtubeUploads,
} from "./schema/index.js";
import type { StudioTx } from "./workflow.js";

/**
 * Kết nối kênh và các lần đăng YouTube (ADR-031). Hàm ở đây không giải mã token: API và worker tự mã hóa, giải
 * mã bằng `STUDIO_TOKEN_KEY`; DB chỉ thấy chuỗi đã mã hóa.
 */

export type YoutubeConnectionRow = typeof youtubeConnections.$inferSelect;
export type YoutubeUploadRow = typeof youtubeUploads.$inferSelect;

export async function getYoutubeConnection(
  db: StudioDb,
  brandProfileId: string,
): Promise<YoutubeConnectionRow | null> {
  const [row] = await db
    .select()
    .from(youtubeConnections)
    .where(eq(youtubeConnections.brandProfileId, brandProfileId))
    .limit(1);
  return row ?? null;
}

/** Lưu (hoặc thay) kết nối của kênh sau khi Director đăng nhập Google. */
export async function saveYoutubeConnection(
  db: StudioDb,
  input: {
    brandProfileId: string;
    channelId: string;
    channelTitle: string;
    channelThumbnail: string | null;
    refreshTokenEnc: string;
    scopes: string;
  },
): Promise<void> {
  const now = new Date();
  await db
    .insert(youtubeConnections)
    .values({ ...input, connectedAt: now, updatedAt: now, lastError: null })
    .onConflictDoUpdate({
      target: youtubeConnections.brandProfileId,
      set: {
        channelId: input.channelId,
        channelTitle: input.channelTitle,
        channelThumbnail: input.channelThumbnail,
        refreshTokenEnc: input.refreshTokenEnc,
        scopes: input.scopes,
        lastError: null,
        connectedAt: now,
        updatedAt: now,
      },
    });
}

/** Xóa kết nối; trả token đã mã hóa để nơi gọi thu hồi ở Google. */
export async function deleteYoutubeConnection(
  db: StudioDb,
  brandProfileId: string,
): Promise<string | null> {
  const [row] = await db
    .delete(youtubeConnections)
    .where(eq(youtubeConnections.brandProfileId, brandProfileId))
    .returning({ token: youtubeConnections.refreshTokenEnc });
  return row?.token ?? null;
}

/** Ghi (hoặc xóa) lỗi gần nhất, ví dụ Google từ chối refresh token: giao diện báo "Cần kết nối lại". */
export async function setYoutubeConnectionError(
  db: StudioDb,
  brandProfileId: string,
  message: string | null,
): Promise<void> {
  await db
    .update(youtubeConnections)
    .set({ lastError: message === null ? null : message.slice(0, 300), updatedAt: new Date() })
    .where(eq(youtubeConnections.brandProfileId, brandProfileId));
}

/** Khóa job đăng: một lần bấm "Đăng" của một bản xuất. */
export function youtubeUploadJobKey(exportArtifactId: string, nonce: string): string {
  return `youtube:${exportArtifactId}:${nonce}`;
}

/** Khóa job "Đặt lại ảnh bìa" cho một lần đăng đã có video. */
export function youtubeThumbnailJobKey(uploadId: string, nonce: string): string {
  return `youtube-thumb:${uploadId}:${nonce}`;
}

/** Id hàng `youtube_uploads` trong khóa job đặt lại ảnh bìa. */
export function uploadIdFromThumbnailJobKey(key: string): string | null {
  const match = /^youtube-thumb:([0-9a-f-]{36}):/.exec(key);
  return match?.[1] ?? null;
}

export type RequestYoutubeUploadResult =
  | { status: "queued"; uploadId: string; jobId: string }
  | {
      status:
        | "not_found"
        | "not_exported"
        | "no_export"
        | "not_connected"
        | "already_running"
        | "already_uploaded";
    };

/** Có job `upload` đang chờ hoặc đang chạy của run này. */
async function uploadBusy(tx: StudioTx, runId: string) {
  const [busy] = await tx
    .select({ id: jobs.id })
    .from(jobs)
    .innerJoin(agentRuns, eq(agentRuns.id, jobs.agentRunId))
    .where(
      and(
        eq(agentRuns.workflowRunId, runId),
        eq(jobs.queue, "upload"),
        inArray(jobs.status, ["queued", "running"]),
      ),
    )
    .limit(1);
  return busy !== undefined;
}

/**
 * Director bấm "Đăng" trong hộp xác nhận (ADR-031 mục 3): tạo job `upload` và hàng `youtube_uploads` trong một
 * transaction. Không đổi trạng thái run, không ghi approval. Bản xuất đã có video thì cần `confirmRepeat`.
 */
export async function requestYoutubeUpload(
  db: StudioDb,
  input: {
    workflowRunId: string;
    nonce: string;
    request: Record<string, unknown>;
    confirmRepeat: boolean;
  },
): Promise<RequestYoutubeUploadResult> {
  return db.transaction(async (tx) => {
    const [run] = await tx
      .select({
        id: workflowRuns.id,
        status: workflowRuns.status,
        brandProfileId: projects.brandProfileId,
      })
      .from(workflowRuns)
      .innerJoin(projects, eq(projects.id, workflowRuns.projectId))
      .where(eq(workflowRuns.id, input.workflowRunId))
      .for("update", { of: workflowRuns })
      .limit(1);
    if (run === undefined) {
      return { status: "not_found" };
    }
    if (run.status !== "exported") {
      return { status: "not_exported" };
    }
    const [exported] = await tx
      .select({ id: artifacts.id })
      .from(artifacts)
      .where(and(eq(artifacts.workflowRunId, run.id), eq(artifacts.type, "export")))
      .orderBy(desc(artifacts.version))
      .limit(1);
    if (exported === undefined) {
      return { status: "no_export" };
    }
    const [connection] = await tx
      .select({ id: youtubeConnections.id })
      .from(youtubeConnections)
      .where(eq(youtubeConnections.brandProfileId, run.brandProfileId))
      .limit(1);
    if (connection === undefined) {
      return { status: "not_connected" };
    }
    if (await uploadBusy(tx, run.id)) {
      return { status: "already_running" };
    }
    const [done] = await tx
      .select({ id: youtubeUploads.id })
      .from(youtubeUploads)
      .where(
        and(eq(youtubeUploads.exportArtifactId, exported.id), isNotNull(youtubeUploads.videoId)),
      )
      .limit(1);
    if (done !== undefined && !input.confirmRepeat) {
      return { status: "already_uploaded" };
    }
    const queued = await insertQueuedJob(tx, run.id, {
      role: "publish",
      queue: "upload",
      idempotencyKey: youtubeUploadJobKey(exported.id, input.nonce),
    });
    const [upload] = await tx
      .insert(youtubeUploads)
      .values({
        jobId: queued.job.id,
        workflowRunId: run.id,
        exportArtifactId: exported.id,
        brandProfileId: run.brandProfileId,
        request: input.request,
        thumbnail: input.request.includeThumbnail === false ? "skipped" : "pending",
      })
      .returning({ id: youtubeUploads.id });
    if (upload === undefined) {
      throw new Error("insert_youtube_upload_failed");
    }
    await publishEvents(tx, [queued.event]);
    return { status: "queued", uploadId: upload.id, jobId: queued.job.id };
  });
}

/**
 * Director bấm "Đặt lại ảnh bìa" cho một lần đăng đã có video: tạo job `upload` mới (khóa `youtube-thumb:`).
 */
export async function requestYoutubeThumbnailRetry(
  db: StudioDb,
  uploadId: string,
  nonce: string,
): Promise<"queued" | "not_found" | "no_video" | "already_running"> {
  return db.transaction(async (tx) => {
    const [upload] = await tx
      .select()
      .from(youtubeUploads)
      .where(eq(youtubeUploads.id, uploadId))
      .for("update")
      .limit(1);
    if (upload === undefined) {
      return "not_found";
    }
    if (upload.videoId === null) {
      return "no_video";
    }
    if (await uploadBusy(tx, upload.workflowRunId)) {
      return "already_running";
    }
    const queued = await insertQueuedJob(tx, upload.workflowRunId, {
      role: "publish",
      queue: "upload",
      idempotencyKey: youtubeThumbnailJobKey(upload.id, nonce),
    });
    await tx
      .update(youtubeUploads)
      .set({ thumbnail: "pending", thumbnailReason: null, updatedAt: new Date() })
      .where(eq(youtubeUploads.id, upload.id));
    await publishEvents(tx, [queued.event]);
    return "queued";
  });
}

export async function getYoutubeUploadByJob(
  db: StudioDb,
  jobId: string,
): Promise<YoutubeUploadRow | null> {
  const [row] = await db
    .select()
    .from(youtubeUploads)
    .where(eq(youtubeUploads.jobId, jobId))
    .limit(1);
  return row ?? null;
}

export async function getYoutubeUpload(
  db: StudioDb,
  uploadId: string,
): Promise<YoutubeUploadRow | null> {
  const [row] = await db
    .select()
    .from(youtubeUploads)
    .where(eq(youtubeUploads.id, uploadId))
    .limit(1);
  return row ?? null;
}

/** Cập nhật trạng thái bền của một lần đăng (URI phiên, videoId, ảnh bìa, artifact kết quả). */
export async function updateYoutubeUpload(
  db: StudioDb,
  uploadId: string,
  patch: Partial<
    Pick<
      YoutubeUploadRow,
      "sessionUri" | "videoId" | "thumbnail" | "thumbnailReason" | "resultArtifactId"
    >
  >,
): Promise<void> {
  await db
    .update(youtubeUploads)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(youtubeUploads.id, uploadId));
}

/** Các lần đăng của run, mới nhất trước, kèm trạng thái job để giao diện hiện "Đang đăng" hoặc lỗi. */
export async function listRunYoutubeUploads(db: StudioDb, workflowRunId: string) {
  return db
    .select({
      id: youtubeUploads.id,
      exportArtifactId: youtubeUploads.exportArtifactId,
      videoId: youtubeUploads.videoId,
      thumbnail: youtubeUploads.thumbnail,
      thumbnailReason: youtubeUploads.thumbnailReason,
      resultArtifactId: youtubeUploads.resultArtifactId,
      request: youtubeUploads.request,
      resultMetadata: artifacts.metadata,
      createdAt: youtubeUploads.createdAt,
      jobStatus: jobs.status,
      errorCode: agentRuns.errorCode,
      errorMessage: agentRuns.errorMessage,
      aspectRatio: workflowRuns.aspectRatio,
    })
    .from(youtubeUploads)
    .innerJoin(jobs, eq(jobs.id, youtubeUploads.jobId))
    .innerJoin(agentRuns, eq(agentRuns.id, jobs.agentRunId))
    .innerJoin(workflowRuns, eq(workflowRuns.id, youtubeUploads.workflowRunId))
    .leftJoin(artifacts, eq(artifacts.id, youtubeUploads.resultArtifactId))
    .where(eq(youtubeUploads.workflowRunId, workflowRunId))
    .orderBy(desc(youtubeUploads.createdAt));
}

/** Job đặt lại ảnh bìa đang chạy hay lỗi gần nhất của các lần đăng trong run (để hiện lý do). */
export async function latestYoutubeJobOfRun(db: StudioDb, workflowRunId: string) {
  const [row] = await db
    .select({
      jobId: jobs.id,
      key: jobs.idempotencyKey,
      status: jobs.status,
      errorCode: agentRuns.errorCode,
      errorMessage: agentRuns.errorMessage,
    })
    .from(jobs)
    .innerJoin(agentRuns, eq(agentRuns.id, jobs.agentRunId))
    .where(and(eq(agentRuns.workflowRunId, workflowRunId), eq(jobs.queue, "upload")))
    .orderBy(desc(jobs.createdAt))
    .limit(1);
  return row ?? null;
}

/** Chỉ dùng trong test: đổi trạng thái job như worker đã chạy xong. */
export async function markJobStatusForTests(
  db: StudioDb,
  jobId: string,
  status: (typeof jobs.$inferSelect)["status"],
): Promise<void> {
  await db.update(jobs).set({ status }).where(eq(jobs.id, jobId));
}
