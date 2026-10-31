import { eventStreamQuerySchema, eventIdSchema, runIdParamsSchema } from "@studio/contracts";
import { listEventsAfter, workflowRunExists, type EventRow, type StudioDb } from "@studio/db";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import type { ServerResponse } from "node:http";
import { sendNotFound, sendValidationError } from "../http/errors.js";

/**
 * Đánh thức stream cùng process ngay khi route khác vừa commit event (approval).
 * Event do worker ghi được phát qua vòng poll; notifier chỉ làm nhanh hơn, không thay poll.
 */
export type EventNotifier = {
  notify: (workflowRunId: string) => void;
  subscribe: (workflowRunId: string, listener: () => void) => () => void;
};

export function createEventNotifier(): EventNotifier {
  const listeners = new Map<string, Set<() => void>>();
  return {
    notify(workflowRunId) {
      for (const listener of listeners.get(workflowRunId) ?? []) {
        listener();
      }
    },
    subscribe(workflowRunId, listener) {
      const set = listeners.get(workflowRunId) ?? new Set();
      set.add(listener);
      listeners.set(workflowRunId, set);
      return () => {
        set.delete(listener);
        if (set.size === 0) {
          listeners.delete(workflowRunId);
        }
      };
    },
  };
}

export type EventStreamRouteDeps = {
  db: StudioDb;
  notifier: EventNotifier;
  /** Chu kỳ đọc lại `events` khi không có notify. */
  pollMs?: number;
  /** docs/07-API-CONTRACTS.md: comment heartbeat mỗi 15 giây. */
  heartbeatMs?: number;
};

const BATCH_SIZE = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Một frame SSE. `JSON.stringify` không sinh xuống dòng, nên payload không chèn được field lạ. */
export function formatSseEvent(row: Pick<EventRow, "id" | "type" | "workflowRunId" | "payload">): string {
  const data = isRecord(row.payload)
    ? { ...row.payload, workflowRunId: row.workflowRunId }
    : { workflowRunId: row.workflowRunId, payload: row.payload };
  return `id: ${row.id}\nevent: ${row.type}\ndata: ${JSON.stringify(data)}\n\n`;
}

function writeChunk(raw: ServerResponse, chunk: string): Promise<void> {
  if (raw.write(chunk)) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const done = () => {
      raw.off("drain", done);
      raw.off("close", done);
      resolve();
    };
    raw.once("drain", done);
    raw.once("close", done);
  });
}

export function registerEventStreamRoute(app: FastifyInstance, deps: EventStreamRouteDeps): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const pollMs = deps.pollMs ?? 1000;
  const heartbeatMs = deps.heartbeatMs ?? 15_000;
  const openStreams = new Set<() => void>();

  // Đóng stream đang mở trước khi server dừng, để `app.close()` không treo.
  app.addHook("preClose", async () => {
    for (const close of [...openStreams]) {
      close();
    }
  });

  typed.get(
    "/api/workflow-runs/:runId/events/stream",
    {
      schema: {
        params: runIdParamsSchema,
        querystring: eventStreamQuerySchema,
      },
    },
    async (request, reply) => {
      const runId = request.params.runId;
      // Trình duyệt tự gửi `Last-Event-ID` khi nối lại; giá trị này mới hơn `afterId` trong URL cũ.
      const header = request.headers["last-event-id"];
      let start = request.query.afterId ?? "0";
      if (header !== undefined) {
        const parsed = eventIdSchema.safeParse(Array.isArray(header) ? header[0] : header);
        if (!parsed.success) {
          return sendValidationError(reply);
        }
        start = parsed.data;
      }
      if (!(await workflowRunExists(deps.db, runId))) {
        return sendNotFound(reply);
      }

      reply.hijack();
      const raw = reply.raw;
      raw.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });

      let cursor = BigInt(start);
      let closed = false;
      let pending = false;
      let wake: (() => void) | null = null;

      const signal = () => {
        const resolve = wake;
        wake = null;
        if (resolve === null) {
          pending = true;
        } else {
          resolve();
        }
      };
      const unsubscribe = deps.notifier.subscribe(runId, signal);
      const heartbeat = setInterval(() => {
        if (!closed) {
          raw.write(": heartbeat\n\n");
        }
      }, heartbeatMs);

      const close = () => {
        if (closed) {
          return;
        }
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        openStreams.delete(close);
        signal();
        if (!raw.writableEnded) {
          raw.end();
        }
      };
      openStreams.add(close);
      raw.on("close", close);

      const waitForChange = () =>
        new Promise<void>((resolve) => {
          if (pending || closed) {
            pending = false;
            resolve();
            return;
          }
          const timer = setTimeout(() => {
            if (wake === finish) {
              wake = null;
            }
            resolve();
          }, pollMs);
          const finish = () => {
            clearTimeout(timer);
            resolve();
          };
          wake = finish;
        });

      void (async () => {
        try {
          await writeChunk(raw, "retry: 3000\n\n");
          while (!closed) {
            pending = false;
            const rows = await listEventsAfter(deps.db, runId, cursor, BATCH_SIZE);
            for (const row of rows) {
              if (closed) {
                break;
              }
              await writeChunk(raw, formatSseEvent(row));
              cursor = row.id;
            }
            if (rows.length < BATCH_SIZE) {
              await waitForChange();
            }
          }
        } catch (error) {
          request.log.error(error);
        } finally {
          close();
        }
      })();

      return reply;
    },
  );
}
