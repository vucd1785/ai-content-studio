import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi as vitest } from "vitest";
import { vi } from "@/i18n/vi";
import { installFakeApi, jsonResponse } from "@/test/fake-api";
import { VideosPage } from "./videos-page";

afterEach(() => cleanup());

const t = vi.videos;

const base = {
  workflowRunId: "00000000-0000-4000-8000-0000000000a1",
  exportedAt: "2026-11-17T02:00:00.000Z",
  hasThumbnail: true,
};

const SHORT = {
  ...base,
  exportArtifactId: "00000000-0000-4000-8000-000000000001",
  projectId: "00000000-0000-4000-8000-000000000021",
  projectTitle: "Dự án Trái Đất",
  topic: "Điều gì xảy ra nếu Trái Đất ngừng quay?",
  aspectRatio: "9:16",
  width: 1080,
  height: 1920,
  durationSec: 68,
  isShort: true,
  youtube: {
    uploadId: "00000000-0000-4000-8000-000000000011",
    status: "completed",
    videoId: "B2_fwhKvE4o",
    url: "https://www.youtube.com/shorts/B2_fwhKvE4o",
    isShort: true,
    privacyStatus: "public",
    publishAt: null,
  },
};

const WIDE = {
  ...base,
  workflowRunId: "00000000-0000-4000-8000-0000000000a2",
  exportArtifactId: "00000000-0000-4000-8000-000000000002",
  projectId: "00000000-0000-4000-8000-000000000022",
  projectTitle: "Dự án cờ",
  topic: "Cờ các nước Nam Mỹ",
  aspectRatio: "16:9",
  width: 1920,
  height: 1080,
  durationSec: 245,
  isShort: false,
  hasThumbnail: false,
  youtube: null,
};

function renderPage(onOpen = vitest.fn()) {
  installFakeApi({ "GET /api/videos": () => jsonResponse(200, { videos: [SHORT, WIDE] }) });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <VideosPage onOpenProject={onOpen} />
    </QueryClientProvider>,
  );
  return onOpen;
}

describe("Màn Video (P8-08)", () => {
  it("hiện thẻ video với link Short, nút tải và mở dự án; không có nút đăng hay xóa", async () => {
    const onOpen = renderPage();
    const cards = await screen.findAllByTestId("video-card");
    expect(cards).toHaveLength(2);
    const short = within(cards[0] as HTMLElement);
    expect(short.getByText(SHORT.topic)).toBeTruthy();
    expect(short.getByText("1:08")).toBeTruthy();
    expect(short.getByText(t.short)).toBeTruthy();
    expect(short.getByRole("link", { name: t.viewShort }).getAttribute("href")).toBe(
      "https://www.youtube.com/shorts/B2_fwhKvE4o",
    );
    expect(short.getByRole("link", { name: t.download }).getAttribute("href")).toBe(
      `/api/artifacts/${SHORT.exportArtifactId}/media`,
    );
    expect(short.getByRole("link", { name: t.downloadThumbnail }).getAttribute("href")).toBe(
      `/api/artifacts/${SHORT.exportArtifactId}/thumbnail`,
    );
    const wide = within(cards[1] as HTMLElement);
    expect(wide.getByText(t.ytNone)).toBeTruthy();
    expect(wide.getByText("4:05")).toBeTruthy();
    expect(wide.queryByText(t.short)).toBeNull();
    expect(wide.queryByRole("link", { name: t.downloadThumbnail })).toBeNull();
    fireEvent.click(wide.getByRole("button", { name: t.openProject }));
    expect(onOpen).toHaveBeenCalledWith(WIDE.projectId);
    expect(screen.queryByRole("button", { name: /Đăng|Xóa|Duyệt/ })).toBeNull();
  });

  it("lọc theo YouTube và khung, tìm không dấu", async () => {
    renderPage();
    await screen.findAllByTestId("video-card");
    fireEvent.click(screen.getByRole("button", { name: t.notUploaded }));
    expect(screen.getAllByTestId("video-card")).toHaveLength(1);
    expect(screen.getByText(WIDE.topic)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t.uploaded }));
    expect(screen.getByText(SHORT.topic)).toBeTruthy();
    expect(screen.queryByText(WIDE.topic)).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: t.all })[0] as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: t.wide }));
    expect(screen.getAllByTestId("video-card")).toHaveLength(1);
    fireEvent.click(screen.getAllByRole("button", { name: t.all })[1] as HTMLElement);
    fireEvent.change(screen.getByRole("searchbox", { name: t.search }), {
      target: { value: "trai dat" },
    });
    expect(screen.getAllByTestId("video-card")).toHaveLength(1);
    expect(screen.getByText(SHORT.topic)).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: t.search }), {
      target: { value: "khong co" },
    });
    expect(screen.getByText(t.noMatch)).toBeTruthy();
  });
});
