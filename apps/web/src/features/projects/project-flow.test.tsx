import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi as vitest } from "vitest";
import { AppShell } from "@/features/shell/app-shell";
import { vi } from "@/i18n/vi";
import {
  apiError,
  installFakeApi,
  jsonResponse,
  NOW_ISO,
  PROJECT_ID,
  projectDetailBody,
} from "@/test/fake-api";
import { MAX_UPLOAD_BYTES } from "./reference-upload";

const projectRow = {
  id: PROJECT_ID,
  title: "Redis cơ bản",
  createdAt: NOW_ISO,
  updatedAt: NOW_ISO,
};
const listWithProject = () => jsonResponse(200, { projects: [projectRow] });
const BRIEF_PUT = `PUT /api/projects/${PROJECT_ID}/brief`;
const REF_POST = `POST /api/projects/${PROJECT_ID}/references`;

function renderShell() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AppShell />
    </QueryClientProvider>,
  );
}

async function openProject() {
  // applyAccept: false để thử cả tệp mà input `accept` sẽ lọc (kiểm chặn phía client).
  const user = userEvent.setup({ applyAccept: false });
  await user.click(
    await screen.findByRole("button", { name: projectRow.title }, { timeout: 5000 }),
  );
  const form = await screen.findByRole("form", { name: vi.brief.heading }, { timeout: 5000 });
  return { user, form };
}

async function fillValidBrief(user: ReturnType<typeof userEvent.setup>, form: HTMLElement) {
  const q = within(form);
  await user.type(q.getByLabelText(vi.brief.topic), "Redis cache");
  await user.type(q.getByLabelText(vi.brief.audience), "Backend dev");
  await user.type(q.getByLabelText(vi.brief.goal), "Hiểu TTL");
  await user.type(q.getByLabelText(vi.brief.tone), "thân thiện");
  await user.type(q.getByLabelText(vi.brief.visualStyle), "sơ đồ");
}

afterEach(() => {
  cleanup();
  vitest.unstubAllGlobals();
});

describe("Form brief (P2-06)", () => {
  it("duration ngoài 30–90 không gửi request và hiện lỗi tiếng Việt", async () => {
    const api = installFakeApi({
      "GET /api/projects": listWithProject,
      [`GET /api/projects/${PROJECT_ID}`]: () => jsonResponse(200, projectDetailBody()),
    });
    renderShell();
    const { user, form } = await openProject();
    await fillValidBrief(user, form);
    const duration = within(form).getByLabelText(vi.brief.durationSec);
    for (const bad of ["10", "29", "91", "45.5", ""]) {
      await user.clear(duration);
      if (bad !== "") await user.type(duration, bad);
      await user.click(within(form).getByRole("button", { name: vi.brief.save }));
      expect(within(form).getByText(vi.brief.durationRangeFor(30, 90))).toBeTruthy();
    }
    expect(api.callsTo(BRIEF_PUT)).toHaveLength(0);
  });

  it("trường bắt buộc rỗng không gửi request", async () => {
    const api = installFakeApi({
      "GET /api/projects": listWithProject,
      [`GET /api/projects/${PROJECT_ID}`]: () => jsonResponse(200, projectDetailBody()),
    });
    renderShell();
    const { user, form } = await openProject();
    await user.click(within(form).getByRole("button", { name: vi.brief.save }));
    expect(within(form).getAllByText(vi.brief.required).length).toBe(5);
    expect(api.callsTo(BRIEF_PUT)).toHaveLength(0);
  });

  it("server trả validation_error thì form hiển thị lỗi tiếng Việt, không hiện message gốc", async () => {
    const api = installFakeApi({
      "GET /api/projects": listWithProject,
      [`GET /api/projects/${PROJECT_ID}`]: () => jsonResponse(200, projectDetailBody()),
      [BRIEF_PUT]: () => apiError(400, "validation_error"),
    });
    renderShell();
    const { user, form } = await openProject();
    await fillValidBrief(user, form);
    await user.click(within(form).getByRole("button", { name: vi.brief.save }));
    expect((await within(form).findByRole("alert")).textContent).toBe(vi.brief.serverValidation);
    expect(document.body.textContent).not.toContain("SERVER_RAW_MESSAGE");
    expect(api.callsTo(BRIEF_PUT)).toHaveLength(1);
  });

  it("brief hợp lệ gửi đúng body hợp đồng (language vi, durationSec số)", async () => {
    const api = installFakeApi({
      "GET /api/projects": listWithProject,
      [`GET /api/projects/${PROJECT_ID}`]: () => jsonResponse(200, projectDetailBody()),
      [BRIEF_PUT]: (init) =>
        jsonResponse(201, {
          ...(JSON.parse(String(init?.body)) as object),
          // Server luôn ghi gói `story` (ADR-013 bổ sung (2)); client không gửi thể loại.
          formatId: "story",
          formatVersion: 1,
          id: "00000000-0000-4000-8000-0000000000b1",
          projectId: PROJECT_ID,
          createdAt: NOW_ISO,
        }),
    });
    renderShell();
    const { user, form } = await openProject();
    await fillValidBrief(user, form);
    const duration = within(form).getByLabelText(vi.brief.durationSec);
    await user.clear(duration);
    await user.type(duration, "75");
    await user.click(within(form).getByRole("button", { name: vi.brief.save }));
    expect((await within(form).findByRole("status")).textContent).toBe(vi.brief.saved);
    const body = JSON.parse(String(api.callsTo(BRIEF_PUT)[0]?.[1]?.body));
    expect(body).toEqual({
      topic: "Redis cache",
      audience: "Backend dev",
      goal: "Hiểu TTL",
      tone: "thân thiện",
      visualStyle: "sơ đồ",
      durationSec: 75,
      language: "vi",
    });
  });
});

