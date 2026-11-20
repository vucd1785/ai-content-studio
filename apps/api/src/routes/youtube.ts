import { randomBytes, randomUUID } from "node:crypto";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import {
  buildAuthUrl,
  createPkce,
  decryptToken,
  encryptToken,
  exchangeCode,
  fetchMyChannel,
  GoogleApiError,
  type GoogleFetch,
  generateTokenKey,
  readEnvFile,
  readYoutubeEnv,
  revokeToken,
  updateEnvFile,
  type YoutubeEnv,
} from "@studio/config/youtube";
import {
  type ApiErrorBody,
  apiErrorBodySchema,
  MISSING_CONTACT_MARK,
  maskClientId,
  runIdParamsSchema,
  YOUTUBE_THUMBNAIL_STATES,
  type YoutubeConnection,
  type YoutubeUploadSummary,
  youtubeConfigUpdateSchema,
  youtubeConnectionSchema,
  youtubeOauthStartSchema,
  youtubeThumbnailQueuedSchema,
  youtubeUploadListSchema,
  youtubeUploadQueuedSchema,
  youtubeUploadRequestSchema,
  youtubeVideoUrl,
} from "@studio/contracts";
import {
  deleteYoutubeConnection,
  getDefaultBrandProfile,
  getYoutubeConnection,
  latestYoutubeJobOfRun,
  listRunYoutubeUploads,
  requestYoutubeThumbnailRetry,
  requestYoutubeUpload,
  type StudioDb,
  saveYoutubeConnection,
  setYoutubeConnectionError,
} from "@studio/db";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod/v4";
import { sendNotFound } from "../http/errors.js";

/**
 * Đăng YouTube (ADR-031): kết nối kênh bằng OAuth (PKCE, `state` một lần) và nút "Đăng" sau hộp xác nhận. Route chỉ
 * tạo job `upload` trong PostgreSQL; worker gọi YouTube. Không route nào trả hay ghi log token.
 */

export type YoutubeRouteDeps = {
  db: StudioDb;
  /** Null khi `.env` thiếu `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` hoặc `STUDIO_TOKEN_KEY`. */
  youtube: YoutubeEnv | null;
  fetch?: GoogleFetch;
  notifier?: { notify(runId: string): void };
  /** Đồng hồ (ms) cho test hết hạn `state`. */
  now?: () => number;
  /**
   * File `.env` mà form "Cấu hình OAuth" ghi vào (ADR-031 bổ sung 2026-11-16). Không có thì form báo không ghi được.
   * `youtube` được thay bằng cấu hình mới ngay sau khi ghi, không cần khởi động lại API.
   */
  envFile?: string;
};

/** Đường dẫn callback: mở (không cần cookie) vì Google chuyển về host của API; bảo vệ bằng `state` + PKCE. */
export const YOUTUBE_CALLBACK_PATH = "/api/youtube/oauth/callback";
const STATE_TTL_MS = 10 * 60 * 1000;
const MAX_PENDING_STATES = 20;

const conflict = (message: string): ApiErrorBody => ({
  error: { code: "conflict", message, details: {} },
});

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );

