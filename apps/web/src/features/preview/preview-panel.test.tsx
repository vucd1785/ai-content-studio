import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi as vitest } from "vitest";
import { vi } from "@/i18n/vi";
import { installFakeApi, jsonResponse, NOW_ISO, PROJECT_ID } from "@/test/fake-api";
import { groupArtifactVersions } from "./artifact-versions";
import { PreviewPanel } from "./preview-panel";

// Player thật cần canvas/video; bản giả ghi lại props để kiểm đúng artifact nào được phát.
const playerProps = vitest.hoisted(() => [] as Record<string, unknown>[]);
vitest.mock("@remotion/player", () => ({
  Player: (props: Record<string, unknown>) => {
    playerProps.push(props);
    return <div data-testid="fake-player" />;
  },
}));

const RAW_SOURCES = import.meta.glob<string>(["./*.ts", "./*.tsx", "!./*.test.tsx"], {
  query: "?raw",
  import: "default",
  eager: true,
});
const FIXTURES = import.meta.glob<Record<string, unknown>>("../../../../video/fixtures/edu-vertical-redis-props.json", {
  import: "default",
  eager: true,
});
const BASE_PROPS = Object.values(FIXTURES)[0] ?? {};

const RUN_ID = "00000000-0000-4000-8000-0000000000a9";
const IDS = {
  rp1: "00000000-0000-4000-8000-000000000101",
  rp2: "00000000-0000-4000-8000-000000000102",
  script: "00000000-0000-4000-8000-000000000103",
  preview: "00000000-0000-4000-8000-000000000104",
  broken: "00000000-0000-4000-8000-000000000105",
  audio: "00000000-0000-4000-8000-000000000106",
};

function propsWithHeadline(headline: string) {
  const scenes = (BASE_PROPS.scenes as Record<string, unknown>[]).map((scene, index) =>
    index === 0 ? { ...scene, headline } : scene,
  );
  return { ...BASE_PROPS, scenes };
}

function artifactBody(id: string, type: string, version: number, content: unknown) {
  return {
    artifact: {
      id,
      projectId: PROJECT_ID,
      workflowRunId: RUN_ID,
      type,
      version,
      schemaVersion: "1",
      contentHash: "c".repeat(64),
      metadata: {},
      createdAt: NOW_ISO,
    },
    content,
  };
}

function installServer(artifacts: { id: string; type: string; version: number }[]) {
  return installFakeApi({
    [`GET /api/workflow-runs/${RUN_ID}`]: () =>
      jsonResponse(200, {
        workflowRun: {
          id: RUN_ID,
          projectId: PROJECT_ID,
          briefId: "00000000-0000-4000-8000-0000000000aa",
          status: "waiting_final_approval",
          resumeFrom: null,
          failureCode: null,
          createdAt: NOW_ISO,
          updatedAt: NOW_ISO,
        },
        agentRuns: [],
        approvals: [],
        artifacts: artifacts.map((a) => ({ ...a, createdAt: NOW_ISO })),
      }),
    [`GET /api/artifacts/${IDS.rp1}`]: () => jsonResponse(200, artifactBody(IDS.rp1, "render_props", 1, propsWithHeadline("Bản một"))),
    [`GET /api/artifacts/${IDS.rp2}`]: () => jsonResponse(200, artifactBody(IDS.rp2, "render_props", 2, propsWithHeadline("Bản hai"))),
    [`GET /api/artifacts/${IDS.script}`]: () => jsonResponse(200, artifactBody(IDS.script, "script", 1, { variants: ["a", "b"] })),
    [`GET /api/artifacts/${IDS.preview}`]: () => jsonResponse(200, artifactBody(IDS.preview, "preview", 1, null)),
    [`GET /api/artifacts/${IDS.broken}`]: () => jsonResponse(200, artifactBody(IDS.broken, "render_props", 3, { fps: "x" })),
    [`GET /api/artifacts/${IDS.audio}`]: () => jsonResponse(200, artifactBody(IDS.audio, "audio", 1, null)),
    // Chỉ bản 2 có WAV; bản 1 thì route media trả 404 (mặc định của fake API).
    [`HEAD /api/artifacts/${IDS.rp2}/media`]: () => new Response(null, { status: 200 }),
  });
}

function renderPanel() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PreviewPanel runId={RUN_ID} />
    </QueryClientProvider>,
  );
}

function lastHeadline() {
  const inputProps = playerProps.at(-1)?.inputProps as { scenes: { headline?: string }[] } | undefined;
  return inputProps?.scenes[0]?.headline;
}

afterEach(() => {
  cleanup();
  playerProps.length = 0;
  vitest.unstubAllGlobals();
});

