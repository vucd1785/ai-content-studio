import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendEvents,
  artifacts,
  createDbConnection,
  createProject,
  deleteProjectCascadeForTests,
  insertBrief,
  publishEvents,
  workflowRuns,
} from "@studio/db";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp, type StudioApp } from "../app.js";
import { formatSseEvent } from "./event-stream.js";

const TEST_PASSWORD = "director-test-password";
const TEST_SECRET = "0123456789abcdef0123456789abcdef0123456789ab";
const NOW = 1_700_000_000;
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";

type Db = ReturnType<typeof createDbConnection>["db"];
type RunStatus = (typeof workflowRuns.$inferSelect)["status"];

type SseFrame = { id?: string; event?: string; data?: string; comment?: string };

const createdProjectIds: string[] = [];
const projectIdByRun = new Map<string, string>();
const openApps: StudioApp[] = [];
const openStreams: AbortController[] = [];
let db: Db;
let closeDb: () => Promise<void>;
let dataDir = "";

async function seedRun(status: RunStatus = "researching") {
  const project = await createProject(db, "P3-07 test run");
  createdProjectIds.push(project.id);
  const brief = await insertBrief(db, project.id, {
    topic: "SSE",
    audience: "Dev",
    goal: "Theo dõi run",
    durationSec: 60,
    language: "vi",
    tone: "friendly",
    visualStyle: "edu",
  });
  const [run] = await db
    .insert(workflowRuns)
    .values({ projectId: project.id, briefId: brief.id, status })
    .returning();
  if (run === undefined) {
    throw new Error("seed run failed");
  }
  projectIdByRun.set(run.id, project.id);
  return run.id;
}

async function addEvent(runId: string, payload: Record<string, unknown>) {
  const [row] = await appendEvents(db, [{ workflowRunId: runId, type: "agent.status", payload }]);
  if (row === undefined) {
    throw new Error("append event failed");
  }
  return row.id.toString();
}

async function startApp(options: { pollMs?: number; heartbeatMs?: number } = {}) {
  const app = await buildApp({
    password: TEST_PASSWORD,
    sessionSecret: TEST_SECRET,
    nowSeconds: NOW,
    enableLogger: false,
    projects: { db, dataDir },
    eventStream: { pollMs: options.pollMs ?? 50, heartbeatMs: options.heartbeatMs ?? 60_000 },
  });
  openApps.push(app);
  const login = await app.inject({
    method: "POST",
    url: "/api/session/login",
    payload: { password: TEST_PASSWORD },
  });
  const setCookie = login.headers["set-cookie"];
  const line = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const address = await app.listen({ host: "127.0.0.1", port: 0 });
  return { app, cookie: line?.split(";")[0] ?? "", baseUrl: address };
}

