import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi as vitest } from "vitest";
import { App } from "@/app";
import { vi } from "@/i18n/vi";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function renderWithQuery(node: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

/** Giả lập API: GET /api/session chưa đăng nhập; login theo `loginResponse`. */
function mockApi(loginResponse: () => Response | Promise<Response>) {
  const fetchMock = vitest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/session" && (init?.method ?? "GET") === "GET") {
      return jsonResponse(200, { authenticated: false });
    }
    if (url === "/api/session/login") {
      return loginResponse();
    }
    if (url === "/api/session/logout") {
      return jsonResponse(200, { authenticated: false });
    }
    return jsonResponse(404, { error: { code: "not_found", message: "x", details: {} } });
  });
  vitest.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vitest.unstubAllGlobals();
});

describe("LoginPage", () => {
  it("login sai hiện lỗi tiếng Việt, không hiện message gốc của server", async () => {
    mockApi(() =>
      jsonResponse(401, {
        error: { code: "unauthorized", message: "SERVER_RAW_MESSAGE", details: {} },
      }),
    );
    renderWithQuery(<App />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(vi.login.passwordLabel), "sai-mat-khau");
    await user.click(screen.getByRole("button", { name: vi.login.submit }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(vi.login.errorWrongPassword);
    expect(document.body.textContent).not.toContain("SERVER_RAW_MESSAGE");
  });

  it("mật khẩu rỗng không gửi request, hiện lỗi tiếng Việt", async () => {
    const fetchMock = mockApi(() => jsonResponse(200, { authenticated: true }));
    renderWithQuery(<App />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: vi.login.submit }));
    expect((await screen.findByRole("alert")).textContent).toBe(vi.login.errorMissingPassword);
    expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/session/login")).toBe(false);
  });

  it("lỗi mạng hiện thông báo tiếng Việt", async () => {
    mockApi(() => Promise.reject(new TypeError("Failed to fetch")));
    renderWithQuery(<App />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(vi.login.passwordLabel), "x");
    await user.click(screen.getByRole("button", { name: vi.login.submit }));
    expect((await screen.findByRole("alert")).textContent).toBe(vi.login.errorNetwork);
  });

  it("login đúng mở shell ba vùng; đăng xuất quay lại login", async () => {
    const fetchMock = mockApi(() => jsonResponse(200, { authenticated: true }));
    renderWithQuery(<App />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(vi.login.passwordLabel), "dung-mat-khau");
    await user.click(screen.getByRole("button", { name: vi.login.submit }));
    expect(await screen.findByRole("complementary", { name: vi.shell.regionProjects })).toBeTruthy();
    expect(screen.getByRole("main", { name: vi.shell.regionStudio })).toBeTruthy();
    expect(screen.getByRole("complementary", { name: vi.shell.regionDetail })).toBeTruthy();
    const loginCall = fetchMock.mock.calls.find(([url]) => String(url) === "/api/session/login");
    expect(loginCall?.[1]?.body).toBe(JSON.stringify({ password: "dung-mat-khau" }));
    expect(loginCall?.[1]?.credentials).toBe("same-origin");

    await user.click(screen.getByRole("button", { name: vi.shell.logout }));
    expect(await screen.findByRole("button", { name: vi.login.submit })).toBeTruthy();
  });
});