const TWO_VERSIONS = [
  { id: IDS.rp1, type: "render_props", version: 1 },
  { id: IDS.rp2, type: "render_props", version: 2 },
  { id: IDS.script, type: "script", version: 1 },
];

describe("preview và version (P2-08)", () => {
  it("hai artifact render_props: danh sách có cả hai, mặc định phát bản mới nhất", async () => {
    installServer(TWO_VERSIONS);
    renderPanel();
    await screen.findByTestId("fake-player");
    expect(screen.getByTestId("version-render_props-2").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("version-render_props-1").getAttribute("aria-pressed")).toBe("false");
    expect(lastHeadline()).toBe("Bản hai");
    expect(playerProps.at(-1)).toMatchObject({ fps: 30, compositionWidth: 1080, compositionHeight: 1920, controls: true });
  });

  it("artifact cũ vẫn mở được; chọn bản cũ không ghi gì lên server và bản mới vẫn còn", async () => {
    const api = installServer(TWO_VERSIONS);
    renderPanel();
    const user = userEvent.setup();
    await screen.findByTestId("fake-player");
    await user.click(screen.getByTestId("version-render_props-1"));
    await waitFor(() => expect(lastHeadline()).toBe("Bản một"));
    expect(screen.getByTestId("version-render_props-2")).toBeTruthy();
    await user.click(screen.getByTestId("version-render_props-2"));
    await waitFor(() => expect(lastHeadline()).toBe("Bản hai"));
    // Chỉ đọc (GET, và HEAD tới route media); không POST/PUT/DELETE, không route export hay render.
    const calls = api.fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${String(url)}`);
    expect(calls.every((call) => call.startsWith("GET ") || /^HEAD \/api\/artifacts\/[^/]+\/media$/.test(call))).toBe(true);
    expect(calls.some((call) => /export|render/.test(call))).toBe(false);
  });

  it("artifact JSON khác hiện nội dung; preview phát video qua route media; audio manifest chỉ báo; props hỏng không phát", async () => {
    installServer([
      ...TWO_VERSIONS,
      { id: IDS.preview, type: "preview", version: 1 },
      { id: IDS.audio, type: "audio", version: 1 },
      { id: IDS.broken, type: "render_props", version: 3 },
    ]);
    renderPanel();
    const user = userEvent.setup();
    // Bản 3 (hỏng) là mới nhất nên mặc định mở.
    expect((await screen.findByText(vi.preview.invalidProps)).textContent).toBe(vi.preview.invalidProps);
    expect(playerProps).toHaveLength(0);
    await user.click(screen.getByTestId("version-script-1"));
    expect((await screen.findByTestId("artifact-json")).textContent).toContain('"variants"');
    await user.click(screen.getByTestId("version-preview-1"));
    const video = await screen.findByTestId("preview-video");
    expect(video.getAttribute("src")).toBe(`/api/artifacts/${IDS.preview}/media`);
    await user.click(screen.getByTestId("version-audio-1"));
    expect(await screen.findByText(vi.preview.mediaNote)).toBeTruthy();
  });

  it("render props có WAV thì player nhận audio.src là route media; không có WAV thì phát không tiếng (P2-09)", async () => {
    installServer(TWO_VERSIONS);
    renderPanel();
    const user = userEvent.setup();
    await waitFor(() =>
      expect((playerProps.at(-1)?.inputProps as { audio: { src?: string } }).audio.src).toBe(`/api/artifacts/${IDS.rp2}/media`),
    );
    expect(screen.queryByText(vi.preview.noAudio)).toBeNull();
    await user.click(screen.getByTestId("version-render_props-1"));
    expect(await screen.findByText(vi.preview.noAudio)).toBeTruthy();
    expect((playerProps.at(-1)?.inputProps as { audio: { src?: string } }).audio.src).toBeUndefined();
  });

  it("nhóm theo loại, version mới trước, không bỏ version nào", () => {
    const groups = groupArtifactVersions([
      { id: "a", type: "script", version: 1, createdAt: NOW_ISO },
      { id: "b", type: "render_props", version: 1, createdAt: NOW_ISO },
      { id: "c", type: "render_props", version: 2, createdAt: NOW_ISO },
    ]);
    expect(groups.map((g) => [g.type, g.versions.map((v) => v.version)])).toEqual([
      ["render_props", [2, 1]],
      ["script", [1]],
    ]);
  });

  it("nguồn preview không gọi render/export và không dùng entry render của apps/video", () => {
    for (const [file, source] of Object.entries(RAW_SOURCES)) {
      expect(source, file).not.toMatch(/renderMedia|@remotion\/renderer|@studio\/video\/render|\/export/);
      expect(source, file).not.toMatch(/method: "(POST|PUT|DELETE)"/);
    }
  });
});