/** Trang ngắn hiện sau khi Google chuyển về: không script, không tài nguyên ngoài. */
function callbackPage(reply: FastifyReply, status: number, title: string, body: string) {
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5;color:#1f2937}h1{font-size:1.25rem}</style>
</head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p><p>Bạn có thể đóng tab này và quay lại AI Content Studio.</p></body></html>`;
  return reply
    .status(status)
    .header("content-type", "text/html; charset=utf-8")
    .header("cache-control", "no-store")
    .header("referrer-policy", "no-referrer")
    .header("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'")
    .send(html);
}

/** Thông điệp tiếng Việt cho lỗi Google lúc kết nối; không lặp lại code hay token. */
function connectErrorMessage(error: unknown): string {
  if (error instanceof GoogleApiError) {
    if (error.code === "no_channel") {
      return "Tài khoản Google này chưa có kênh YouTube. Hãy chọn đúng tài khoản hoặc kênh thương hiệu.";
    }
    if (error.code === "no_refresh_token") {
      return "Google không cấp quyền dùng lâu dài. Hãy thử kết nối lại.";
    }
    if (error.code === "invalid_grant") {
      return "Mã đăng nhập đã hết hạn hoặc đã dùng. Hãy bấm Kết nối YouTube lại.";
    }
    return `Google báo lỗi: ${error.message}`;
  }
  return "Không kết nối được với Google.";
}

export function registerYoutubeRoutes(app: FastifyInstance, deps: YoutubeRouteDeps): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const fetchImpl: GoogleFetch = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  /** `state` → verifier và kênh; chỉ trong bộ nhớ process API, sống 10 phút, dùng một lần. */
  const pending = new Map<
    string,
    { verifier: string; brandProfileId: string; expiresAt: number }
  >();

  const prune = () => {
    const t = now();
    for (const [key, value] of pending) {
      if (value.expiresAt <= t) {
        pending.delete(key);
      }
    }
  };

  /** Giá trị hiện tại: file `.env` (nếu có) đè `process.env`. */
  const rawEnv = (): Record<string, string | undefined> =>
    deps.envFile === undefined ? {} : { ...process.env, ...readEnvFile(deps.envFile) };

  const toConnection = async (): Promise<YoutubeConnection | null> => {
    const brand = await getDefaultBrandProfile(deps.db);
    if (brand === null) {
      return null;
    }
    const row = await getYoutubeConnection(deps.db, brand.id);
    const raw = rawEnv();
    const clientId = deps.youtube?.clientId ?? raw.YOUTUBE_CLIENT_ID?.trim() ?? "";
    const secret = deps.youtube?.clientSecret ?? raw.YOUTUBE_CLIENT_SECRET?.trim() ?? "";
    return {
      clientIdHint: clientId === "" ? null : maskClientId(clientId),
      hasClientSecret: secret !== "",
      configured: deps.youtube !== null,
      connected: row !== null,
      channelId: row?.channelId ?? null,
      channelTitle: row?.channelTitle ?? null,
      channelThumbnail: row?.channelThumbnail ?? null,
      lastError: row?.lastError ?? null,
      connectedAt: row?.connectedAt.toISOString() ?? null,
    };
  };

  typed.get(
    "/api/youtube/connection",
    { schema: { response: { 200: youtubeConnectionSchema } } },
    async (_request, reply) => {
      const connection = await toConnection();
      return connection === null ? sendNotFound(reply) : connection;
    },
  );

  typed.put(
    "/api/youtube/config",
    {
      schema: {
        body: youtubeConfigUpdateSchema,
        response: {
          200: youtubeConnectionSchema,
          400: apiErrorBodySchema,
          409: apiErrorBodySchema,
        },
      },
    },
    async (request, reply) => {
      if (deps.envFile === undefined) {
        return reply.status(409).send(conflict("API không có quyền ghi file .env."));
      }
      const raw = rawEnv();
      const secret = request.body.clientSecret || raw.YOUTUBE_CLIENT_SECRET?.trim() || "";
      if (secret === "") {
        return reply.status(400).send({
          error: { code: "validation_error", message: "Cần nhập Client secret.", details: {} },
        });
      }
      const previousClientId = deps.youtube?.clientId ?? raw.YOUTUBE_CLIENT_ID?.trim() ?? "";
      // Khóa mã hóa chỉ tạo một lần; không bao giờ ghi đè khóa đã có (token cũ sẽ không giải mã được).
      const existingKey = raw.STUDIO_TOKEN_KEY?.trim() ?? "";
      const values: Record<string, string> = {
        YOUTUBE_CLIENT_ID: request.body.clientId,
        YOUTUBE_CLIENT_SECRET: secret,
        ...(existingKey === "" ? { STUDIO_TOKEN_KEY: generateTokenKey() } : {}),
      };
      let next: YoutubeEnv | null;
      try {
        next = readYoutubeEnv({ ...raw, ...values });
      } catch (error) {
        return reply
          .status(409)
          .send(
            conflict(
              `Cấu hình trong .env không hợp lệ: ${error instanceof Error ? error.message : ""}`,
            ),
          );
      }
      updateEnvFile(deps.envFile, values);
      deps.youtube = next;
      // Phiên đăng nhập dở dang dùng client cũ: bỏ.
      pending.clear();
      const brand = await getDefaultBrandProfile(deps.db);
      if (brand !== null && previousClientId !== "" && previousClientId !== request.body.clientId) {
        const row = await getYoutubeConnection(deps.db, brand.id);
        if (row !== null) {
          await setYoutubeConnectionError(
            deps.db,
            brand.id,
            "Đã đổi OAuth client. Bấm Kết nối lại để cấp quyền cho client mới.",
          );
        }
      }
      request.log.info("youtube oauth config updated");
      const connection = await toConnection();
      return connection === null ? sendNotFound(reply) : connection;
    },
  );

  typed.post(
    "/api/youtube/oauth/start",
    { schema: { response: { 200: youtubeOauthStartSchema, 409: apiErrorBodySchema } } },
    async (_request, reply) => {
      if (deps.youtube === null) {
        return reply
          .status(409)
          .send(conflict("Chưa cấu hình YouTube trong .env. Xem trang Hướng dẫn kết nối YouTube."));
      }
      const brand = await getDefaultBrandProfile(deps.db);
      if (brand === null) {
        return sendNotFound(reply);
      }
      prune();
      if (pending.size >= MAX_PENDING_STATES) {
        return reply
          .status(409)
          .send(conflict("Có quá nhiều lần kết nối dở dang. Thử lại sau ít phút."));
      }
      const state = randomBytes(32).toString("base64url");
      const { verifier, challenge } = createPkce();
      pending.set(state, { verifier, brandProfileId: brand.id, expiresAt: now() + STATE_TTL_MS });
      return { authUrl: buildAuthUrl(deps.youtube, state, challenge) };
    },
  );

  typed.get(
    YOUTUBE_CALLBACK_PATH,
    {
      schema: {
        querystring: z.object({
          state: z.string().max(200).optional(),
          code: z.string().max(2000).optional(),
          error: z.string().max(200).optional(),
        }),
      },
    },
    async (request, reply) => {
      const { state, code, error } = request.query;
      prune();
      const entry = state === undefined ? undefined : pending.get(state);
      if (state !== undefined) {
        // Dùng một lần, kể cả khi lỗi.
        pending.delete(state);
      }
      if (entry === undefined || deps.youtube === null) {
        return callbackPage(
          reply,
          400,
          "Không kết nối được",
          "Phiên kết nối không hợp lệ hoặc đã quá 10 phút. Hãy bấm Kết nối YouTube lại trong Studio.",
        );
      }
      if (error !== undefined || code === undefined) {
        return callbackPage(
          reply,
          400,
          "Chưa kết nối",
          error === "access_denied"
            ? "Bạn đã không cấp quyền cho Studio."
            : "Google không trả mã đăng nhập.",
        );
      }
      try {
        const tokens = await exchangeCode(fetchImpl, deps.youtube, code, entry.verifier);
        const channel = await fetchMyChannel(fetchImpl, tokens.accessToken);
        await saveYoutubeConnection(deps.db, {
          brandProfileId: entry.brandProfileId,
          channelId: channel.id,
          channelTitle: channel.title,
          channelThumbnail: channel.thumbnail,
          refreshTokenEnc: encryptToken(
            deps.youtube.tokenKey,
            tokens.refreshToken,
            entry.brandProfileId,
          ),
          scopes: tokens.scope,
        });
        return callbackPage(reply, 200, "Đã kết nối YouTube", `Kênh: ${channel.title}.`);
      } catch (cause) {
        request.log.warn(
          { code: cause instanceof GoogleApiError ? cause.code : "unknown" },
          "youtube connect failed",
        );
        return callbackPage(reply, 502, "Không kết nối được", connectErrorMessage(cause));
      }
    },
  );

  typed.delete(
    "/api/youtube/connection",
    { schema: { response: { 200: youtubeConnectionSchema } } },
    async (_request, reply) => {
      const brand = await getDefaultBrandProfile(deps.db);
      if (brand === null) {
        return sendNotFound(reply);
      }
      const sealed = await deleteYoutubeConnection(deps.db, brand.id);
      if (sealed !== null && deps.youtube !== null) {
        try {
          await revokeToken(fetchImpl, decryptToken(deps.youtube.tokenKey, sealed, brand.id));
        } catch {
          // Khóa đã đổi hoặc token hỏng: kết nối ở Studio vẫn đã xóa.
        }
      }
      const connection = await toConnection();
      return connection === null ? sendNotFound(reply) : connection;
    },
  );

  typed.get(
    "/api/workflow-runs/:runId/youtube-uploads",
    { schema: { params: runIdParamsSchema, response: { 200: youtubeUploadListSchema } } },
    async (request) => {
      const rows = await listRunYoutubeUploads(deps.db, request.params.runId);
      const latest = await latestYoutubeJobOfRun(deps.db, request.params.runId);
      const uploads: YoutubeUploadSummary[] = rows.map((row) => {
        const meta = (row.resultMetadata ?? {}) as Record<string, unknown>;
        const req = (row.request ?? {}) as Record<string, unknown>;
        const str = (v: unknown) => (typeof v === "string" ? v : null);
        // Lần đăng trước khi có đo khung: dọc là Short (brief của kênh hầu hết dưới 3 phút).
        const isShort =
          typeof meta.isShort === "boolean" ? meta.isShort : row.aspectRatio !== "16:9";
        return {
          id: row.id,
          exportArtifactId: row.exportArtifactId,
          status: row.jobStatus,
          videoId: row.videoId,
          url: row.videoId === null ? null : youtubeVideoUrl(row.videoId, isShort),
          isShort,
          privacyStatus: str(meta.privacyStatus),
          publishAt: str(meta.publishAt),
          title: str(req.title),
          thumbnail: (YOUTUBE_THUMBNAIL_STATES as readonly string[]).includes(row.thumbnail)
            ? (row.thumbnail as YoutubeUploadSummary["thumbnail"])
            : "pending",
          thumbnailReason: row.thumbnailReason,
          errorCode: row.errorCode,
          errorMessage: row.errorMessage,
          createdAt: row.createdAt.toISOString(),
        };
      });
      return {
        busy: latest !== null && ["queued", "running"].includes(latest.status),
        lastError:
          latest !== null && latest.status === "failed"
            ? { code: latest.errorCode, message: latest.errorMessage }
            : null,
        uploads,
      };
    },
  );

  typed.post(
    "/api/workflow-runs/:runId/youtube-uploads",
    {
      schema: {
        params: runIdParamsSchema,
        body: youtubeUploadRequestSchema,
        response: {
          202: youtubeUploadQueuedSchema,
          409: apiErrorBodySchema,
        },
      },
    },
    async (request, reply) => {
      const { confirmRepeat, ...fields } = request.body;
      if (fields.description.includes(MISSING_CONTACT_MARK)) {
        return reply
          .status(409)
          .send(
            conflict(
              "Mô tả còn dòng nhắc liên hệ bản quyền. Điền ở Bộ nhận diện kênh rồi tạo lại bộ đăng bài.",
            ),
          );
      }
      if (deps.youtube === null) {
        return reply.status(409).send(conflict("Chưa cấu hình YouTube trong .env."));
      }
      const result = await requestYoutubeUpload(deps.db, {
        workflowRunId: request.params.runId,
        nonce: randomUUID(),
        request: fields,
        confirmRepeat: confirmRepeat === true,
      });
      switch (result.status) {
        case "queued":
          deps.notifier?.notify(request.params.runId);
          return reply.status(202).send({ status: "queued", uploadId: result.uploadId });
        case "not_found":
          return sendNotFound(reply);
        case "not_exported":
        case "no_export":
          return reply.status(409).send(conflict("Video chưa xuất xong."));
        case "not_connected":
          return reply
            .status(409)
            .send(conflict("Chưa kết nối kênh YouTube. Kết nối ở Bộ nhận diện kênh."));
        case "already_running":
          return reply.status(409).send(conflict("Đang đăng video này, chờ xong rồi thử lại."));
        case "already_uploaded":
          return reply
            .status(409)
            .send(
              conflict(
                "Bản xuất này đã đăng lên YouTube. Xác nhận lần hai để đăng thêm một video.",
              ),
            );
      }
    },
  );

  typed.post(
    "/api/youtube-uploads/:uploadId/thumbnail",
    {
      schema: {
        params: z.object({ uploadId: z.uuid() }),
        response: { 202: youtubeThumbnailQueuedSchema, 409: apiErrorBodySchema },
      },
    },
    async (request, reply) => {
      if (deps.youtube === null) {
        return reply.status(409).send(conflict("Chưa cấu hình YouTube trong .env."));
      }
      const result = await requestYoutubeThumbnailRetry(
        deps.db,
        request.params.uploadId,
        randomUUID(),
      );
      if (result === "not_found") {
        return sendNotFound(reply);
      }
      if (result === "no_video") {
        return reply.status(409).send(conflict("Video chưa đăng xong."));
      }
      if (result === "already_running") {
        return reply.status(409).send(conflict("Đang có việc đăng chạy, chờ xong rồi thử lại."));
      }
      return reply.status(202).send({ status: "queued" });
    },
  );
}
