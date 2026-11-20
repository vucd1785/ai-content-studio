import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export type StudioDb = PostgresJsDatabase;

export type DbConnection = {
  db: StudioDb;
  close: () => Promise<void>;
};

export function createDbConnection(databaseUrl: string): DbConnection {
  const client = postgres(databaseUrl, { max: 10 });
  const db = drizzle(client);
  return {
    db,
    close: async () => {
      await client.end();
    },
  };
}

/**
 * PostgreSQL đang không phục vụ được: tiến trình bị kill (thường do thiếu RAM) rồi tự phục hồi, khởi động lại,
 * hoặc mất kết nối. Lỗi kiểu này không phải lỗi của job; chờ DB sống lại rồi chạy lại là đúng.
 * Drizzle bọc lỗi gốc trong `cause`, nên đi hết chuỗi `cause`.
 */
const UNAVAILABLE_CODES = new Set([
  "57P01", // admin_shutdown (bị dừng, gồm lúc postmaster khởi động lại sau khi một tiến trình chết)
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now (đang recovery, chưa nhận kết nối)
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "CONNECTION_CLOSED",
  "CONNECTION_ENDED",
  "CONNECTION_DESTROYED",
  "CONNECT_TIMEOUT",
  "ECONNREFUSED",
  "ECONNRESET",
  "EPIPE",
]);
const UNAVAILABLE_MESSAGE =
  /recovery mode|not yet accepting connections|terminating connection|the database system is (starting up|shutting down)|connection terminated|server closed the connection/i;

export function isDatabaseUnavailableError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current !== null && current !== undefined; depth += 1) {
    if (typeof current === "object") {
      const { code, message } = current as { code?: unknown; message?: unknown };
      if (typeof code === "string" && UNAVAILABLE_CODES.has(code)) {
        return true;
      }
      if (typeof message === "string" && UNAVAILABLE_MESSAGE.test(message)) {
        return true;
      }
      current = (current as { cause?: unknown }).cause;
    } else {
      return false;
    }
  }
  return false;
}

/** Chờ tới khi PostgreSQL trả lời `select 1` (sau recovery). Hết `timeoutMs` thì `false`. */
export async function waitForDatabase(
  db: StudioDb,
  options: { timeoutMs?: number; intervalMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<boolean> {
  const timeoutMs = options.timeoutMs ?? 10 * 60_000;
  const intervalMs = options.intervalMs ?? 3_000;
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await db.execute(sql`select 1`);
      return true;
    } catch {
      if (Date.now() >= deadline) {
        return false;
      }
      await sleep(intervalMs);
    }
  }
}
