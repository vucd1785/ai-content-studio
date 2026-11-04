import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi as vitest } from "vitest";
import { vi } from "@/i18n/vi";
import { apiError, installFakeApi, jsonResponse, NOW_ISO, PROJECT_ID } from "@/test/fake-api";
import { ScriptReviewPanel } from "./script-review-panel";

const RAW_SOURCES = import.meta.glob<string>(["./*.ts", "./*.tsx", "!./*.test.tsx"], {
  query: "?raw",
  import: "default",
  eager: true,
});

const RUN_ID = "00000000-0000-4000-8000-0000000000d1";
const ARTIFACT_ID = "00000000-0000-4000-8000-0000000000d2";
const RUN_URL = `GET /api/workflow-runs/${RUN_ID}`;
const ARTIFACT_URL = `GET /api/artifacts/${ARTIFACT_ID}`;
const APPROVAL_URL = `POST /api/workflow-runs/${RUN_ID}/approvals`;

/** Phương án script `2` tối giản: hai cảnh, câu theo người nói (P6-17). */
function script(title: string) {
  return {
    schemaVersion: 2,
    language: "vi",
    formatId: "story",
    formatVersion: 1,
    title,
    sources: [{ id: "src-1", title: "Redis docs", url: "https://redis.io/docs/" }],
    scenes: [
      {
        id: "mo-dau",
        beat: "cold_open",
        sourceIds: [],
        lines: [{ id: "l1", speaker: "ti", text: `Lời ${title} 1` }],
        shots: [{ id: "s1", shotSize: "wide" }],
      },
      {
        id: "su-that",
        beat: "fact",
        sourceIds: ["src-1"],
        lines: [{ id: "l2", speaker: "bit", text: `Lời ${title} 2` }],
        shots: [{ id: "s2", shotSize: "medium" }],
      },
    ],
  };
}

type Approval = { id: string; decision: string; variantIndex: number | null; note: string | null };

/** Server giả có trạng thái: POST approval lưu decision, GET run trả lại (mô phỏng reload). */
function statefulServer(
  status = "waiting_script_approval",
  extra: Parameters<typeof installFakeApi>[0] = {},
) {
  const approvals: Approval[] = [];
  const bodies: unknown[] = [];
  const runBody = () => ({
    workflowRun: {
      id: RUN_ID,
      projectId: PROJECT_ID,
      briefId: "00000000-0000-4000-8000-0000000000d3",
      status,
      resumeFrom: null,
      failureCode: null,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
    },
    agentRuns: [],
    approvals: approvals.map((a) => ({
      ...a,
      workflowRunId: RUN_ID,
      gate: "script",
      artifactId: ARTIFACT_ID,
      createdAt: NOW_ISO,
    })),
    artifacts: [{ id: ARTIFACT_ID, type: "script", version: 2, createdAt: NOW_ISO }],
  });
  const api = installFakeApi({
    ...extra,
    [RUN_URL]: () => jsonResponse(200, runBody()),
    [ARTIFACT_URL]: () =>
      jsonResponse(200, {
        artifact: {
          id: ARTIFACT_ID,
          projectId: PROJECT_ID,
          workflowRunId: RUN_ID,
          type: "script",
          version: 2,
          schemaVersion: "2",
          contentHash: "c".repeat(64),
          metadata: {},
          createdAt: NOW_ISO,
        },
        content: { variants: [script("Alpha"), script("Beta")] },
      }),
    [APPROVAL_URL]: (init) => {
      const body = JSON.parse(String(init?.body)) as {
        decision: string;
        note?: string;
        variantIndex?: number;
      };
      bodies.push(body);
      const approval = {
        id: `00000000-0000-4000-8000-00000000e00${approvals.length}`,
        decision: body.decision,
        variantIndex: body.variantIndex ?? null,
        note: body.note ?? null,
      };
      approvals.push(approval);
      status =
        body.decision === "rejected"
          ? status
          : body.decision === "approved"
            ? "producing_assets"
            : "scripting";
      const { workflowRun } = runBody();
      return jsonResponse(201, {
        approval: {
          ...approval,
          workflowRunId: RUN_ID,
          gate: "script",
          artifactId: ARTIFACT_ID,
          createdAt: NOW_ISO,
        },
        workflowRun,
      });
    },
  });
  return { ...api, bodies };
}

function renderPanel() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ScriptReviewPanel runId={RUN_ID} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vitest.unstubAllGlobals();
});

