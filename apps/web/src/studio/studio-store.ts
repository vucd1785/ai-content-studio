import { AGENT_ROLES, AGENT_STATUSES, type AgentRole, type AgentStatus } from "./studio-model";

/**
 * Store thuần của studio (P4-02, 06-3D-UI-DESIGN). Chỉ đổi khi có snapshot `agent_runs` hoặc event SSE
 * đã lưu; không có timer, không suy đoán tiến độ. Canvas đọc snapshot từ đây, không gọi API.
 */

/** Field lấy từ callback `onProgress` của `renderMedia()`, chuyển nguyên qua `job.progress`. */
export type RenderProgress = {
  renderedFrames: number;
  encodedFrames: number | null;
  /** 0–1, do Remotion tính từ frame. */
  progress: number;
};

export type StudioState = {
  statuses: Partial<Record<AgentRole, AgentStatus>>;
  /** Chỉ khác null khi event `job.progress` có số frame. */
  renderProgress: RenderProgress | null;
  /** Id event cuối đã áp, để bỏ event lặp sau khi nối lại. */
  lastEventId: string | null;
};

export type StudioAction =
  | { type: "reset" }
  | { type: "snapshot"; agentRuns: readonly { role: string; status: string }[] }
  | { type: "event"; id: string; event: string; data: unknown };

export const initialStudioState: StudioState = { statuses: {}, renderProgress: null, lastEventId: null };

function isRole(value: unknown): value is AgentRole {
  return typeof value === "string" && (AGENT_ROLES as readonly string[]).includes(value);
}

function isStatus(value: unknown): value is AgentStatus {
  return typeof value === "string" && (AGENT_STATUSES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFrameCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** Payload không có số frame thì trả null: UI không vẽ thanh. */
export function parseRenderProgress(data: unknown): RenderProgress | null {
  if (!isRecord(data) || !isFrameCount(data.renderedFrames)) {
    return null;
  }
  const progress = data.progress;
  if (typeof progress !== "number" || !Number.isFinite(progress) || progress < 0 || progress > 1) {
    return null;
  }
  return {
    renderedFrames: data.renderedFrames,
    encodedFrames: isFrameCount(data.encodedFrames) ? data.encodedFrames : null,
    progress,
  };
}

function isNewer(id: string, lastEventId: string | null): boolean {
  if (!/^\d+$/.test(id)) {
    return false;
  }
  return lastEventId === null || BigInt(id) > BigInt(lastEventId);
}

export function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case "reset":
      return initialStudioState;
    case "snapshot": {
      // Nhiều agent_run cùng role (retry): hàng sau thắng.
      const statuses: StudioState["statuses"] = {};
      for (const run of action.agentRuns) {
        if (isRole(run.role) && isStatus(run.status)) {
          statuses[run.role] = run.status;
        }
      }
      const videoRunning = statuses.video === "running";
      return { ...state, statuses, renderProgress: videoRunning ? state.renderProgress : null };
    }
    case "event": {
      if (!isNewer(action.id, state.lastEventId)) {
        return state;
      }
      const next = { ...state, lastEventId: action.id };
      if (action.event === "agent.status" && isRecord(action.data)) {
        const { role, status } = action.data;
        if (!isRole(role) || !isStatus(status)) {
          return next;
        }
        return {
          ...next,
          statuses: { ...state.statuses, [role]: status },
          // Video rời `running` thì bỏ thanh render.
          renderProgress: role === "video" && status !== "running" ? null : state.renderProgress,
        };
      }
      if (action.event === "job.progress") {
        const progress = parseRenderProgress(action.data);
        return progress === null ? next : { ...next, renderProgress: progress };
      }
      return next;
    }
  }
}
