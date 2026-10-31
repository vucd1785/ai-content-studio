import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi as vitest } from "vitest";
import { vi } from "@/i18n/vi";
import { apiError, installFakeApi, jsonResponse, NOW_ISO, PROJECT_ID } from "@/test/fake-api";
import { StartRunButton } from "./start-run";

const START = `POST /api/projects/${PROJECT_ID}/workflow-runs`;

function renderButton(props: { hasBrief: boolean; latestStatus: string | null }) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <StartRunButton projectId={PROJECT_ID} {...props} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vitest.unstubAllGlobals();
});

describe("bắt đầu lượt chạy (quyết định 5)", () => {
  it("ẩn khi chưa có brief hoặc run mới nhất chưa dừng", () => {
    installFakeApi();
    renderButton({ hasBrief: false, latestStatus: null });
    expect(screen.queryByRole("button")).toBeNull();
    cleanup();
    renderButton({ hasBrief: true, latestStatus: "waiting_script_approval" });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("có brief, chưa có run: bấm gửi đúng một POST, không kèm body", async () => {
    const api = installFakeApi({
      [START]: () =>
        jsonResponse(201, {
          workflowRun: {
            id: "00000000-0000-4000-8000-0000000000f1",
            projectId: PROJECT_ID,
            briefId: "00000000-0000-4000-8000-0000000000f2",
            status: "idea_submitted",
            resumeFrom: null,
            failureCode: null,
            createdAt: NOW_ISO,
            updatedAt: NOW_ISO,
          },
        }),
    });
    renderButton({ hasBrief: true, latestStatus: null });
    await userEvent.setup().click(screen.getByRole("button", { name: vi.startRun.start }));
    await waitFor(() => expect(api.callsTo(START)).toHaveLength(1));
    expect(api.callsTo(START)[0]?.[1]?.body).toBeUndefined();
  });

  it("run trước đã hủy: nhãn bắt đầu run mới; server từ chối thì báo lỗi tiếng Việt", async () => {
    installFakeApi({ [START]: () => apiError(409, "conflict") });
    renderButton({ hasBrief: true, latestStatus: "cancelled" });
    await userEvent.setup().click(screen.getByRole("button", { name: vi.startRun.startNew }));
    expect((await screen.findByRole("alert")).textContent).toBe(vi.startRun.conflict);
  });
});