describe("so sánh kịch bản (P2-07)", () => {
  it("hiện hai phương án cạnh nhau từ artifact script mới nhất", async () => {
    statefulServer();
    renderPanel();
    expect(
      (await screen.findByRole("article", { name: `${vi.scriptReview.variant} 1` })).textContent,
    ).toContain("Alpha");
    expect(
      screen.getByRole("article", { name: `${vi.scriptReview.variant} 2` }).textContent,
    ).toContain("Beta");
    expect(screen.getByText("Lời Beta 2")).toBeTruthy();
    expect(screen.getByText(`${vi.scriptReview.version} 2`)).toBeTruthy();
  });

  it("yêu cầu sửa và từ chối bắt buộc note: không gửi request khi note rỗng", async () => {
    const api = statefulServer();
    renderPanel();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: vi.scriptReview.requestChanges }));
    expect((await screen.findByRole("alert")).textContent).toContain(vi.scriptReview.noteRequired);
    await user.type(screen.getByLabelText(vi.scriptReview.noteLabel), "   ");
    await user.click(screen.getByRole("button", { name: vi.scriptReview.reject }));
    expect(screen.getByRole("alert").textContent).toContain(vi.scriptReview.noteRequired);
    expect(api.callsTo(APPROVAL_URL)).toHaveLength(0);
  });

  it("yêu cầu sửa gửi đúng body; sau reload vẫn thấy decision đã lưu và form đóng", async () => {
    const api = statefulServer();
    const first = renderPanel();
    const user = userEvent.setup();
    await user.type(
      await screen.findByLabelText(vi.scriptReview.noteLabel),
      "Dùng phương án 1, rút ngắn cảnh 2",
    );
    await user.click(screen.getByRole("button", { name: vi.scriptReview.requestChanges }));
    await waitFor(() => expect(api.bodies).toHaveLength(1));
    expect(api.bodies[0]).toEqual({
      gate: "script",
      decision: "changes_requested",
      artifactId: ARTIFACT_ID,
      note: "Dùng phương án 1, rút ngắn cảnh 2",
    });
    // Run sang `scripting`: form ẩn, decision hiện từ dữ liệu server.
    expect((await screen.findByTestId("saved-decision")).textContent).toContain(
      `${vi.scriptReview.decisions.changes_requested}: Dùng phương án 1, rút ngắn cảnh 2`,
    );
    expect(screen.queryByRole("button", { name: vi.scriptReview.approveVariant1 })).toBeNull();

    // Reload: QueryClient mới, không còn cache; decision vẫn ở đó vì đọc từ server.
    first.unmount();
    renderPanel();
    expect((await screen.findByTestId("saved-decision")).textContent).toContain(
      vi.scriptReview.decisions.changes_requested,
    );
    expect(api.callsTo(APPROVAL_URL)).toHaveLength(1);
  });

  it("duyệt gửi approved kèm phương án, không cần note; không có nút duyệt hàng loạt", async () => {
    const api = statefulServer();
    renderPanel();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: vi.scriptReview.approveVariant2 }));
    await waitFor(() =>
      expect(api.bodies).toEqual([
        { gate: "script", decision: "approved", artifactId: ARTIFACT_ID, variantIndex: 2 },
      ]),
    );
    expect((await screen.findByTestId("saved-decision")).textContent).toBe(
      `${vi.scriptReview.approvedVariant} 2`,
    );
    // Bốn nút decision lúc chờ duyệt (cộng hai nút sửa phương án của P2-12, không gửi decision);
    // không có "chấp nhận tất cả" hay tự gửi khi render.
    cleanup();
    const fresh = statefulServer();
    renderPanel();
    await screen.findByRole("button", { name: vi.scriptReview.approveVariant1 });
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      vi.scriptReview.reject,
      vi.scriptReview.requestChanges,
      vi.scriptReview.approveVariant1,
      vi.scriptReview.approveVariant2,
    ]);
    expect(fresh.callsTo(APPROVAL_URL)).toHaveLength(0);
    for (const [file, source] of Object.entries(RAW_SOURCES)) {
      expect(source, file).not.toMatch(/tất cả|approveAll|accept all/i);
    }
  });

  it("run không ở cổng script: không có nút; server trả invalid_transition thì báo tiếng Việt", async () => {
    statefulServer("scripting");
    renderPanel();
    await screen.findByRole("article", { name: `${vi.scriptReview.variant} 1` });
    expect(screen.queryByRole("button")).toBeNull();

    cleanup();
    const api = statefulServer();
    api.fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const key = `${init?.method ?? "GET"} ${String(input)}`;
      if (key === APPROVAL_URL) {
        return apiError(409, "invalid_transition");
      }
      return key === ARTIFACT_URL
        ? jsonResponse(200, {
            artifact: {
              id: ARTIFACT_ID,
              projectId: PROJECT_ID,
              workflowRunId: RUN_ID,
              type: "script",
              version: 2,
              schemaVersion: "2",
              contentHash: "c".repeat(64),
              metadata: {},
              createdAt: NOW_ISO,
            },
            content: { variants: [script("Alpha"), script("Beta")] },
          })
        : jsonResponse(200, {
            workflowRun: {
              id: RUN_ID,
              projectId: PROJECT_ID,
              briefId: "00000000-0000-4000-8000-0000000000d3",
              status: "waiting_script_approval",
              resumeFrom: null,
              failureCode: null,
              createdAt: NOW_ISO,
              updatedAt: NOW_ISO,
            },
            agentRuns: [],
            approvals: [],
            artifacts: [{ id: ARTIFACT_ID, type: "script", version: 2, createdAt: NOW_ISO }],
          });
    });
    renderPanel();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: vi.scriptReview.approveVariant1 }));
    expect((await screen.findByRole("alert")).textContent).toContain(vi.scriptReview.notWaiting);
    expect(screen.queryByText("SERVER_RAW_MESSAGE")).toBeNull();
  });

  it("không có artifact script: báo chưa có kịch bản, không gọi route artifact", async () => {
    const api = installFakeApi({
      [RUN_URL]: () =>
        jsonResponse(200, {
          workflowRun: {
            id: RUN_ID,
            projectId: PROJECT_ID,
            briefId: "00000000-0000-4000-8000-0000000000d3",
            status: "research_ready",
            resumeFrom: null,
            failureCode: null,
            createdAt: NOW_ISO,
            updatedAt: NOW_ISO,
          },
          agentRuns: [],
          approvals: [],
          artifacts: [],
        }),
    });
    renderPanel();
    expect(await screen.findByText(vi.scriptReview.noScript)).toBeTruthy();
    expect(
      api.fetchMock.mock.calls.some(([url]) => String(url).startsWith("/api/artifacts/")),
    ).toBe(false);
  });
});
