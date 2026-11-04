import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi as vitest } from "vitest";
import { WorkerStatusPill } from "@/features/shell/worker-status";
import { vi } from "@/i18n/vi";
import { installFakeApi, jsonResponse, NOW_ISO } from "@/test/fake-api";
import { currentMonthRange, HomePage } from "./home-page";

// Suite web chạy song song trên máy dev chậm: 1 s mặc định của findBy* không đủ.
const SLOW = { timeout: 5_000 };
const RUN = "00000000-0000-4000-8000-0000000000b";

function project(n: number, title: string, status: string | null) {
  return {
    id: `00000000-0000-4000-8000-00000000000${n}`,
    title,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    latestRun: status === null ? null : { id: `${RUN}${n}`, status, updatedAt: NOW_ISO },
  };
}

function summaryKey() {
  const { from, to } = currentMonthRange();
  return `GET /api/usage/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

function renderWithClient(node: React.ReactNode) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {node}
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vitest.unstubAllGlobals();
});

describe("trang dự án (P2-11)", () => {
  it("đếm theo trạng thái run, token tháng này, và việc chờ Director lên đầu", async () => {
    installFakeApi({
      "GET /api/projects": () =>
        jsonResponse(200, {
          projects: [
            project(1, "Kịch bản chờ", "waiting_script_approval"),
            project(2, "Bản cuối chờ", "waiting_final_approval"),
            project(3, "Đang dựng", "preview_rendering"),
            project(4, "Đã xong", "exported"),
            project(5, "Chưa chạy", null),
          ],
        }),
      [summaryKey()]: () =>
        jsonResponse(200, {
          from: "a",
          to: "b",
          calls: 3,
          inputTokens: 1000,
          outputTokens: 200,
          thinkingTokens: 34,
        }),
    });
    const onSelect = vitest.fn();
    renderWithClient(<HomePage onSelect={onSelect} />);

    const needsYou = await screen.findByRole("region", { name: vi.home.needsYou }, SLOW);
    const cards = within(needsYou).getAllByRole("button");
    expect(cards.map((card) => card.textContent)).toEqual([
      expect.stringContaining("Kịch bản chờ"),
      expect.stringContaining("Bản cuối chờ"),
    ]);

    const stats = screen.getByRole("region", { name: vi.home.statsLabel });
    expect(within(stats).getByText(vi.home.statWaiting).parentElement?.textContent).toContain("2");
    expect(within(stats).getByText(vi.home.statWorking).parentElement?.textContent).toContain("1");
    expect(within(stats).getByText(vi.home.statDone).parentElement?.textContent).toContain("1");
    // 1000 + 200 + 34 theo định dạng vi-VN.
    expect(await within(stats).findByText("1.234", {}, SLOW)).toBeTruthy();

    fireEvent.click(cards[1] as HTMLElement);
    expect(onSelect).toHaveBeenCalledWith(project(2, "", null).id);
  });

  it("không có việc chờ thì không hiện khối Cần bạn xử lý; token lỗi hiện gạch", async () => {
    installFakeApi({
      "GET /api/projects": () =>
        jsonResponse(200, { projects: [project(1, "Đã xong", "exported")] }),
    });
    renderWithClient(<HomePage onSelect={() => undefined} />);
    expect(await screen.findByText("Đã xong", {}, SLOW)).toBeTruthy();
    expect(screen.queryByRole("region", { name: vi.home.needsYou })).toBeNull();
    const stats = screen.getByRole("region", { name: vi.home.statsLabel });
    expect(within(stats).getByText(vi.home.statTokens).parentElement?.textContent).toContain("–");
  });

  it("nhãn worker theo nhịp tim đã lưu (P3-15)", async () => {
    installFakeApi({
      "GET /api/worker-status": () =>
        jsonResponse(200, { alive: true, queues: ["llm", "media"], lastSeenAt: NOW_ISO }),
    });
    renderWithClient(<WorkerStatusPill />);
    const pill = screen.getByTestId("worker-status");
    await screen.findByText(`${vi.worker.running} · llm, media`, {}, SLOW);
    expect(pill.textContent).toBe(`${vi.worker.running} · llm, media`);
  });
});

describe("currentMonthRange", () => {
  it("từ đầu tháng đến đầu tháng sau theo giờ máy", () => {
    const { from, to } = currentMonthRange(new Date(2026, 10, 15, 12));
    expect(new Date(from).getTime()).toBe(new Date(2026, 10, 1).getTime());
    expect(new Date(to).getTime()).toBe(new Date(2026, 11, 1).getTime());
  });
});
