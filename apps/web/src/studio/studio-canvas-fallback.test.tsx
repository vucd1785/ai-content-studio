import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi as vitest } from "vitest";
import { studioLabels } from "./studio-labels";
import { StudioWorkspace } from "./studio-workspace";

// Mô phỏng trình duyệt không dựng được canvas (không WebGL / thiếu ResizeObserver).
vitest.mock("@react-three/fiber", () => ({
  Canvas: () => {
    throw new Error("WebGL unavailable");
  },
}));
vitest.mock("@react-three/drei", () => ({
  OrbitControls: () => null,
  OrthographicCamera: () => null,
}));

afterEach(() => {
  cleanup();
  vitest.restoreAllMocks();
});

describe("canvas lỗi (gắn vào shell)", () => {
  it("chỉ vùng canvas đổi thành thông báo; danh sách vai trò và inspector vẫn dùng được", async () => {
    vitest.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <StudioWorkspace runId={null} />
      </QueryClientProvider>,
    );
    expect(screen.getByRole("status").textContent).toBe(studioLabels.canvasUnavailable);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: studioLabels.roles.research }));
    expect(screen.getByTestId("inspector-research")).toBeTruthy();
  });
});
