import { randomUUID } from "node:crypto";
import { workerHeartbeatSchema } from "@studio/contracts";
import { createClient } from "redis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startHeartbeat } from "./heartbeat.js";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
/** Prefix riêng: không đụng heartbeat của worker thật. */
const PREFIX = `studio-test-hb-${randomUUID()}:`;
let client: ReturnType<typeof createClient>;

const keys = async () => {
  const found: string[] = [];
  for await (const batch of client.scanIterator({ MATCH: `${PREFIX}*` })) {
    found.push(...batch);
  }
  return found;
};

beforeAll(async () => {
  client = createClient({ url: REDIS_URL });
  await client.connect();
});

afterAll(async () => {
  for (const key of await keys()) {
    await client.del(key);
  }
  await client.quit();
});

describe("heartbeat worker (P3-15)", () => {
  it("ghi key có TTL 30 s kèm queue, làm mới theo chu kỳ, xóa khi dừng", async () => {
    const heartbeat = await startHeartbeat({
      redisUrl: REDIS_URL,
      queues: ["media", "render"],
      prefix: PREFIX,
      intervalMs: 100,
    });
    const [key] = await keys();
    expect(key).toBeDefined();
    const first = workerHeartbeatSchema.parse(JSON.parse((await client.get(key ?? "")) ?? "{}"));
    expect(first.queues).toEqual(["media", "render"]);
    const ttl = await client.ttl(key ?? "");
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(30);
    await new Promise((resolve) => setTimeout(resolve, 350));
    const later = workerHeartbeatSchema.parse(JSON.parse((await client.get(key ?? "")) ?? "{}"));
    expect(Date.parse(later.at)).toBeGreaterThan(Date.parse(first.at));
    expect(later.startedAt).toBe(first.startedAt);
    await heartbeat.stop();
    expect(await keys()).toEqual([]);
  });
});
