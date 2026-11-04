import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AGENT_ROLES, buildStations, STATUS_VISUALS } from "./studio-model";
import {
  initialStudioState,
  parseRenderProgress,
  type StudioAction,
  type StudioState,
  studioReducer,
} from "./studio-store";
import { type StudioEventSource, studioStreamUrl, useStudioRun } from "./use-studio-run";

const RUN_ID = "00000000-0000-4000-8000-0000000000aa";

function apply(actions: StudioAction[], state: StudioState = initialStudioState): StudioState {
  return actions.reduce(studioReducer, state);
}

function event(id: number, type: string, data: unknown): StudioAction {
  return { type: "event", id: String(id), event: type, data };
}

/** EventSource giả: test tự phát event; không có timer. */
class FakeEventSource implements StudioEventSource {
  static instances: FakeEventSource[] = [];
  readonly listeners = new Map<
    string,
    ((event: { data: string; lastEventId: string }) => void)[]
  >();
  closed = false;

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: { data: string; lastEventId: string }) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, id: number, data: unknown) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({
        data: typeof data === "string" ? data : JSON.stringify(data),
        lastEventId: String(id),
      });
    }
  }
}

function deps(agentRuns: { role: string; status: string }[] = []) {
  return {
    loadSnapshot: vi.fn(async () => ({ agentRuns })),
    createEventSource: (url: string) => new FakeEventSource(url),
  };
}

afterEach(() => {
  FakeEventSource.instances = [];
  vi.useRealTimers();
});

describe("studio store reducer (P4-02)", () => {
  it("snapshot agent_runs đặt trạng thái; role/status lạ bị bỏ; role thiếu vẫn idle", () => {
    const state = apply([
      {
        type: "snapshot",
        agentRuns: [
          { role: "research", status: "completed" },
          { role: "script", status: "waiting_approval" },
          { role: "hacker", status: "running" },
          { role: "voice", status: "dancing" },
        ],
      },
    ]);
    expect(state.statuses).toEqual({ research: "completed", script: "waiting_approval" });
    const byId = Object.fromEntries(buildStations(state.statuses).map((s) => [s.id, s]));
    expect(byId.script?.visual.approvalSign).toBe(true);
    expect(byId.voice?.status).toBe("idle");
  });

  it("agent.status đổi đúng role; event cũ hoặc lặp sau khi nối lại bị bỏ", () => {
    const state = apply([
      event(5, "agent.status", { role: "voice", status: "running" }),
      event(6, "agent.status", { role: "voice", status: "completed" }),
      event(6, "agent.status", { role: "voice", status: "failed" }),
      event(4, "agent.status", { role: "voice", status: "queued" }),
    ]);
    expect(state.statuses.voice).toBe("completed");
    expect(state.lastEventId).toBe("6");
  });

  it("event progress có frame thì đổi thanh; không có frame thì không vẽ thanh", () => {
    let state = apply([event(1, "agent.status", { role: "video", status: "running" })]);
    state = studioReducer(state, event(2, "job.progress", { stage: "rendering" }));
    expect(state.renderProgress).toBeNull();
    state = studioReducer(state, event(3, "job.progress", { progress: 0.4 }));
    expect(state.renderProgress).toBeNull();
    state = studioReducer(
      state,
      event(4, "job.progress", { renderedFrames: 450, encodedFrames: 400, progress: 0.25 }),
    );
    expect(state.renderProgress).toEqual({
      renderedFrames: 450,
      encodedFrames: 400,
      progress: 0.25,
    });
    state = studioReducer(state, event(5, "job.progress", { renderedFrames: 900, progress: 0.5 }));
    expect(state.renderProgress).toEqual({
      renderedFrames: 900,
      encodedFrames: null,
      progress: 0.5,
    });
    // Video xong thì thanh biến mất.
    state = studioReducer(state, event(6, "agent.status", { role: "video", status: "completed" }));
    expect(state.renderProgress).toBeNull();
  });

  it("parseRenderProgress từ chối frame âm, thập phân, progress ngoài 0–1", () => {
    expect(parseRenderProgress({ renderedFrames: -1, progress: 0.1 })).toBeNull();
    expect(parseRenderProgress({ renderedFrames: 1.5, progress: 0.1 })).toBeNull();
    expect(parseRenderProgress({ renderedFrames: 10, progress: 1.2 })).toBeNull();
    expect(parseRenderProgress(null)).toBeNull();
    expect(parseRenderProgress({ renderedFrames: 0, progress: 0 })).toEqual({
      renderedFrames: 0,
      encodedFrames: null,
      progress: 0,
    });
  });

  it("transition, approval và event không phải số id không đổi hình", () => {
    const state = apply([
      event(1, "workflow.transition", { from: "scripting", to: "waiting_script_approval" }),
      event(2, "approval.recorded", { decision: "approved" }),
      { type: "event", id: "abc", event: "agent.status", data: { role: "qa", status: "running" } },
    ]);
    expect(state.statuses).toEqual({});
    expect(state.lastEventId).toBe("2");
  });
});

describe("useStudioRun (P4-02)", () => {
  it("fixture idle: một phút đồng hồ giả lập trôi qua vẫn idle", async () => {
    vi.useFakeTimers();
    const d = deps([]);
    const { result } = renderHook(() => useStudioRun(RUN_ID, d));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(d.loadSnapshot).toHaveBeenCalledTimes(1);
    expect(result.current.statuses).toEqual({});
    expect(result.current.renderProgress).toBeNull();
    for (const station of buildStations(result.current.statuses)) {
      expect(station.status).toBe("idle");
      expect(station.visual).toEqual(STATUS_VISUALS.idle);
    }
    expect(buildStations(result.current.statuses)).toHaveLength(AGENT_ROLES.length + 1);
  });

  it("mở stream sau snapshot; event SSE cập nhật store; unmount đóng stream", async () => {
    const d = deps([{ role: "video", status: "running" }]);
    const { result, unmount } = renderHook(() => useStudioRun(RUN_ID, d));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.statuses.video).toBe("running");
    expect(FakeEventSource.instances).toHaveLength(1);
    const source = FakeEventSource.instances[0];
    expect(source?.url).toBe(studioStreamUrl(RUN_ID));

    act(() => {
      source?.emit("job.progress", 10, { renderedFrames: 300, progress: 0.2 });
      source?.emit("agent.status", 11, { role: "qa", status: "queued" });
      source?.emit("job.progress", 12, "không phải JSON {");
    });
    expect(result.current.renderProgress).toEqual({
      renderedFrames: 300,
      encodedFrames: null,
      progress: 0.2,
    });
    expect(result.current.statuses.qa).toBe("queued");
    expect(result.current.lastEventId).toBe("11");

    unmount();
    expect(source?.closed).toBe(true);
  });

  it("runId null thì không đọc API, không mở stream", async () => {
    const d = deps();
    const { result } = renderHook(() => useStudioRun(null, d));
    await act(async () => {
      await Promise.resolve();
    });
    expect(d.loadSnapshot).not.toHaveBeenCalled();
    expect(FakeEventSource.instances).toHaveLength(0);
    expect(result.current).toEqual(initialStudioState);
  });

  it("snapshot lỗi thì giữ idle và không mở stream", async () => {
    const d = { ...deps(), loadSnapshot: vi.fn(async () => Promise.reject(new Error("401"))) };
    const { result } = renderHook(() => useStudioRun(RUN_ID, d));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.statuses).toEqual({});
    expect(FakeEventSource.instances).toHaveLength(0);
  });
});
