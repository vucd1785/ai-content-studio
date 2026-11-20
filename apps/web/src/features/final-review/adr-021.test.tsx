import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi as vitest } from "vitest";
import { BrandContactForm } from "@/features/brand/brand-contact";
import { LibraryPage } from "@/features/library/library-page";
import { vi } from "@/i18n/vi";
import { installFakeApi, jsonResponse, NOW_ISO, PROJECT_ID } from "@/test/fake-api";
import { FinalReviewPanel } from "./final-review-panel";
import { RedoPanel, sceneLabels } from "./redo-panel";

/** ADR-021: tên kênh trước lần xuất, làm lại một phần ở Cổng 2, kho "dùng trong video nào". */
const RUN_ID = "00000000-0000-4000-8000-0000000002a1";
const PREVIEW = "00000000-0000-4000-8000-0000000002a2";
const QA = "00000000-0000-4000-8000-0000000002a3";
const PROPS = "00000000-0000-4000-8000-0000000002a4";
const BRAND = "00000000-0000-4000-8000-0000000002a5";

const wrap = (node: ReactNode) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {node}
    </QueryClientProvider>,
  );

const artifactBody = (id: string, type: string, content: unknown, metadata = {}) =>
  jsonResponse(200, {
    artifact: {
      id,
      projectId: PROJECT_ID,
      workflowRunId: RUN_ID,
      type,
      version: 1,
      schemaVersion: "1",
      contentHash: "c".repeat(64),
      metadata,
      createdAt: NOW_ISO,
    },
    content,
  });

const renderProps = {
  scenes: [
    { sceneId: "mo-dau", fromMs: 0, durationMs: 2000 },
    { sceneId: "giai-thich", fromMs: 2000, durationMs: 3000 },
  ],
  captions: [
    { text: "Sao biển mặn?", startMs: 100 },
    { text: "Vì muối từ đá.", startMs: 2100 },
  ],
  shots: [{ sceneId: "mo-dau", background: "bg_room", props: ["prop_muoi_ab12"], actors: [] }],
  cards: { outro: { channel: null } },
};

const asset = (assetId: string, kind: string, tags: string[] = []) => ({
  assetId,
  kind,
  version: "0.1.0",
  tags,
  createdBy: "claude-code",
  status: "approved",
  hasPreview: false,
});

function serverWith(displayName: string) {
  const redoBodies: unknown[] = [];
  const api = installFakeApi({
    [`GET /api/workflow-runs/${RUN_ID}`]: () =>
      jsonResponse(200, {
        workflowRun: {
          id: RUN_ID,
          projectId: PROJECT_ID,
          briefId: "00000000-0000-4000-8000-0000000002a6",
          status: "waiting_final_approval",
          resumeFrom: null,
          failureCode: null,
          createdAt: NOW_ISO,
          updatedAt: NOW_ISO,
        },
        agentRuns: [],
        approvals: [],
        artifacts: [
          { id: PREVIEW, type: "preview", version: 1, createdAt: NOW_ISO },
          { id: QA, type: "qa_report", version: 1, createdAt: NOW_ISO },
          { id: PROPS, type: "render_props", version: 1, createdAt: NOW_ISO },
        ],
      }),
    [`GET /api/artifacts/${QA}`]: () =>
      artifactBody(QA, "qa_report", {
        schemaVersion: 1,
        previewArtifactId: PREVIEW,
        passed: true,
        checks: [],
      }),
    [`GET /api/artifacts/${PROPS}`]: () => artifactBody(PROPS, "render_props", renderProps),
    "GET /api/brand-profile/contact": () =>
      jsonResponse(200, { brandProfileId: BRAND, displayName, copyrightContact: null }),
    "GET /api/motion-assets": () =>
      jsonResponse(200, {
        assets: [
          asset("bg_room", "background", ["phòng"]),
          asset("bg_bien_cd34", "background", ["bãi biển"]),
          asset("prop_muoi_ab12", "prop", ["hạt muối"]),
          asset("action_idle", "action"),
        ],
      }),
    [`POST /api/workflow-runs/${RUN_ID}/redo`]: (init) => {
      redoBodies.push(JSON.parse(String(init?.body)));
      return jsonResponse(202, {
        redoId: "00000000-0000-4000-8000-0000000002a7",
        status: "preview_rendering",
      });
    },
  });
  return { api, redoBodies };
}

afterEach(() => {
  cleanup();
  vitest.unstubAllGlobals();
});

