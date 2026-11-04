import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyWorkflowCommand,
  diagramEdges,
  RESUME_FROM_VALUES,
  type ResumeFrom,
  WORKFLOW_STATUSES,
  type WorkflowDecision,
  type WorkflowGate,
  type WorkflowStatus,
} from "./state-machine.js";

/** Sơ đồ trong docs/04-AGENT-ORCHESTRATION.md, chép tay để test độc lập với bảng trong code. */
const DOC_EDGES: ReadonlyArray<readonly [WorkflowStatus, WorkflowStatus]> = [
  ["idea_submitted", "researching"],
  ["researching", "research_ready"],
  ["research_ready", "scripting"],
  ["scripting", "waiting_script_approval"],
  // Phase 6 (04 mục Phase 6): script `2` qua storyboard trước cổng; storyboard không có cạnh failed.
  ["scripting", "storyboarding"],
  ["storyboarding", "waiting_script_approval"],
  ["waiting_script_approval", "scripting"],
  ["waiting_script_approval", "producing_assets"],
  ["producing_assets", "preview_rendering"],
  ["preview_rendering", "qa"],
  ["qa", "waiting_final_approval"],
  ["waiting_final_approval", "scripting"],
  ["waiting_final_approval", "exporting"],
  ["exporting", "exported"],
  ["researching", "failed"],
  ["scripting", "failed"],
  ["producing_assets", "failed"],
  ["preview_rendering", "failed"],
  ["qa", "failed"],
  ["exporting", "failed"],
];

const GATE_EDGES = new Set([
  "waiting_script_approval>scripting",
  "waiting_script_approval>producing_assets",
  "waiting_final_approval>scripting",
  "waiting_final_approval>exporting",
]);

const key = (from: WorkflowStatus, to: WorkflowStatus) => `${from}>${to}`;
const docSet = new Set(DOC_EDGES.map(([a, b]) => key(a, b)));
const st = (status: WorkflowStatus, resumeFrom: ResumeFrom | null = null) => ({
  status,
  resumeFrom,
});

beforeEach(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("network forbidden in state machine");
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("workflow state machine (P3-02)", () => {
  it("tập cạnh trong code khớp đúng sơ đồ tài liệu", () => {
    expect(new Set(diagramEdges().map(([a, b]) => key(a, b)))).toEqual(docSet);
  });

  it("bảng advance: mọi cặp (from, to) 14×14 — chỉ cạnh job hợp lệ được nhận", () => {
    for (const from of WORKFLOW_STATUSES) {
      for (const to of WORKFLOW_STATUSES) {
        const result = applyWorkflowCommand(st(from), { kind: "advance", to });
        const expected =
          docSet.has(key(from, to)) && to !== "failed" && !GATE_EDGES.has(key(from, to));
        expect(result.ok, `${from} -> ${to}`).toBe(expected);
        if (!result.ok) expect(result.code).toBe("invalid_transition");
      }
    }
  });

  it("cạnh qua cổng duyệt không đi được bằng advance", () => {
    for (const edge of GATE_EDGES) {
      const [from, to] = edge.split(">") as [WorkflowStatus, WorkflowStatus];
      expect(applyWorkflowCommand(st(from), { kind: "advance", to }).ok).toBe(false);
    }
  });

  it("bảng approval: gate × decision × status", () => {
    const expected: Record<WorkflowGate, Record<WorkflowDecision, WorkflowStatus>> = {
      script: {
        approved: "producing_assets",
        changes_requested: "scripting",
        rejected: "waiting_script_approval",
      },
      final: {
        approved: "exporting",
        changes_requested: "scripting",
        rejected: "waiting_final_approval",
      },
    };
    const gateStatus = {
      script: "waiting_script_approval",
      final: "waiting_final_approval",
    } as const;
    for (const gate of ["script", "final"] as const) {
      for (const decision of ["approved", "rejected", "changes_requested"] as const) {
        for (const from of WORKFLOW_STATUSES) {
          const result = applyWorkflowCommand(st(from), { kind: "approval", gate, decision });
          if (from === gateStatus[gate]) {
            expect(result, `${gate}/${decision}@${from}`).toEqual({
              ok: true,
              to: expected[gate][decision],
            });
          } else {
            expect(result, `${gate}/${decision}@${from}`).toEqual({
              ok: false,
              code: "invalid_transition",
            });
          }
        }
      }
    }
  });

  it("fail chỉ từ trạng thái đang chạy job", () => {
    const failable = new Set(DOC_EDGES.filter(([, to]) => to === "failed").map(([from]) => from));
    for (const from of WORKFLOW_STATUSES) {
      expect(applyWorkflowCommand(st(from), { kind: "fail" }).ok, from).toBe(failable.has(from));
    }
  });

  it("cancel từ mọi trạng thái trừ exported và cancelled", () => {
    for (const from of WORKFLOW_STATUSES) {
      const result = applyWorkflowCommand(st(from), { kind: "cancel" });
      if (from === "exported" || from === "cancelled") {
        expect(result.ok, from).toBe(false);
      } else {
        expect(result, from).toEqual({ ok: true, to: "cancelled" });
      }
    }
  });

  it("resume chỉ từ failed và đi đúng resume_from", () => {
    for (const resumeFrom of RESUME_FROM_VALUES) {
      expect(applyWorkflowCommand(st("failed", resumeFrom), { kind: "resume" })).toEqual({
        ok: true,
        to: resumeFrom,
      });
    }
    expect(applyWorkflowCommand(st("failed", null), { kind: "resume" }).ok).toBe(false);
    for (const from of WORKFLOW_STATUSES) {
      if (from === "failed") continue;
      expect(applyWorkflowCommand(st(from, "scripting"), { kind: "resume" }).ok, from).toBe(false);
    }
  });

  it("exported và cancelled là trạng thái cuối: không lệnh nào đi tiếp", () => {
    for (const from of ["exported", "cancelled"] as const) {
      for (const to of WORKFLOW_STATUSES) {
        expect(applyWorkflowCommand(st(from), { kind: "advance", to }).ok).toBe(false);
      }
      expect(applyWorkflowCommand(st(from), { kind: "fail" }).ok).toBe(false);
      expect(applyWorkflowCommand(st(from, "qa"), { kind: "resume" }).ok).toBe(false);
    }
  });

  it("module không import gì (thuần, không network)", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./state-machine.ts", import.meta.url)),
      "utf8",
    );
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/\bfetch\b|\brequire\(|process\.|Date\.now|setInterval|setTimeout/);
  });
});