/** Client SSE tối giản: đọc body và tách frame theo dòng trống. */
async function openStream(url: string, headers: Record<string, string>) {
  const controller = new AbortController();
  openStreams.push(controller);
  const response = await fetch(url, { headers, signal: controller.signal });
  const frames: SseFrame[] = [];
  let ended = false;
  if (response.ok && response.body !== null) {
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    void (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          buffer += value;
          let index = buffer.indexOf("\n\n");
          while (index !== -1) {
            const block = buffer.slice(0, index);
            buffer = buffer.slice(index + 2);
            const frame: SseFrame = {};
            for (const lineText of block.split("\n")) {
              if (lineText.startsWith(":")) {
                frame.comment = lineText.slice(1).trim();
              } else {
                const colon = lineText.indexOf(":");
                const field = lineText.slice(0, colon);
                const fieldValue = lineText.slice(colon + 1).trimStart();
                if (field === "id" || field === "event" || field === "data") {
                  frame[field] = fieldValue;
                }
              }
            }
            frames.push(frame);
            index = buffer.indexOf("\n\n");
          }
        }
      } catch {
        // abort từ test
      } finally {
        ended = true;
      }
    })();
  }
  const events = () => frames.filter((frame) => frame.id !== undefined);
  return {
    response,
    frames,
    events,
    isEnded: () => ended,
    abort: () => controller.abort(),
    async waitForEvents(count: number, timeoutMs = 3000) {
      const deadline = Date.now() + timeoutMs;
      while (events().length < count) {
        if (Date.now() > deadline) {
          throw new Error(`timeout: có ${events().length}/${count} event`);
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return events();
    },
  };
}

function streamUrl(baseUrl: string, runId: string, query = "") {
  return `${baseUrl}/api/workflow-runs/${runId}/events/stream${query}`;
}

describe("formatSseEvent", () => {
  it("ghi id, event và data một dòng; payload có xuống dòng không chèn được field", () => {
    const frame = formatSseEvent({
      id: 124n,
      type: "agent.status",
      workflowRunId: "00000000-0000-4000-8000-000000000001",
      payload: { role: "voice", status: "running", note: "a\n\nid: 999\nevent: x" },
    });
    const lines = frame.split("\n");
    expect(lines[0]).toBe("id: 124");
    expect(lines[1]).toBe("event: agent.status");
    expect(lines[2]?.startsWith("data: ")).toBe(true);
    expect(lines.slice(3)).toEqual(["", ""]);
    expect(JSON.parse(lines[2]?.slice(6) ?? "")).toEqual({
      role: "voice",
      status: "running",
      note: "a\n\nid: 999\nevent: x",
      workflowRunId: "00000000-0000-4000-8000-000000000001",
    });
  });

  it("workflowRunId của hàng thắng field trùng tên trong payload", () => {
    const frame = formatSseEvent({
      id: 1n,
      type: "job.progress",
      workflowRunId: "00000000-0000-4000-8000-000000000002",
      payload: { workflowRunId: "fake", frame: 10 },
    });
    expect(JSON.parse(frame.split("\n")[2]?.slice(6) ?? "")).toEqual({
      workflowRunId: "00000000-0000-4000-8000-000000000002",
      frame: 10,
    });
  });
});

describe("SSE events stream (P3-07)", () => {
  beforeAll(async () => {
    const conn = createDbConnection(DATABASE_URL);
    db = conn.db;
    closeDb = conn.close;
    dataDir = await mkdtemp(join(tmpdir(), "studio-p3-07-"));
  });

  afterEach(async () => {
    for (const controller of openStreams.splice(0)) {
      controller.abort();
    }
    for (const app of openApps.splice(0)) {
      await app.close();
    }
  });

  afterAll(async () => {
    for (const projectId of createdProjectIds) {
      await deleteProjectCascadeForTests(db, projectId);
    }
    await closeDb();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("afterId phát lại hàng đã commit theo thứ tự, rồi đẩy event mới", async () => {
    const runId = await seedRun();
    const first = await addEvent(runId, { role: "research", status: "queued" });
    const second = await addEvent(runId, { role: "research", status: "running" });
    const third = await addEvent(runId, { role: "research", status: "completed" });
    const { cookie, baseUrl } = await startApp();

    const stream = await openStream(streamUrl(baseUrl, runId, `?afterId=${first}`), { cookie });
    expect(stream.response.status).toBe(200);
    expect(stream.response.headers.get("content-type")).toMatch(/^text\/event-stream/);
    const replayed = await stream.waitForEvents(2);
    expect(replayed.map((frame) => frame.id)).toEqual([second, third]);
    expect(replayed[0]).toMatchObject({ event: "agent.status" });
    expect(JSON.parse(replayed[0]?.data ?? "")).toEqual({
      workflowRunId: runId,
      role: "research",
      status: "running",
    });

    const fourth = await addEvent(runId, { role: "script", status: "queued" });
    const all = await stream.waitForEvents(3);
    expect(all.map((frame) => frame.id)).toEqual([second, third, fourth]);
  });

  it("không có afterId thì phát từ đầu; không lẫn event của run khác", async () => {
    const runId = await seedRun();
    const otherRunId = await seedRun();
    const mine = await addEvent(runId, { role: "voice", status: "queued" });
    await addEvent(otherRunId, { role: "voice", status: "failed" });
    const { cookie, baseUrl } = await startApp();

    const stream = await openStream(streamUrl(baseUrl, runId), { cookie });
    const received = await stream.waitForEvents(1);
    await addEvent(otherRunId, { role: "qa", status: "running" });
    const later = await addEvent(runId, { role: "voice", status: "running" });
    const both = await stream.waitForEvents(2);
    expect(both.map((frame) => frame.id)).toEqual([mine, later]);
    expect(received[0]?.id).toBe(mine);
    for (const frame of both) {
      expect(JSON.parse(frame.data ?? "").workflowRunId).toBe(runId);
    }
  });

  it("ngắt kết nối không mất hàng đã insert: nối lại bằng Last-Event-ID nhận đủ", async () => {
    const runId = await seedRun();
    const first = await addEvent(runId, { role: "visual", status: "running" });
    const { cookie, baseUrl } = await startApp();

    const before = await openStream(streamUrl(baseUrl, runId, "?afterId=0"), { cookie });
    const seen = await before.waitForEvents(1);
    expect(seen.map((frame) => frame.id)).toEqual([first]);
    before.abort();

    // Insert trong lúc client không kết nối.
    const missedA = await addEvent(runId, { role: "visual", status: "completed" });
    const missedB = await addEvent(runId, { role: "voice", status: "running" });

    // URL cũ vẫn mang afterId=0; trình duyệt gửi Last-Event-ID và header này thắng.
    const lastId = seen.at(-1)?.id ?? "";
    const after = await openStream(streamUrl(baseUrl, runId, "?afterId=0"), {
      cookie,
      "last-event-id": lastId,
    });
    const resumed = await after.waitForEvents(2);
    expect(resumed.map((frame) => frame.id)).toEqual([missedA, missedB]);

    // Nối lại bằng query afterId cũng nhận đúng phần còn thiếu.
    const viaQuery = await openStream(streamUrl(baseUrl, runId, `?afterId=${lastId}`), { cookie });
    expect((await viaQuery.waitForEvents(2)).map((frame) => frame.id)).toEqual([missedA, missedB]);
  });

  it("approval qua route đánh thức stream ngay, không chờ poll", async () => {
    const runId = await seedRun("waiting_script_approval");
    const projectId = projectIdByRun.get(runId) ?? "";
    const [artifact] = await db
      .insert(artifacts)
      .values({
        projectId,
        workflowRunId: runId,
        type: "script",
        version: 1,
        schemaVersion: "1",
        contentHash: "test-script",
        storageKey: `test/p3-07/${runId}/script.json`,
      })
      .returning({ id: artifacts.id });
    // Poll 60 giây: event chỉ tới kịp nhờ notifier.
    const { app, cookie, baseUrl } = await startApp({ pollMs: 60_000 });

    const stream = await openStream(streamUrl(baseUrl, runId), { cookie });
    await waitUntil(() => stream.frames.length >= 1); // frame `retry`
    const response = await app.inject({
      method: "POST",
      url: `/api/workflow-runs/${runId}/approvals`,
      headers: { cookie },
      payload: { gate: "script", decision: "approved", artifactId: artifact?.id, variantIndex: 1 },
    });
    expect(response.statusCode).toBe(201);
    // P3-05: duyệt script còn tạo hai job visual/voice (`agent.status` queued) cùng transaction.
    const received = await stream.waitForEvents(4, 1500);
    expect(received.map((frame) => frame.event)).toEqual([
      "approval.recorded",
      "workflow.transition",
      "agent.status",
      "agent.status",
    ]);
    expect(JSON.parse(received[1]?.data ?? "")).toMatchObject({
      from: "waiting_script_approval",
      to: "producing_assets",
      cause: "approval",
    });
  });

  it("gửi comment heartbeat theo chu kỳ", async () => {
    const runId = await seedRun();
    const { cookie, baseUrl } = await startApp({ heartbeatMs: 30 });
    const stream = await openStream(streamUrl(baseUrl, runId), { cookie });
    await waitUntil(() => stream.frames.some((frame) => frame.comment === "heartbeat"));
    expect(stream.events()).toEqual([]);
  });

  it("app.close() đóng stream đang mở", async () => {
    const runId = await seedRun();
    const { app, cookie, baseUrl } = await startApp();
    const stream = await openStream(streamUrl(baseUrl, runId), { cookie });
    await waitUntil(() => stream.frames.length >= 1);
    openApps.splice(openApps.indexOf(app), 1);
    await app.close();
    await waitUntil(() => stream.isEnded());
  });

  it("từ chối không session, run lạ, runId sai, afterId sai, Last-Event-ID sai", async () => {
    const runId = await seedRun();
    const { cookie, baseUrl } = await startApp();

    const noSession = await fetch(streamUrl(baseUrl, runId));
    expect(noSession.status).toBe(401);
    expect(await errorCode(noSession)).toBe("unauthorized");

    const unknown = await fetch(streamUrl(baseUrl, randomUUID()), { headers: { cookie } });
    expect(unknown.status).toBe(404);
    expect(await errorCode(unknown)).toBe("not_found");

    const badRun = await fetch(streamUrl(baseUrl, "not-a-uuid"), { headers: { cookie } });
    expect(badRun.status).toBe(400);

    for (const afterId of ["abc", "-1", "1.5", "01", "99999999999999999999"]) {
      const bad = await fetch(streamUrl(baseUrl, runId, `?afterId=${afterId}`), { headers: { cookie } });
      expect(bad.status, afterId).toBe(400);
      expect(await errorCode(bad)).toBe("validation_error");
    }

    const badHeader = await fetch(streamUrl(baseUrl, runId), {
      headers: { cookie, "last-event-id": "x" },
    });
    expect(badHeader.status).toBe(400);
  });
});

describe("publishEvents (P3-07)", () => {
  beforeAll(async () => {
    const conn = createDbConnection(DATABASE_URL);
    db = conn.db;
    closeDb = conn.close;
  });

  afterAll(async () => {
    for (const projectId of createdProjectIds.splice(0)) {
      await deleteProjectCascadeForTests(db, projectId);
    }
    await closeDb();
  });

  it("người ghi thứ hai cùng run chờ người thứ nhất commit, nên thứ tự commit trùng thứ tự id", async () => {
    const runId = await seedRun();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let firstInserted: () => void = () => {};
    const inserted = new Promise<void>((resolve) => {
      firstInserted = resolve;
    });

    const firstWriter = db.transaction(async (tx) => {
      const rows = await publishEvents(tx, [
        { workflowRunId: runId, type: "agent.status", payload: { order: "first" } },
      ]);
      firstInserted();
      await gate;
      return rows[0]?.id;
    });
    await inserted;

    let secondDone = false;
    const secondWriter = appendEvents(db, [
      { workflowRunId: runId, type: "agent.status", payload: { order: "second" } },
    ]).then((rows) => {
      secondDone = true;
      return rows[0]?.id;
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(secondDone).toBe(false);
    release();
    const [firstId, secondId] = await Promise.all([firstWriter, secondWriter]);
    expect(firstId).toBeDefined();
    expect(secondId).toBeDefined();
    expect((secondId ?? 0n) > (firstId ?? 0n)).toBe(true);
  });

  it("danh sách rỗng không mở khóa, không insert", async () => {
    expect(await appendEvents(db, [])).toEqual([]);
  });
});

async function waitUntil(predicate: () => boolean, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error("timeout");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function errorCode(response: Response): Promise<string | undefined> {
  const body = (await response.json()) as { error?: { code?: string } };
  return body.error?.code;
}
