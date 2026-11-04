import { workflowRunDetailResponseSchema } from "@studio/contracts";
import { useEffect, useReducer } from "react";
import { apiRequest } from "@/lib/api";
import { initialStudioState, type StudioState, studioReducer } from "./studio-store";

/**
 * Subscriber SSE của studio (P4-02). Đọc snapshot `agent_runs` một lần, SAU đó mới mở stream,
 * để event mới không bị snapshot cũ ghi đè. Trình duyệt tự nối lại và gửi `Last-Event-ID`.
 */

/** Phần `EventSource` mà hook dùng; test thay bằng bản giả. */
export type StudioEventSource = {
  addEventListener(
    type: string,
    listener: (event: { data: string; lastEventId: string }) => void,
  ): void;
  close(): void;
};

export type StudioRunDeps = {
  loadSnapshot?: (
    runId: string,
  ) => Promise<{ agentRuns: readonly { role: string; status: string }[] }>;
  createEventSource?: (url: string) => StudioEventSource;
};

/** Event studio nghe. Các type khác (transition, approval) không đổi hình. */
export const STUDIO_EVENT_TYPES = ["agent.status", "job.progress"] as const;

export function studioStreamUrl(runId: string): string {
  return `/api/workflow-runs/${encodeURIComponent(runId)}/events/stream?afterId=0`;
}

const defaultLoadSnapshot = (runId: string) =>
  apiRequest(`/api/workflow-runs/${encodeURIComponent(runId)}`, {
    schema: workflowRunDetailResponseSchema,
  });

const defaultCreateEventSource = (url: string): StudioEventSource => new EventSource(url);

export function useStudioRun(runId: string | null, deps: StudioRunDeps = {}): StudioState {
  const [state, dispatch] = useReducer(studioReducer, initialStudioState);
  const loadSnapshot = deps.loadSnapshot ?? defaultLoadSnapshot;
  const createEventSource = deps.createEventSource ?? defaultCreateEventSource;

  useEffect(() => {
    dispatch({ type: "reset" });
    if (runId === null) {
      return;
    }
    let cancelled = false;
    let source: StudioEventSource | null = null;
    loadSnapshot(runId)
      .then((snapshot) => {
        if (cancelled) {
          return;
        }
        dispatch({ type: "snapshot", agentRuns: snapshot.agentRuns });
        source = createEventSource(studioStreamUrl(runId));
        for (const type of STUDIO_EVENT_TYPES) {
          source.addEventListener(type, (event) => {
            let data: unknown;
            try {
              data = JSON.parse(event.data);
            } catch {
              return;
            }
            dispatch({ type: "event", id: event.lastEventId, event: type, data });
          });
        }
      })
      .catch(() => {
        // Không đọc được snapshot: studio giữ `idle`; panel 2D vẫn hoạt động.
      });
    return () => {
      cancelled = true;
      source?.close();
    };
    // deps là điểm tiêm cho test; đổi deps giữa chừng không mở lại stream.
  }, [runId]);

  return state;
}
