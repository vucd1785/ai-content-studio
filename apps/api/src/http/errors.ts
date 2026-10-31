import type { FastifyReply } from "fastify";
import type { ApiErrorBody } from "@studio/contracts";

export function sendNotFound(reply: FastifyReply): FastifyReply {
  const body: ApiErrorBody = {
    error: {
      code: "not_found",
      message: "Không tìm thấy.",
      details: {},
    },
  };
  return reply.status(404).send(body);
}

export function sendPayloadTooLarge(reply: FastifyReply): FastifyReply {
  const body: ApiErrorBody = {
    error: {
      code: "payload_too_large",
      message: "Tệp vượt quá giới hạn 10 MB.",
      details: {},
    },
  };
  return reply.status(413).send(body);
}

export function sendValidationError(reply: FastifyReply, message = "Dữ liệu không hợp lệ."): FastifyReply {
  const body: ApiErrorBody = {
    error: {
      code: "validation_error",
      message,
      details: {},
    },
  };
  return reply.status(400).send(body);
}

export function sendInvalidTransition(reply: FastifyReply): FastifyReply {
  const body: ApiErrorBody = {
    error: {
      code: "invalid_transition",
      message: "Cổng duyệt không khớp trạng thái workflow.",
      details: {},
    },
  };
  return reply.status(409).send(body);
}

export function isPostgresCheckViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23514"
  );
}
