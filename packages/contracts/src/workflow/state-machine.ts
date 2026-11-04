/**
 * State machine workflow thuần (docs/04-AGENT-ORCHESTRATION.md mục Trạng thái workflow).
 * Không I/O, không network, không đồng hồ. Caller ghi kết quả vào DB cùng event.
 */

export const WORKFLOW_STATUSES = [
  "idea_submitted",
  "researching",
  "research_ready",
  "scripting",
  // Phase 6 (P6-10): dựng storyboard ảnh tĩnh của script `2` trước cổng script (ADR-014).
  "storyboarding",
  "waiting_script_approval",
  "producing_assets",
  "preview_rendering",
  "qa",
  "waiting_final_approval",
  "exporting",
  "exported",
  "failed",
  "cancelled",
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const RESUME_FROM_VALUES = [
  "researching",
  "scripting",
  "producing_assets",
  "preview_rendering",
  "qa",
  "exporting",
] as const;

export type ResumeFrom = (typeof RESUME_FROM_VALUES)[number];

export type WorkflowGate = "script" | "final";
export type WorkflowDecision = "approved" | "rejected" | "changes_requested";

/** Cạnh do job tiến tới (không qua cổng duyệt). */
const ADVANCE_EDGES: Readonly<Record<WorkflowStatus, readonly WorkflowStatus[]>> = {
  idea_submitted: ["researching"],
  researching: ["research_ready"],
  research_ready: ["scripting"],
  // Script `1` đi thẳng tới cổng; script `2` có shot list đi qua `storyboarding` (04 mục Phase 6).
  scripting: ["waiting_script_approval", "storyboarding"],
  // Lỗi storyboard không chặn cổng, nên không có cạnh `storyboarding → failed`.
  storyboarding: ["waiting_script_approval"],
  waiting_script_approval: [],
  producing_assets: ["preview_rendering"],
  preview_rendering: ["qa"],
  qa: ["waiting_final_approval"],
  waiting_final_approval: [],
  exporting: ["exported"],
  exported: [],
  failed: [],
  cancelled: [],
};

/** Trạng thái được phép sang `failed`. */
const FAILABLE: ReadonlySet<WorkflowStatus> = new Set<WorkflowStatus>([
  "researching",
  "scripting",
  "producing_assets",
  "preview_rendering",
  "qa",
  "exporting",
]);

const GATE_STATUS: Readonly<Record<WorkflowGate, WorkflowStatus>> = {
  script: "waiting_script_approval",
  final: "waiting_final_approval",
};

/** Cạnh qua cổng duyệt. `rejected` giữ nguyên cổng (approval vẫn được lưu). */
const APPROVAL_TARGET: Readonly<Record<WorkflowGate, Record<WorkflowDecision, WorkflowStatus>>> = {
  script: {
    approved: "producing_assets",
    changes_requested: "scripting",
    rejected: "waiting_script_approval",
  },
  final: {
    approved: "exporting",
    // Director chốt 2026-11-01 (P3-14): sửa bản cuối là viết lại kịch bản theo ghi chú rồi duyệt lại.
    changes_requested: "scripting",
    rejected: "waiting_final_approval",
  },
};

export type WorkflowCommand =
  | { kind: "advance"; to: WorkflowStatus }
  | { kind: "approval"; gate: WorkflowGate; decision: WorkflowDecision }
  | { kind: "fail" }
  | { kind: "cancel" }
  | { kind: "resume" };

export type WorkflowState = {
  status: WorkflowStatus;
  resumeFrom: ResumeFrom | null;
};

export type TransitionResult =
  | { ok: true; to: WorkflowStatus }
  | { ok: false; code: "invalid_transition" };

const REJECT: TransitionResult = { ok: false, code: "invalid_transition" };

export function applyWorkflowCommand(
  state: WorkflowState,
  command: WorkflowCommand,
): TransitionResult {
  const from = state.status;
  switch (command.kind) {
    case "advance":
      return ADVANCE_EDGES[from].includes(command.to) ? { ok: true, to: command.to } : REJECT;
    case "approval":
      return from === GATE_STATUS[command.gate]
        ? { ok: true, to: APPROVAL_TARGET[command.gate][command.decision] }
        : REJECT;
    case "fail":
      return FAILABLE.has(from) ? { ok: true, to: "failed" } : REJECT;
    case "cancel":
      return from === "exported" || from === "cancelled" ? REJECT : { ok: true, to: "cancelled" };
    case "resume":
      return from === "failed" && state.resumeFrom !== null
        ? { ok: true, to: state.resumeFrom }
        : REJECT;
  }
}

/** Tập cạnh đầy đủ theo sơ đồ (dùng cho test và tài liệu), không gồm cancel/resume. */
export function diagramEdges(): ReadonlyArray<readonly [WorkflowStatus, WorkflowStatus]> {
  const edges: [WorkflowStatus, WorkflowStatus][] = [];
  for (const from of WORKFLOW_STATUSES) {
    for (const to of ADVANCE_EDGES[from]) edges.push([from, to]);
    if (FAILABLE.has(from)) edges.push([from, "failed"]);
  }
  for (const gate of ["script", "final"] as const) {
    for (const to of new Set(Object.values(APPROVAL_TARGET[gate]))) {
      if (to !== GATE_STATUS[gate]) edges.push([GATE_STATUS[gate], to]);
    }
  }
  return edges;
}
