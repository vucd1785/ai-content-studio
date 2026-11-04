import { randomUUID } from "node:crypto";
import type { WorkerHeartbeat } from "@studio/contracts";
import { createDbConnection } from "@studio/db";
import { createClient } from "redis";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { redisHeartbeatReader } from "./worker-status.js";

const TEST_PASSWORD = "director-test-password";
const TEST_SECRET = "0123456789abcdef0123456789abcdef0123456789ab";
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

const beat = (queues: WorkerHeartbeat["queues"], at: string): WorkerHeartbeat => ({
  id: randomUUID(),
  queues,
  startedAt: "2026-11-01T00:00:00.000Z",
  at,
});

async function appWith(readHeartbeats: () => Promise<WorkerHeartbeat[]>) {
  const { db, close } = createDbConnection(
    process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio_test",
  );
  const app = await buildApp({
    password: TEST_PASSWORD,
    sessionSecret: TEST_SECRET,
    nowSeconds: 1_700_000_000,
    enableLogger: false,
    projects: { db, dataDir: "." },
    readHeartbeats,
  });
  app.addHook("onClose", async () => close());
  const login = await app.inject({
    method: "POST",
    url: "/api/session/login",
    payload: { password: TEST_PASSWORD },
  });
  const setCookie = login.headers["set-cookie"];
  const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)?.split(";")[0] ?? "";
  return { app, cookie };
}

describe("GET /api/worker-status (P3-15)", () => {
  it("gộp queue của mọi worker còn sống, lấy lần thấy gần nhất; không có worker hay Redis lỗi thì alive false", async () => {
    const live = await appWith(async () => [
      beat(["llm"], "2026-11-01T01:00:05.000Z"),
      beat(["render", "media"], "2026-11-01T01:00:09.000Z"),
    ]);
    const response = await live.app.inject({
      method: "GET",
      url: "/api/worker-status",
      headers: { cookie: live.cookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      alive: true,
      queues: ["llm", "media", "render"],
      lastSeenAt: "2026-11-01T01:00:09.000Z",
    });
    expect(response.body).not.toMatch(/redis:|id/);
    const anonymous = await live.app.inject({ method: "GET", url: "/api/worker-status" });
    expect(anonymous.statusCode).toBe(401);
    await live.app.close();

    const none = await appWith(async () => []);
    expect(
      (
        await none.app.inject({
          method: "GET",
          url: "/api/worker-status",
          headers: { cookie: none.cookie },
        })
      ).json(),
    ).toEqual({
      alive: false,
      queues: [],
      lastSeenAt: null,
    });
    await none.app.close();

    const broken = await appWith(async () => {
      throw new Error("redis down");
    });
    expect(
      (
        await broken.app.inject({
          method: "GET",
          url: "/api/worker-status",
          headers: { cookie: broken.cookie },
        })
      ).json(),
    ).toMatchObject({
      alive: false,
    });
    await broken.app.close();
  });

  it("reader Redis đọc key theo prefix, bỏ giá trị sai schema", async () => {
    const prefix = `studio-test-hb-${randomUUID()}:`;
    const client = createClient({ url: REDIS_URL });
    await client.connect();
    const good = beat(["media"], "2026-11-01T02:00:00.000Z");
    await client.set(`${prefix}a`, JSON.stringify(good), { EX: 30 });
    await client.set(`${prefix}b`, JSON.stringify({ id: "x", queues: ["khong-co"] }), { EX: 30 });
    try {
      const read = await redisHeartbeatReader(REDIS_URL, prefix)();
      expect(read).toEqual([good]);
    } finally {
      await client.del([`${prefix}a`, `${prefix}b`]);
      await client.quit();
    }
  });
});
