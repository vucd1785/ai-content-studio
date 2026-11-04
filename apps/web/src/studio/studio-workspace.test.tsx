import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi as vitest } from "vitest";
import { vi } from "@/i18n/vi";
import { installFakeApi, jsonResponse, NOW_ISO, PROJECT_ID } from "@/test/fake-api";
import { INSPECTOR_PANELS, inspectorPanelFor } from "./role-inspector";
import { studioLabels } from "./studio-labels";
import { AGENT_ROLES } from "./studio-model";
import { StudioWorkspace } from "./studio-workspace";
import type { StudioEventSource } from "./use-studio-run";

// Canvas thật cần WebGL. Bản giả render con của nó thành phần tử DOM để click được `<group name=...>`
// đúng như click avatar; React cảnh báo prop lạ của three nên tắt console.error trong file này.
vitest.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: ReactNode }) => (
    <div data-testid="fake-canvas">{children}</div>
  ),
  useFrame: () => undefined,
}));
vitest.mock("@react-three/drei", () => ({
  ContactShadows: () => null,
  Outlines: () => null,
  OrbitControls: () => null,
  OrthographicCamera: () => null,
}));

const RUN_ID = "00000000-0000-4000-8000-0000000000f1";
const ARTIFACT_ID = "00000000-0000-4000-8000-0000000000f2";
const APPROVAL_URL = `POST /api/workflow-runs/${RUN_ID}/approvals`;

/** Phương án script `2` tối giản (P6-17); script `1` đã xóa (ADR-013 bổ sung (2)). */
function script(title: string) {
  return {
    schemaVersion: 2,
    language: "vi",
    formatId: "story",
    formatVersion: 1,
    title,
    sources: [],
    scenes: [1, 2, 3].map((n) => ({
      id: `canh-${n}`,
      beat: "cold_open",
      sourceIds: [],
      lines: [{ id: `l${n}`, speaker: "ti", text: `${title} ${n}` }],
      shots: [{ id: `s${n}`, shotSize: "wide" }],
    })),
  };
}

function installServer() {
  return installFakeApi({
    [`GET /api/workflow-runs/${RUN_ID}`]: () =>
      jsonResponse(200, {
        workflowRun: {
          id: RUN_ID,
          projectId: PROJECT_ID,
          briefId: "00000000-0000-4000-8000-0000000000f3",
          status: "waiting_script_approval",
          resumeFrom: null,
          failureCode: null,
          createdAt: NOW_ISO,
          updatedAt: NOW_ISO,
        },
        agentRuns: [],
        approvals: [],
        artifacts: [{ id: ARTIFACT_ID, type: "script", version: 1, createdAt: NOW_ISO }],
      }),
    [`GET /api/artifacts/${ARTIFACT_ID}`]: () =>
      jsonResponse(200, {
        artifact: {
          id: ARTIFACT_ID,
          projectId: PROJECT_ID,
          workflowRunId: RUN_ID,
          type: "script",
          version: 1,
          schemaVersion: "2",
          contentHash: "c".repeat(64),
          metadata: {},
          createdAt: NOW_ISO,
        },
        content: { variants: [script("Alpha"), script("Beta")] },
      }),
    [APPROVAL_URL]: () =>
      jsonResponse(201, {
        approval: {
          id: "00000000-0000-4000-8000-0000000000f4",
          workflowRunId: RUN_ID,
          gate: "script",
          decision: "approved",
          artifactId: ARTIFACT_ID,
          variantIndex: 1,
          note: null,
          createdAt: NOW_ISO,
        },
        workflowRun: {
          id: RUN_ID,
          projectId: PROJECT_ID,
          briefId: "00000000-0000-4000-8000-0000000000f3",
          status: "producing_assets",
          resumeFrom: null,
          failureCode: null,
          createdAt: NOW_ISO,
          updatedAt: NOW_ISO,
        },
      }),
  });
}

/** Snapshot `agent_runs` đã lưu; stream giả không phát event. */
const studioDeps = {
  loadSnapshot: async () => ({ agentRuns: [{ role: "script", status: "waiting_approval" }] }),
  createEventSource: (): StudioEventSource => ({
    addEventListener: () => undefined,
    close: () => undefined,
  }),
};

