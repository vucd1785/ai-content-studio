import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { vi } from "@/i18n/vi";
import { installFakeApi, jsonResponse } from "@/test/fake-api";
import { LibraryPage } from "./library-page";

afterEach(() => cleanup());

const asset = (
  assetId: string,
  kind: string,
  status: "candidate" | "approved",
  preview: boolean,
) => ({
  assetId,
  kind,
  version: "0.1.0",
  tags: ["máy chủ"],
  createdBy: status === "candidate" ? "claude-code" : "director",
  status,
  hasPreview: preview,
});

describe("Kho hình động chỉ đọc (P7-09)", () => {
  it("hiện thẻ có ảnh, lọc theo loại và trạng thái, không có nút duyệt", async () => {
    installFakeApi({
      "GET /api/motion-assets": () =>
        jsonResponse(200, {
          assets: [
            asset("prop_giuong", "prop", "candidate", true),
            asset("bg_room", "background", "approved", false),
          ],
        }),
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <LibraryPage />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("prop_giuong")).toBeTruthy();
    expect(screen.getByRole("img", { name: "prop_giuong" }).getAttribute("src")).toBe(
      "/api/motion-assets/prop_giuong/preview",
    );
    expect(screen.getByText(vi.library.noPreview)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: vi.library.kinds.background }));
    expect(screen.queryByText("prop_giuong")).toBeNull();
    expect(screen.getByText("bg_room")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: vi.library.all })[0] as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: vi.library.candidate }));
    expect(screen.getByText("prop_giuong")).toBeTruthy();
    expect(screen.queryByText("bg_room")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Duyệt/ })).toBeNull();
  });
});
