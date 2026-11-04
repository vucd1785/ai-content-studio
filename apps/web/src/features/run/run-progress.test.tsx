import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { vi } from "@/i18n/vi";
import { RunProgress } from "./run-progress";

const NOW = Date.parse("2026-11-01T15:10:00Z");

function run(status: string, agentRuns: unknown[], extra: Record<string, unknown> = {}) {
  return {
    workflowRun: {
      id: "00000000-0000-4000-8000-0000000000c1",
      projectId: "00000000-0000-4000-8000-0000000000c2",
      briefId: "00000000-0000-4000-8000-0000000000c3",
      status,
      resumeFrom: null,
      failureCode: null,
      failureMessage: null,
      llmModel: null,
      createdAt: "2026-11-01T15:00:00Z",
      updatedAt: "2026-11-01T15:00:00Z",
      ...extra,
    },
    agentRuns,
    approvals: [],
    artifacts: [],
  } as Parameters<typeof RunProgress>[0]["run"];
}

afterEach(cleanup);

describe("thanh tiến trình (P3-17)", () => {
  it("bước giọng đọc hiện phần trăm thật, cảnh và pha đang làm, và ghi chú không giới hạn thời gian", () => {
    render(
      <RunProgress
        now={NOW}
        durationSec={30}
        run={run("producing_assets", [
          {
            id: "00000000-0000-4000-8000-0000000000d1",
            role: "voice",
            status: "running",
            startedAt: "2026-11-01T15:05:00Z",
            finishedAt: null,
            errorCode: null,
            errorMessage: null,
            progress: {
              done: 5,
              total: 8,
              unit: "scene_step",
              sceneIndex: 3,
              sceneCount: 4,
              phase: "synthesize",
            },
          },
        ])}
      />,
    );
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("62");
    expect(screen.getByTestId("progress-assets").textContent).toContain(
      `62% · ${vi.runSteps.sceneOf} 3/4 · ${vi.runSteps.phases.align}`,
    );
    expect(screen.getByText(vi.runSteps.noLimit)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("bước lỗi hiện mô tả tiếng Việt, mã lỗi, chi tiết và gợi ý kiểm tra TTS", () => {
    render(
      <RunProgress
        now={NOW}
        durationSec={30}
        run={run(
          "failed",
          [
            {
              id: "00000000-0000-4000-8000-0000000000d1",
              role: "voice",
              status: "failed",
              startedAt: "2026-11-01T15:05:00Z",
              finishedAt: "2026-11-01T15:09:00Z",
              errorCode: "alignment_failed",
              errorMessage: "Scene s2: TTS align lỗi 503: ALIGNMENT_FAILED: name resolution",
              progress: null,
            },
          ],
          { resumeFrom: "producing_assets", failureCode: "alignment_failed" },
        )}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(vi.runSteps.errors.alignment_failed);
    expect(alert.textContent).toContain(
      "Scene s2: TTS align lỗi 503: ALIGNMENT_FAILED: name resolution",
    );
    expect(alert.textContent).toContain(vi.runSteps.errorHints.tts);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("P6-15: hết hạn mức gói Claude ở bước kịch bản hiện mô tả và gợi ý Claude Code, không gợi ý TTS", () => {
    render(
      <RunProgress
        now={NOW}
        durationSec={30}
        run={run(
          "failed",
          [
            {
              id: "00000000-0000-4000-8000-0000000000d2",
              role: "script",
              status: "failed",
              startedAt: "2026-11-01T15:05:00Z",
              finishedAt: "2026-11-01T15:06:00Z",
              errorCode: "quota_exhausted",
              errorMessage: "Hết hạn mức gói Claude; tiếp tục sau khi hạn mức reset. usage limit reached",
              progress: null,
            },
          ],
          { resumeFrom: "scripting", failureCode: "quota_exhausted" },
        )}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(vi.runSteps.errors.quota_exhausted);
    expect(alert.textContent).toContain(vi.runSteps.errorHints.claudeCode);
    expect(alert.textContent).not.toContain(vi.runSteps.errorHints.tts);
  });
});
