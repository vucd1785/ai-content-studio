import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "@fastify/type-provider-zod";
import type { ApiErrorBody } from "@studio/contracts";
import Fastify, { type FastifyInstance } from "fastify";
import { registerSecurityHooks } from "./hooks.js";
import { registerArtifactRoutes } from "./routes/artifacts.js";
import { createEventNotifier, registerEventStreamRoute } from "./routes/event-stream.js";
import { type ProjectRouteDeps, registerProjectRoutes } from "./routes/projects.js";
import { registerSessionProbeRoute, registerSessionRoutes } from "./routes/session.js";
import {
  type HeartbeatReader,
  redisHeartbeatReader,
  registerWorkerStatusRoute,
} from "./routes/worker-status.js";
import { registerWorkflowRunRoutes } from "./routes/workflow-runs.js";

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
              paths: ["req.headers.cookie", "req.body.password", 'res.headers["set-cookie"]'],
              censor: "[REDACTED]",
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
