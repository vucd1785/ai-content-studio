import {
  apiErrorBodySchema,
  sessionLoginBodySchema,
  sessionStatusResponseSchema,
} from "@studio/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import {
  buildSessionClearCookieHeader,
  buildSessionSetCookieHeader,
  createSessionCookieValue,
  parseStudioSessionCookie,
  verifySessionCookieValue,
} from "../session/cookie.js";
import { verifyPassword } from "../session/password.js";

export type SessionRouteDeps = {
  password: string;
  sessionSecret: string;
  nowSeconds: () => number;
};

export async function registerSessionRoutes(
  app: FastifyInstance,
  deps: SessionRouteDeps,
): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/api/session/login",
    {
      schema: {
        body: sessionLoginBodySchema,
        response: {
          200: sessionStatusResponseSchema,
          401: apiErrorBodySchema,
          400: apiErrorBodySchema,
        },
      },
    },
    async (request, reply) => {
      const { password } = request.body;
      if (!verifyPassword(password, deps.password)) {
        return reply.status(401).send({
          error: {
            code: "unauthorized",
            message: "Mật khẩu không đúng.",
            details: {},
          },
        });
      }

      const cookieValue = createSessionCookieValue(deps.sessionSecret, deps.nowSeconds());
      reply.header("Set-Cookie", buildSessionSetCookieHeader(cookieValue));
      return { authenticated: true };
    },
  );

  typed.post(
    "/api/session/logout",
    {
      schema: {
        response: {
          200: sessionStatusResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      reply.header("Set-Cookie", buildSessionClearCookieHeader());
      return { authenticated: false };
    },
  );

  typed.get(
    "/api/session",
    {
      schema: {
        response: {
          200: sessionStatusResponseSchema,
        },
      },
    },
    async (request) => {
      const parsed = parseStudioSessionCookie(request.headers.cookie);
      if (!parsed.ok) {
        return { authenticated: false };
      }
      const valid = verifySessionCookieValue(
        parsed.value,
        deps.sessionSecret,
        deps.nowSeconds(),
      );
      return { authenticated: valid };
    },
  );
}

export function registerSessionProbeRoute(app: FastifyInstance): void {
  app.get("/api/session-probe", async (_request, reply) => {
    return reply.status(200).send({ ok: true });
  });
}