describe("tên kênh trước lần xuất (ADR-021)", () => {
  it("kênh chưa đặt tên: khóa nút duyệt, có link sang Bộ nhận diện kênh", async () => {
    serverWith("Kênh mặc định");
    wrap(<FinalReviewPanel runId={RUN_ID} />);
    expect(await screen.findByTestId("channel-missing")).toBeTruthy();
    const approve = screen.getByRole("button", {
      name: vi.finalReview.approve,
    }) as HTMLButtonElement;
    expect(approve.disabled).toBe(true);
    expect(
      screen.getByRole("link", { name: vi.finalReview.channelMissingAction }).getAttribute("href"),
    ).toBe("#/brand");
  });

  it("form kênh: chặn tên seed, gửi tên kênh cùng liên hệ", async () => {
    const puts: unknown[] = [];
    installFakeApi({
      "GET /api/brand-profile/contact": () =>
        jsonResponse(200, {
          brandProfileId: BRAND,
          displayName: "Kênh mặc định",
          copyrightContact: null,
        }),
      "PUT /api/brand-profile/contact": (init) => {
        const body = JSON.parse(String(init?.body)) as { displayName: string };
        puts.push(body);
        return jsonResponse(200, {
          brandProfileId: BRAND,
          displayName: body.displayName,
          copyrightContact: null,
        });
      },
    });
    const user = userEvent.setup();
    wrap(<BrandContactForm />);
    expect(await screen.findByText(vi.brand.contact.nameMissing)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: vi.brand.contact.save }));
    expect(await screen.findByText(vi.brand.contact.nameRequired)).toBeTruthy();
    expect(puts).toEqual([]);
    await user.type(screen.getByLabelText(vi.brand.contact.nameLabel), "Tí Bit Khám Phá");
    await user.click(screen.getByRole("button", { name: vi.brand.contact.save }));
    await waitFor(() =>
      expect(puts).toEqual([{ copyrightContact: "", displayName: "Tí Bit Khám Phá" }]),
    );
  });
});

describe("làm lại một phần (ADR-021)", () => {
  it("nhãn cảnh có số thứ tự và lời đầu cảnh", () => {
    expect(sceneLabels(renderProps).map((s) => s.label)).toEqual([
      "Cảnh 1: Sao biển mặn?",
      "Cảnh 2: Vì muối từ đá.",
    ]);
  });

  it("đọc lại, đổi nền, tạo lại hình, dựng lại: mỗi nút gửi đúng một yêu cầu", async () => {
    const { redoBodies } = serverWith("Tí Bit");
    const user = userEvent.setup();
    wrap(<RedoPanel runId={RUN_ID} renderPropsId={PROPS} />);
    await user.click(await screen.findByText(vi.finalReview.redo.heading));
    const sceneSelect = await screen.findByLabelText(vi.finalReview.redo.sceneLabel);
    await user.selectOptions(sceneSelect, "giai-thich");
    await user.click(screen.getByRole("button", { name: vi.finalReview.redo.revoice }));
    await waitFor(() => expect(redoBodies).toHaveLength(1));

    await user.selectOptions(
      screen.getByLabelText(vi.finalReview.redo.backgroundLabel),
      "bg_bien_cd34",
    );
    await user.click(screen.getByRole("button", { name: vi.finalReview.redo.background }));
    await waitFor(() => expect(redoBodies).toHaveLength(2));

    // Chỉ đồ vật, bối cảnh có trong video mới tạo lại được; hành động không có trong danh sách.
    const assetSelect = screen.getByLabelText(vi.finalReview.redo.assetLabel);
    const options = [...(assetSelect as HTMLSelectElement).options].map((o) => o.value);
    expect(options).toEqual(["", "bg_room", "prop_muoi_ab12"]);
    const regenerate = screen.getByRole("button", { name: vi.finalReview.redo.regenerate });
    await user.selectOptions(assetSelect, "prop_muoi_ab12");
    expect((regenerate as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText(vi.finalReview.redo.noteLabel), "to hơn");
    await user.click(regenerate);
    await waitFor(() => expect(redoBodies).toHaveLength(3));

    await user.click(screen.getByRole("button", { name: vi.finalReview.redo.rerender }));
    await waitFor(() => expect(redoBodies).toHaveLength(4));
    expect(redoBodies).toEqual([
      { kind: "revoice", sceneId: "giai-thich" },
      { kind: "background", sceneId: "giai-thich", backgroundId: "bg_bien_cd34" },
      { kind: "regenerate_asset", assetId: "prop_muoi_ab12", note: "to hơn" },
      { kind: "rerender" },
    ]);
    // Video dựng khi kênh chưa có tên, nay kênh đã có tên: gợi ý dựng lại.
    expect(screen.getByText(vi.finalReview.channelMissingRerender)).toBeTruthy();
  });
});

describe("kho: dùng trong video nào (ADR-021)", () => {
  it("lọc theo video và chưa dùng; thẻ ghi số video", async () => {
    installFakeApi({
      "GET /api/motion-assets": () =>
        jsonResponse(200, {
          assets: [asset("bg_room", "background"), asset("prop_muoi_ab12", "prop")],
        }),
      "GET /api/motion-assets/usage": () =>
        jsonResponse(200, {
          videos: [
            {
              projectId: PROJECT_ID,
              projectName: "Vì sao biển mặn",
              workflowRunId: RUN_ID,
              exported: true,
            },
          ],
          usage: { bg_room: [0] },
        }),
    });
    const user = userEvent.setup();
    wrap(<LibraryPage />);
    const filter = await screen.findByLabelText(vi.library.usageFilter);
    expect(screen.getAllByTestId("asset-usage").map((n) => n.textContent)).toEqual([
      vi.library.usedInCount(1),
      vi.library.notUsed,
    ]);
    await user.selectOptions(filter, "0");
    expect(screen.getByText("bg_room")).toBeTruthy();
    expect(screen.queryByText("prop_muoi_ab12")).toBeNull();
    await user.selectOptions(filter, "unused");
    expect(screen.queryByText("bg_room")).toBeNull();
    expect(screen.getByText("prop_muoi_ab12")).toBeTruthy();
  });
});
