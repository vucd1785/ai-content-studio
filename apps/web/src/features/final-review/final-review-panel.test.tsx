import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi as vitest } from "vitest";
import { vi } from "@/i18n/vi";
import { apiError, installFakeApi, jsonResponse, NOW_ISO, PROJECT_ID } from "@/test/fake-api";
import { FinalReviewPanel } from "./final-review-panel";

const RAW_SOURCES = import.meta.glob<string>(["./*.ts", "./*.tsx", "!./*.test.tsx"], {
  query: "?raw",
  import: "default",
  eager: true,
});

const RUN_ID = "00000000-0000-4000-8000-0000000000e1";
const PREVIEW_1 = "00000000-0000-4000-8000-0000000000e2";
const PREVIEW_2 = "00000000-0000-4000-8000-0000000000e3";
const QA_ID = "00000000-0000-4000-8000-0000000000e4";
const EXPORT_ID = "00000000-0000-4000-8000-0000000000e5";

type Check = { code: string; severity: "error" | "warning"; message: string };
type Options = {
  status?: string;
  resumeFrom?: string | null;
  failureCode?: string | null;
  qa?: { previewArtifactId: string; checks: Check[] } | null;
  exported?: boolean;
  approvalResponse?: () => Response;
};

/**
 * Server giả có trạng thái: approval, cancel và resume đổi run; GET run trả lại như sau reload.
 * Preview mới nhất là bản 2.
 */
function statefulServer(options: Options = {}) {
  let status = options.status ?? "waiting_final_approval";
  let resumeFrom = options.resumeFrom ?? null;
  let failureCode = options.failureCode ?? null;
  const approvals: Record<string, unknown>[] = [];
  const bodies: Record<string, unknown>[] = [];
  const qa = options.qa === undefined ? { previewArtifactId: PREVIEW_2, checks: [] } : options.qa;
  const artifacts = [
    { id: PREVIEW_1, type: "preview", version: 1 },
    { id: PREVIEW_2, type: "preview", version: 2 },
    ...(qa === null ? [] : [{ id: QA_ID, type: "qa_report", version: 1 }]),
    ...(options.exported ? [{ id: EXPORT_ID, type: "export", version: 1 }] : []),
  ];
  const run = () => ({
    id: RUN_ID,
    projectId: PROJECT_ID,
    briefId: "00000000-0000-4000-8000-0000000000e6",
    status,
    resumeFrom,
    failureCode,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
  });
  const api = installFakeApi({
    [`GET /api/workflow-runs/${RUN_ID}`]: () =>
      jsonResponse(200, {
        workflowRun: run(),
        agentRuns: [],
        approvals,
        artifacts: artifacts.map((artifact) => ({ ...artifact, createdAt: NOW_ISO })),
      }),
    [`GET /api/artifacts/${QA_ID}`]: () =>
      jsonResponse(200, {
        artifact: {
          id: QA_ID,
          projectId: PROJECT_ID,
          workflowRunId: RUN_ID,
          type: "qa_report",
          version: 1,
          schemaVersion: "1",
          contentHash: "c".repeat(64),
          metadata: {},
          createdAt: NOW_ISO,
        },
        content:
          qa === null
            ? null
            : { schemaVersion: 1, passed: !qa.checks.some((c) => c.severity === "error"), ...qa },
      }),
    [`POST /api/workflow-runs/${RUN_ID}/approvals`]: (init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      bodies.push(body);
      if (options.approvalResponse !== undefined) {
        return options.approvalResponse();
      }
      const approval = {
        id: `00000000-0000-4000-8000-0000000001${String(approvals.length).padStart(2, "0")}`,
        workflowRunId: RUN_ID,
        gate: body.gate,
        decision: body.decision,
        artifactId: body.artifactId,
        variantIndex: null,
        note: body.note ?? null,
        createdAt: NOW_ISO,
      };
      approvals.push(approval);
      status =
        body.decision === "approved"
          ? "exporting"
          : body.decision === "changes_requested"
            ? "producing_assets"
            : status;
      return jsonResponse(201, { approval, workflowRun: run() });
    },
    [`POST /api/workflow-runs/${RUN_ID}/cancel`]: () => {
      status = "cancelled";
      resumeFrom = null;
      return jsonResponse(200, { workflowRun: run() });
    },
    [`POST /api/workflow-runs/${RUN_ID}/resume`]: () => {
      status = resumeFrom ?? status;
      resumeFrom = null;
      failureCode = null;
      return jsonResponse(200, { workflowRun: run() });
    },
  });
  return { api, bodies };
}

function renderPanel() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <FinalReviewPanel runId={RUN_ID} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vitest.unstubAllGlobals();
});

const approveButton = () =>
  screen.getByRole("button", { name: vi.finalReview.approve }) as HTMLButtonElement;