async function renderWorkspace() {
  const result = render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <StudioWorkspace runId={RUN_ID} deps={studioDeps} />
    </QueryClientProvider>,
  );
  // Chờ snapshot vào store: trạng thái đã lưu hiện cạnh nút vai trò.
  await screen.findByText(studioLabels.statuses.waiting_approval);
  return result;
}

function avatar(container: HTMLElement, id: string) {
  const element = container.querySelector(`group[name="${id}"]`);
  if (element === null) {
    throw new Error(`không thấy avatar ${id}`);
  }
  return element;
}

beforeEach(() => {
  vitest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vitest.restoreAllMocks();
  vitest.unstubAllGlobals();
});

describe("inspector (P4-04)", () => {
  it("bảng ánh xạ chỉ trỏ tới panel có sẵn", () => {
    expect(INSPECTOR_PANELS).toEqual({ director: "scriptReview", script: "scriptReview" });
    for (const role of AGENT_ROLES.filter((r) => r !== "script")) {
      expect(inspectorPanelFor(role), role).toBeNull();
    }
  });

  it("click avatar kịch bản mở bảng duyệt kịch bản; avatar khác mở đúng vai trò của nó", async () => {
    installServer();
    const { container } = await renderWorkspace();
    expect(screen.getByText(studioLabels.inspectorHint)).toBeTruthy();

    act(() => {
      fireEvent.click(avatar(container, "script"));
    });
    expect(screen.getByTestId("inspector-script")).toBeTruthy();
    expect(
      await screen.findByRole("article", { name: `${vi.scriptReview.variant} 1` }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: studioLabels.roles.script }).getAttribute("aria-pressed"),
    ).toBe("true");

    act(() => {
      fireEvent.click(avatar(container, "research"));
    });
    expect(screen.getByTestId("inspector-research")).toBeTruthy();
    expect(screen.getByText(studioLabels.noPanel)).toBeTruthy();
    expect(screen.queryByText(vi.scriptReview.heading)).toBeNull();

    act(() => {
      fireEvent.click(avatar(container, "director"));
    });
    expect(screen.getByTestId("inspector-director")).toBeTruthy();
    expect(
      await screen.findByRole("article", { name: `${vi.scriptReview.variant} 2` }),
    ).toBeTruthy();
  });

  it("ẩn canvas không gỡ route duyệt: chọn bằng phím và duyệt bằng nút 2D", async () => {
    const api = installServer();
    await renderWorkspace();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: studioLabels.hideCanvas }));
    expect(screen.queryByTestId("studio-canvas")).toBeNull();
    expect(screen.queryByTestId("fake-canvas")).toBeNull();

    // Chỉ bàn phím: focus nút vai trò kịch bản rồi Enter.
    const scriptButton = screen.getByRole("button", {
      name: studioLabels.roles.script,
    });
    scriptButton.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("inspector-script")).toBeTruthy();

    const approve = await screen.findByRole("button", { name: vi.scriptReview.approveVariant1 });
    approve.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(api.callsTo(APPROVAL_URL)).toHaveLength(1));
    expect(JSON.parse(String(api.callsTo(APPROVAL_URL)[0]?.[1]?.body))).toEqual({
      gate: "script",
      decision: "approved",
      artifactId: ARTIFACT_ID,
      variantIndex: 1,
    });
  });

  it("ẩn rồi hiện canvas giữ nguyên lựa chọn và bảng đang mở", async () => {
    installServer();
    await renderWorkspace();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: studioLabels.roles.script }));
    await screen.findByRole("button", { name: vi.scriptReview.approveVariant1 });
    await user.click(screen.getByRole("button", { name: studioLabels.hideCanvas }));
    expect(screen.getByRole("button", { name: vi.scriptReview.approveVariant1 })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: studioLabels.showCanvas }));
    expect(screen.getByTestId("studio-canvas")).toBeTruthy();
    expect(screen.getByTestId("inspector-script")).toBeTruthy();
  });
});
