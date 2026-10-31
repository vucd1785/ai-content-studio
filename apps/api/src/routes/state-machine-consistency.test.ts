import { applyWorkflowCommand } from "@studio/contracts";
import { APPROVAL_GATE_STATUS, nextStatusAfterApproval } from "@studio/db";
import { describe, expect, it } from "vitest";

describe("approval route khớp state machine (P3-02)", () => {
  it("nextStatusAfterApproval trùng applyWorkflowCommand cho mọi gate × decision", () => {
    for (const gate of ["script", "final"] as const) {
      for (const decision of ["approved", "rejected", "changes_requested"] as const) {
        const result = applyWorkflowCommand(
          { status: APPROVAL_GATE_STATUS[gate], resumeFrom: null },
          { kind: "approval", gate, decision },
        );
        expect(result, `${gate}/${decision}`).toEqual({
          ok: true,
          to: nextStatusAfterApproval(gate, decision),
        });
      }
    }
  });
});
