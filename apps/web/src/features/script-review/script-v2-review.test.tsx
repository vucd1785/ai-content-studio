import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi as vitest } from "vitest";
import { vi } from "@/i18n/vi";
import { installFakeApi, jsonResponse, NOW_ISO, PROJECT_ID } from "@/test/fake-api";
import { ScriptReviewPanel } from "./script-review-panel";

const RUN_ID = "00000000-0000-4000-8000-0000000000f1";
const SCRIPT_ID = "00000000-0000-4000-8000-0000000000f2";
const BOARD_ID = "00000000-0000-4000-8000-0000000000f3";
const APPROVAL_URL = `POST /api/workflow-runs/${RUN_ID}/approvals`;

function variant(title: string) {
  return {
    schemaVersion: 2,
    language: "vi",
    formatId: "what_if",
    formatVersion: 1,
    title,
    sources: [{ id: "src1", title: "Nghiên cứu thiếu ngủ" }],
    scenes: [
      {
        id: "mo-dau",
        beat: "cold_open",
        sourceIds: [],
        lines: [
          { id: "l1", speaker: "ti", text: "Bit ơi, ba giờ sáng rồi!" },
          { id: "l2", speaker: "bit", text: "Mắt cậu đỏ kìa." },
        ],
        shots: [{ id: "s1", shotSize: "wide" }],
      },
      {
        id: "su-that",
        beat: "fact",
        sourceIds: ["src1"],
        lines: [{ id: "l3", speaker: "bit", text: "Thức 24 giờ như say rượu." }],
        shots: [{ id: "s2", shotSize: "medium" }],
      },
    ],
  };
}