describe("Tạo project và đính kèm tệp (P2-06)", () => {
  it("tạo project gửi title và chọn project mới", async () => {
    let created = false;
    const api = installFakeApi({
      "GET /api/projects": () => jsonResponse(200, { projects: created ? [projectRow] : [] }),
      "POST /api/projects": () => {
        created = true;
        return jsonResponse(201, projectRow);
      },
      [`GET /api/projects/${PROJECT_ID}`]: () => jsonResponse(200, projectDetailBody()),
    });
    renderShell();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: vi.project.create }));
    expect(await screen.findByText(vi.project.titleRequired)).toBeTruthy();
    expect(api.callsTo("POST /api/projects")).toHaveLength(0);
    await user.type(screen.getByLabelText(vi.project.titleLabel), "Redis cơ bản");
    await user.click(screen.getByRole("button", { name: vi.project.create }));
    expect(await screen.findByRole("form", { name: vi.brief.heading })).toBeTruthy();
    expect(JSON.parse(String(api.callsTo("POST /api/projects")[0]?.[1]?.body))).toEqual({
      title: "Redis cơ bản",
    });
  });

  it("tệp sai đuôi hoặc quá 10 MB không gửi; tệp hợp lệ gửi multipart", async () => {
    const api = installFakeApi({
      "GET /api/projects": listWithProject,
      [`GET /api/projects/${PROJECT_ID}`]: () => jsonResponse(200, projectDetailBody()),
      [REF_POST]: () =>
        jsonResponse(201, {
          id: "00000000-0000-4000-8000-0000000000c1",
          projectId: PROJECT_ID,
          kind: "user_file",
          title: "notes.md",
          mediaType: "text/markdown",
          byteSize: 7,
          createdAt: NOW_ISO,
        }),
    });
    renderShell();
    const { user } = await openProject();
    const section = screen.getByRole("region", { name: vi.references.heading });
    const q = within(section);
    const input = q.getByLabelText(vi.references.fileLabel) as HTMLInputElement;
    const submit = () => user.click(q.getByRole("button", { name: vi.references.upload }));

    await submit();
    expect(q.getByRole("alert").textContent).toBe(vi.references.noFile);

    await user.upload(input, new File(["MZ"], "run.exe"));
    await submit();
    expect(q.getByRole("alert").textContent).toBe(vi.references.badType);

    const big = new File(["x"], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: MAX_UPLOAD_BYTES + 1 });
    await user.upload(input, big);
    await submit();
    expect(q.getByRole("alert").textContent).toBe(vi.references.tooLarge);
    expect(api.callsTo(REF_POST)).toHaveLength(0);

    await user.upload(input, new File(["# Redis"], "notes.md", { type: "text/markdown" }));
    await submit();
    expect((await q.findByRole("status")).textContent).toBe(vi.references.uploaded);
    const sent = api.callsTo(REF_POST)[0]?.[1];
    expect(sent?.body).toBeInstanceOf(FormData);
    expect((sent?.body as FormData).get("file")).toBeInstanceOf(File);
    expect(sent?.headers).toBeUndefined();
  });

  it("server từ chối tệp (413, validation_error) hiện lỗi tiếng Việt", async () => {
    let next: Response = apiError(413, "payload_too_large");
    installFakeApi({
      "GET /api/projects": listWithProject,
      [`GET /api/projects/${PROJECT_ID}`]: () => jsonResponse(200, projectDetailBody()),
      [REF_POST]: () => next,
    });
    renderShell();
    const { user } = await openProject();
    const q = within(screen.getByRole("region", { name: vi.references.heading }));
    const input = q.getByLabelText(vi.references.fileLabel) as HTMLInputElement;
    await user.upload(input, new File(["%PDF-1.4"], "a.pdf", { type: "application/pdf" }));
    await user.click(q.getByRole("button", { name: vi.references.upload }));
    expect((await q.findByRole("alert")).textContent).toBe(vi.references.tooLarge);
    next = apiError(400, "validation_error");
    await user.click(q.getByRole("button", { name: vi.references.upload }));
    expect((await q.findByText(vi.references.serverValidation)).getAttribute("role")).toBe("alert");
    expect(document.body.textContent).not.toContain("SERVER_RAW_MESSAGE");
  });
});
