import { vi as vitest } from "vitest";

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function apiError(status: number, code: string, message = "SERVER_RAW_MESSAGE"): Response {
  return jsonResponse(status, { error: { code, message, details: {} } });
}

type Handler = (init: RequestInit | undefined) => Response | Promise<Response>;

/**
 * `fetch` giả theo "METHOD path". Route không khai báo trả 404 `not_found`.
 * Mặc định: chưa đăng nhập, danh sách project rỗng.
 */
export function installFakeApi(routes: Record<string, Handler> = {}) {
  const defaults: Record<string, Handler> = {
    "GET /api/session": () => jsonResponse(200, { authenticated: false }),
    "POST /api/session/logout": () => jsonResponse(200, { authenticated: false }),
    "GET /api/projects": () => jsonResponse(200, { projects: [] }),
  };
  const table = { ...defaults, ...routes };
  const fetchMock = vitest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${String(input)}`;
    const handler = table[key];
    return handler === undefined ? apiError(404, "not_found") : handler(init);
  });
  vitest.stubGlobal("fetch", fetchMock);
  const callsTo = (key: string) =>
    fetchMock.mock.calls.filter(([url, init]) => `${init?.method ?? "GET"} ${String(url)}` === key);
  return { fetchMock, callsTo };
}

export const PROJECT_ID = "00000000-0000-4000-8000-0000000000a1";
export const NOW_ISO = "2026-10-31T00:00:00.000Z";

export function projectDetailBody(brief: unknown = null, references: unknown[] = []) {
  return {
    project: { id: PROJECT_ID, title: "Redis cơ bản", createdAt: NOW_ISO, updatedAt: NOW_ISO },
    brief,
    workflowRun: null,
    references,
  };
}
