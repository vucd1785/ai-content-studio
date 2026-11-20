import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "@fastify/type-provider-zod";
import type { ApiErrorBody } from "@studio/contracts";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { registerSecurityHooks } from "./hooks.js";
import { registerArtifactRoutes } from "./routes/artifacts.js";
import { createEventNotifier, registerEventStreamRoute } from "./routes/event-stream.js";
import { registerMotionAssetRoutes } from "./routes/motion-assets.js";
import { type ProjectRouteDeps, registerProjectRoutes } from "./routes/projects.js";
import { registerPublishRoutes } from "./routes/publish.js";
import { registerRedoRoutes } from "./routes/redo.js";
import { registerScriptEditRoutes } from "./routes/script-edits.js";
import { registerSessionProbeRoute, registerSessionRoutes } from "./routes/session.js";
import { registerVideoRoutes } from "./routes/videos.js";
import {
  type HeartbeatReader,
  redisHeartbeatReader,
  registerWorkerStatusRoute,
} from "./routes/worker-status.js";
import { registerWorkflowRunRoutes } from "./routes/workflow-runs.js";
import {
  registerYoutubeRoutes,
  YOUTUBE_CALLBACK_PATH,
  type YoutubeRouteDeps,
} from "./routes/youtube.js";

export type BuildAppOptions = {
  password: string;
  sessionSecret: string;
  nowSeconds?: number;
  enableProbe?: boolean;
  /** When false, silence logs (tests capture via custom logger). */
  enableLogger?: boolean;
  projects?: ProjectRouteDeps;
  /** Ghi đè chu kỳ poll và heartbeat của SSE (test). */
  eventStream?: { pollMs?: number; heartbeatMs?: number };
  /** Đọc heartbeat worker (P3-15). Mặc định Redis của `REDIS_URL`; test thay bằng bản giả. */
  readHeartbeats?: HeartbeatReader;
  /** ADR-031: cấu hình YouTube (null là chưa cấu hình) và fetch giả cho test. */
  youtube?: Pick<YoutubeRouteDeps, "youtube" | "fetch" | "now" | "envFile">;
};

export type StudioApp = FastifyInstance & {
  getNowSeconds: () => number;
  setNowSeconds: (value: number) => void;
};

export async function buildApp(options: BuildAppOptions): Promise<StudioApp> {
  let nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);

  const app = Fastify({
    logger:
      options.enableLogger === false
        ? false
        : {
            redact: {
              paths: [
                "req.headers.cookie",
                "req.body.password",
                "req.body.clientSecret",
                'res.headers["set-cookie"]',
              ],
              censor: "[REDACTED]",
            },
            serializers: {
              // ADR-031: URL callback OAuth mang `code` và `state` trong query; log không giữ query đó.
              req: (req: FastifyRequest) => ({
                method: req.method,
                url: redactOauthQuery(req.url ?? ""),
                host: req.host,
                remoteAddress: req.ip,
                remotePort: req.socket?.remotePort ?? 0,
              }),
            },
          },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((error: unknown, _request, reply) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "validation" in error &&
      (error as { validation?: unknown }).validation
    ) {
      return sendValidationError(reply);
    }
    const statusCode =
      typeof error === "object" && error !== null && "statusCode" in error
        ? (error as { statusCode?: unknown }).statusCode
        : undefined;
    if (statusCode === 413) {
      return reply.status(413).send({
        error: { code: "payload_too_large", message: "Dữ liệu vượt quá giới hạn.", details: {} },
      });
    }
    if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 500) {
      // Lỗi parse của Fastify (JSON hỏng, content-type lạ, multipart sai): không lộ message gốc.
      return sendValidationError(reply);
    }
    app.log.error(error);
    return reply.status(500).send({
      error: {
        code: "validation_error",
        message: "Lỗi máy chủ.",
        details: {},
      },
    });
  });

  registerSecurityHooks(app, {
    sessionSecret: options.sessionSecret,
    nowSeconds: () => nowSeconds,
  });

  await registerSessionRoutes(app, {
    password: options.password,
    sessionSecret: options.sessionSecret,
    nowSeconds: () => nowSeconds,
  });

  if (options.enableProbe) {
    registerSessionProbeRoute(app);
  }

  if (options.projects !== undefined) {
    await registerProjectRoutes(app, options.projects);
    const notifier = createEventNotifier();
    registerWorkflowRunRoutes(app, {
      db: options.projects.db,
      dataDir: options.projects.dataDir,
      notifier,
    });
    registerArtifactRoutes(app, { db: options.projects.db, dataDir: options.projects.dataDir });
    registerMotionAssetRoutes(app, { db: options.projects.db, dataDir: options.projects.dataDir });
    registerVideoRoutes(app, { db: options.projects.db, dataDir: options.projects.dataDir });
    registerPublishRoutes(app, { db: options.projects.db, notifier });
    registerScriptEditRoutes(app, {
      db: options.projects.db,
      dataDir: options.projects.dataDir,
      notifier,
    });
    registerRedoRoutes(app, {
      db: options.projects.db,
      dataDir: options.projects.dataDir,
      notifier,
    });
    registerYoutubeRoutes(app, {
      db: options.projects.db,
      notifier,
      youtube: options.youtube?.youtube ?? null,
      ...(options.youtube?.fetch === undefined ? {} : { fetch: options.youtube.fetch }),
      ...(options.youtube?.now === undefined ? {} : { now: options.youtube.now }),
      ...(options.youtube?.envFile === undefined ? {} : { envFile: options.youtube.envFile }),
    });
    registerEventStreamRoute(app, { db: options.projects.db, notifier, ...options.eventStream });
    registerWorkerStatusRoute(app, {
      readHeartbeats:
        options.readHeartbeats ??
        redisHeartbeatReader(process.env.REDIS_URL ?? "redis://localhost:6379"),
    });
  }

  const studioApp = app as StudioApp;
  studioApp.getNowSeconds = () => nowSeconds;
  studioApp.setNowSeconds = (value: number) => {
    nowSeconds = value;
  };

  return studioApp;
}

/** Bỏ query của URL callback OAuth trước khi ghi log. */
export function redactOauthQuery(url: string): string {
  const path = url.split("?")[0] ?? url;
  return path === YOUTUBE_CALLBACK_PATH && path !== url ? `${path}?[REDACTED]` : url;
}

function sendValidationError(
  reply: import("fastify").FastifyReply,
): import("fastify").FastifyReply {
  const body: ApiErrorBody = {
    error: {
      code: "validation_error",
      message: "Dữ liệu không hợp lệ.",
      details: {},
    },
  };
  return reply.status(400).send(body);
}
