import type { ApiErrorBody } from "@studio/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { parseStudioSessionCookie, verifySessionCookieValue } from "./session/cookie.js";
import { isAllowedRequestOrigin } from "./session/origin.js";

export function sendUnauthorized(reply: FastifyReply): FastifyReply {
  const body: ApiErrorBody = {
    error: {
      code: "unauthorized",
      message: "Chưa đăng nhập.",
      details: {},
    },
  };
  return reply.status(401).send(body);
}

export function sendValidationError(reply: FastifyReply): FastifyReply {
  const body: ApiErrorBody = {
    error: {
      code: "validation_error",
      message: "Dữ liệu không hợp lệ.",
      details: {},
    },
  };
  return reply.status(400).send(body);
}

export function sendOriginRejected(reply: FastifyReply): FastifyReply {
  const body: ApiErrorBody = {
    error: {
      code: "unauthorized",
      message: "Origin không được phép.",
      details: {},
    },
  };
  return reply.status(401).send(body);
}

const OPEN_SESSION_PATHS = new Set([
  "/api/session/login",
  "/api/session/logout",
  "/api/session",
]);

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function registerSecurityHooks(
  app: FastifyInstance,
  deps: {
    sessionSecret: string;
    nowSeconds: () => number;
  },
): void {
  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    const method = request.method;
    const path = request.url.split("?")[0] ?? request.url;

    if (
      path.startsWith("/api/") &&
      STATE_CHANGING_METHODS.has(method) &&
      !isAllowedRequestOrigin(request.headers.origin)
    ) {
      sendOriginRejected(reply);
      return reply;
    }

    if (OPEN_SESSION_PATHS.has(path)) {
      return;
    }

    if (!path.startsWith("/api/")) {
      return;
    }

    if (!hasValidSession(request, deps.sessionSecret, deps.nowSeconds())) {
      sendUnauthorized(reply);
      return reply;
    }
  });
}

export function hasValidSession(
  request: FastifyRequest,
  sessionSecret: string,
  nowSeconds: number,
): boolean {
  const parsed = parseStudioSessionCookie(request.headers.cookie);
  if (!parsed.ok) {
    return false;
  }
  return verifySessionCookieValue(parsed.value, sessionSecret, nowSeconds);
}