function server(status: string) {
  const bodies: unknown[] = [];
  const artifact = (id: string, type: string, schemaVersion: string) => ({
    id,
    projectId: PROJECT_ID,
    workflowRunId: RUN_ID,
    type,
    version: 1,
    schemaVersion,
    contentHash: "c".repeat(64),
    metadata: {},
    createdAt: NOW_ISO,
  });
  installFakeApi({
    [`GET /api/workflow-runs/${RUN_ID}`]: () =>
      jsonResponse(200, {
        workflowRun: {
          id: RUN_ID,
          projectId: PROJECT_ID,
          briefId: "00000000-0000-4000-8000-0000000000f4",
          status,
          resumeFrom: null,
          failureCode: null,
          createdAt: NOW_ISO,
          updatedAt: NOW_ISO,
        },
        agentRuns: [],
        approvals: [],
        artifacts: [
          { id: SCRIPT_ID, type: "script", version: 1, createdAt: NOW_ISO },
          ...(status === "storyboarding"
            ? []
            : [{ id: BOARD_ID, type: "storyboard", version: 1, createdAt: NOW_ISO }]),
        ],
      }),
    [`GET /api/artifacts/${SCRIPT_ID}`]: () =>
      jsonResponse(200, {
        artifact: artifact(SCRIPT_ID, "script", "2"),
        content: { variants: [variant("Phương án A"), variant("Phương án B")] },
      }),
    [`GET /api/artifacts/${BOARD_ID}`]: () =>
      jsonResponse(200, {
        artifact: artifact(BOARD_ID, "storyboard", "2"),
        content: {
          schemaVersion: 2,
          scriptArtifactId: SCRIPT_ID,
          variants: [1, 2].map((variantIndex) => ({
            variantIndex,
            scenes: [
              {
                sceneId: "mo-dau",
                shotId: "s1",
                stillKey: "x.png",
                issues: [],
                extraStills: [{ shotId: "s3", stillKey: "x3.png" }],
              },
              {
                sceneId: "su-that",
                shotId: "s2",
                stillKey: "y.png",
                issues: [
                  { code: "storyboard_unsafe_area", message: "Đầu của ti bị mép khung cắt" },
                ],
              },
            ],
          })),
          errors: [],
        },
      }),
    [`GET /api/workflow-runs/${RUN_ID}/asset-requests`]: () =>
      jsonResponse(200, {
        requests: [
          {
            id: "00000000-0000-4000-8000-0000000000f6",
            scriptArtifactId: SCRIPT_ID,
            variantIndex: 1,
            requestKey: "r1",
            kind: "prop",
            description: "Chiếc giường ngủ có gối và chăn",
            sceneIds: ["mo-dau"],
            fallbackAssetId: "prop_laptop",
            status: "fulfilled",
            asset: {
              assetId: "prop_giuong",
              kind: "prop",
              version: "0.1.0",
              tags: ["giường"],
              createdBy: "claude-code",
              status: "candidate",
              hasPreview: true,
            },
          },
          {
            id: "00000000-0000-4000-8000-0000000000f7",
            scriptArtifactId: SCRIPT_ID,
            variantIndex: 2,
            requestKey: "r1",
            kind: "action",
            description: "Ngáp dài",
            sceneIds: ["su-that"],
            fallbackAssetId: "action_talk",
            status: "open",
            asset: null,
          },
        ],
      }),
    [APPROVAL_URL]: (init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return jsonResponse(201, {
        approval: {
          id: "00000000-0000-4000-8000-0000000000f5",
          workflowRunId: RUN_ID,
          gate: "script",
          decision: "approved",
          artifactId: SCRIPT_ID,
          variantIndex: 1,
          note: null,
          createdAt: NOW_ISO,
        },
        workflowRun: {
          id: RUN_ID,
          projectId: PROJECT_ID,
          briefId: "00000000-0000-4000-8000-0000000000f4",
          status: "producing_assets",
          resumeFrom: null,
          failureCode: null,
          createdAt: NOW_ISO,
          updatedAt: NOW_ISO,
        },
      });
    },
  });
  return { bodies };
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

describe("duyệt kịch bản v2 có storyboard (P6-17)", () => {
  it("hai phương án, câu theo người nói, ảnh storyboard từng cảnh, vấn đề kiểm tự động", async () => {
    server("waiting_script_approval");
    renderPanel();
    const first = await screen.findByRole("article", { name: `${vi.scriptReview.variant} 1` });
    expect(first.textContent).toContain("Phương án A");
    expect(first.textContent).toContain("Tí");
    expect(first.textContent).toContain("Bit ơi, ba giờ sáng rồi!");
    expect(first.textContent).toContain(vi.scriptReview.beats.fact);
    const images = await screen.findAllByRole("img");
    expect(images[0]?.getAttribute("src")).toBe(`/api/artifacts/${BOARD_ID}/stills/1/mo-dau`);
    expect(screen.getAllByText("Đầu của ti bị mép khung cắt")).toHaveLength(2);
    // ADR-020: lúc chờ duyệt mỗi phương án có một nút sửa câu; gợi ý kiểm tự động hiện ở từng phương án.
    expect(screen.getAllByRole("button", { name: vi.scriptReview.edit.start })).toHaveLength(2);
    expect(screen.getAllByText(/Kiểm tự động/)).toHaveLength(2);
  });

  it("tài sản mới của từng phương án: ảnh xem trước, trạng thái, không có nút riêng (ADR-017)", async () => {
    server("waiting_script_approval");
    renderPanel();
    const first = await screen.findByRole("article", { name: `${vi.scriptReview.variant} 1` });
    const assets = await within(first).findByRole("region", {
      name: vi.scriptReview.newAssetsHeading,
    });
    expect(assets.textContent).toContain(vi.scriptReview.assetCandidate);
    expect(
      within(assets)
        .getByRole("img", { name: "Chiếc giường ngủ có gối và chăn" })
        .getAttribute("src"),
    ).toBe("/api/motion-assets/prop_giuong/preview");
    // Nút duy nhất là phóng to ảnh tài sản; không có nút duyệt riêng.
    expect(
      within(assets)
        .queryAllByRole("button")
        .every((b) => b.getAttribute("title") === vi.scriptReview.openStill),
    ).toBe(true);
    await userEvent.setup().click(
      within(assets).getByRole("button", {
        name: `${vi.scriptReview.openStill}: Chiếc giường ngủ có gối và chăn`,
      }),
    );
    expect(await screen.findByRole("button", { name: vi.scriptReview.closeStill })).toBeTruthy();
    const second = screen.getByRole("article", { name: `${vi.scriptReview.variant} 2` });
    expect(
      (await within(second).findByRole("region", { name: vi.scriptReview.newAssetsHeading }))
        .textContent,
    ).toContain(`${vi.scriptReview.assetOpen} action_talk`);
  });

  it("bấm ảnh storyboard mở bản lớn, nút Đóng đưa về (P7-07)", async () => {
    server("waiting_script_approval");
    renderPanel();
    const user = userEvent.setup();
    const [open] = await screen.findAllByRole("button", {
      name: `${vi.scriptReview.openStill}: ${vi.scriptReview.stillAlt} mo-dau`,
    });
    await user.click(open as HTMLElement);
    const close = await screen.findByRole("button", { name: vi.scriptReview.closeStill });
    await user.click(close);
    expect(screen.queryByRole("button", { name: vi.scriptReview.closeStill })).toBeNull();
  });

  it("ảnh thêm của shot có minh họa: phóng to đúng ảnh của shot đó", async () => {
    server("waiting_script_approval");
    renderPanel();
    const user = userEvent.setup();
    const [extra] = await screen.findAllByRole("button", {
      name: `${vi.scriptReview.openStill}: ${vi.scriptReview.stillAlt} mo-dau s3`,
    });
    expect(extra?.querySelector("img")?.getAttribute("src")).toBe(
      `/api/artifacts/${BOARD_ID}/stills/1/mo-dau?shot=s3`,
    );
    await user.click(extra as HTMLElement);
    expect(await screen.findByRole("button", { name: vi.scriptReview.closeStill })).toBeTruthy();
  });

  it("duyệt phương án gửi đúng một decision có variantIndex", async () => {
    const api = server("waiting_script_approval");
    renderPanel();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: vi.scriptReview.approveVariant1 }));
    await waitFor(() => expect(api.bodies).toHaveLength(1));
    expect(api.bodies[0]).toEqual({
      gate: "script",
      decision: "approved",
      artifactId: SCRIPT_ID,
      variantIndex: 1,
    });
  });

  it("đang dựng storyboard: hiện trạng thái, chưa có nút duyệt", async () => {
    server("storyboarding");
    renderPanel();
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.queryByRole("button", { name: vi.scriptReview.approveVariant1 })).toBeNull();
  });
});