describe("cổng final (P2-10)", () => {
  it("phát preview mới nhất qua route media; QA đạt thì duyệt gửi đúng một decision cho đúng preview", async () => {
    const { api, bodies } = statefulServer();
    renderPanel();
    const user = userEvent.setup();
    expect((await screen.findByTestId("qa-status")).textContent).toBe(vi.finalReview.qaPassed);
    expect(screen.getByTestId("final-preview-video").getAttribute("src")).toBe(
      `/api/artifacts/${PREVIEW_2}/media`,
    );
    expect(screen.getByTestId("run-status").textContent).toBe(
      vi.runControl.statuses.waiting_final_approval,
    );
    await user.click(approveButton());
    await waitFor(() =>
      expect(screen.getByTestId("run-status").textContent).toBe(vi.runControl.statuses.exporting),
    );
    expect(bodies).toEqual([{ gate: "final", decision: "approved", artifactId: PREVIEW_2 }]);
    expect(api.callsTo(`POST /api/workflow-runs/${RUN_ID}/approvals`)).toHaveLength(1);
    // Đã rời cổng: form biến mất, decision đã lưu hiện từ server.
    expect(screen.queryByRole("button", { name: vi.finalReview.approve })).toBeNull();
    expect(screen.getByTestId("final-decision").textContent).toContain(
      vi.scriptReview.decisions.approved,
    );
    expect(screen.getByTestId("final-decision").textContent).toContain(
      `${vi.finalReview.preview} 2`,
    );
  });

  it("QA có lỗi: nút duyệt khóa, hiện từng lỗi; yêu cầu sửa cần ghi chú", async () => {
    const { bodies } = statefulServer({
      qa: {
        previewArtifactId: PREVIEW_2,
        checks: [{ code: "frame_size_mismatch", severity: "error", message: "720x1280" }],
      },
    });
    renderPanel();
    const user = userEvent.setup();
    expect((await screen.findByTestId("qa-status")).textContent).toBe(vi.finalReview.qaFailed);
    expect(screen.getByTestId("qa-check").textContent).toContain(
      vi.finalReview.checks.frame_size_mismatch,
    );
    expect(approveButton().disabled).toBe(true);
    expect(screen.getByText(vi.finalReview.approveLocked)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: vi.scriptReview.requestChanges }));
    expect((await screen.findByRole("alert")).textContent).toBe(vi.scriptReview.noteRequired);
    expect(bodies).toEqual([]);
    await user.type(screen.getByLabelText(vi.finalReview.noteLabel), "Sửa khung hình");
    await user.click(screen.getByRole("button", { name: vi.scriptReview.requestChanges }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      gate: "final",
      decision: "changes_requested",
      artifactId: PREVIEW_2,
      note: "Sửa khung hình",
    });
  });

  it("QA của bản preview cũ không tính cho bản mới: duyệt khóa", async () => {
    statefulServer({ qa: { previewArtifactId: PREVIEW_1, checks: [] } });
    renderPanel();
    expect((await screen.findByTestId("qa-status")).textContent).toBe(vi.finalReview.qaMissing);
    expect(approveButton().disabled).toBe(true);
  });

  it("server chặn duyệt (409 conflict): báo QA chưa đạt, không tự đổi trạng thái", async () => {
    statefulServer({ approvalResponse: () => apiError(409, "conflict") });
    renderPanel();
    const user = userEvent.setup();
    await screen.findByTestId("qa-status");
    await user.click(approveButton());
    expect((await screen.findByRole("alert")).textContent).toBe(vi.finalReview.qaBlocked);
    expect(screen.getByTestId("run-status").textContent).toBe(
      vi.runControl.statuses.waiting_final_approval,
    );
  });

  it("hủy cần xác nhận lần hai; hủy xong không còn nút hủy và không gửi approval", async () => {
    const { api } = statefulServer();
    renderPanel();
    const user = userEvent.setup();
    await screen.findByTestId("qa-status");
    await user.click(screen.getByRole("button", { name: vi.runControl.cancel }));
    expect(api.callsTo(`POST /api/workflow-runs/${RUN_ID}/cancel`)).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: vi.runControl.keepRunning }));
    await user.click(screen.getByRole("button", { name: vi.runControl.cancel }));
    await user.click(screen.getByRole("button", { name: vi.runControl.confirmCancel }));
    await waitFor(() =>
      expect(screen.getByTestId("run-status").textContent).toBe(vi.runControl.statuses.cancelled),
    );
    expect(api.callsTo(`POST /api/workflow-runs/${RUN_ID}/cancel`)).toHaveLength(1);
    expect(api.callsTo(`POST /api/workflow-runs/${RUN_ID}/approvals`)).toHaveLength(0);
    expect(screen.queryByRole("button", { name: vi.runControl.cancel })).toBeNull();
    expect(screen.queryByRole("button", { name: vi.finalReview.approve })).toBeNull();
  });

  it("run lỗi có resume_from: hiện bước và mã lỗi, bấm chạy lại gửi resume", async () => {
    const { api } = statefulServer({
      status: "failed",
      resumeFrom: "preview_rendering",
      failureCode: "render_interrupted",
    });
    renderPanel();
    const user = userEvent.setup();
    const status = await screen.findByText(/render_interrupted/);
    expect(status.textContent).toContain(vi.runControl.statuses.preview_rendering);
    await user.click(screen.getByRole("button", { name: vi.runControl.resume }));
    await waitFor(() =>
      expect(screen.getByTestId("run-status").textContent).toBe(
        vi.runControl.statuses.preview_rendering,
      ),
    );
    expect(api.callsTo(`POST /api/workflow-runs/${RUN_ID}/resume`)).toHaveLength(1);
    expect(screen.queryByRole("button", { name: vi.runControl.resume })).toBeNull();
  });

  it("đã xuất: có link tải bản xuất qua route media, không còn nút hủy", async () => {
    statefulServer({ status: "exported", exported: true });
    renderPanel();
    const link = await screen.findByTestId("export-link");
    expect(link.getAttribute("href")).toBe(`/api/artifacts/${EXPORT_ID}/media`);
    expect(screen.queryByRole("button", { name: vi.runControl.cancel })).toBeNull();
  });

  it("nguồn không tự gửi decision: approval chỉ đi qua nút, không có giá trị mặc định", () => {
    for (const [file, source] of Object.entries(RAW_SOURCES)) {
      expect(source, file).not.toMatch(/decision: "approved"/);
      expect(source, file).not.toMatch(/useEffect/);
    }
  });
});
