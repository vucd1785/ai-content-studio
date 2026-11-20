import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi as vitest } from "vitest";
import { vi } from "@/i18n/vi";
import { installFakeApi, jsonResponse, NOW_ISO, PROJECT_ID } from "@/test/fake-api";
import { YoutubeConnectCard } from "./youtube-connect";
import { YoutubeUploadPanel } from "./youtube-upload-panel";

const RUN_ID = "00000000-0000-4000-8000-0000000000f1";
const EXPORT_ID = "00000000-0000-4000-8000-0000000000f2";
const KIT_ID = "00000000-0000-4000-8000-0000000000f3";
const UPLOAD_ID = "00000000-0000-4000-8000-0000000000f4";
const t = vi.youtube;

afterEach(() => {
  cleanup();
  vitest.unstubAllGlobals();
});

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const connection = (over: Record<string, unknown> = {}) => ({
  configured: true,
  connected: true,
  channelId: "UCtest",
  channelTitle: "Tí Hay Hỏi",
  channelThumbnail: null,
  lastError: null,
  connectedAt: NOW_ISO,
  clientIdHint: "1234…-abcd….apps.googleusercontent.com",
  hasClientSecret: true,
  ...over,
});

const kit = (description = "Mô tả có liên hệ lienhe@example.com") => ({
  artifact: {
    id: KIT_ID,
    projectId: PROJECT_ID,
    workflowRunId: RUN_ID,
    type: "publish_kit",
    version: 1,
    schemaVersion: "1",
    contentHash: "c".repeat(64),
    metadata: {},
    createdAt: NOW_ISO,
  },
  content: {
    schemaVersion: 1,
    videoTitle: "Vì sao đom đóm phát sáng?",
    durationSec: 60,
    copyrightContact: "lienhe@example.com",
    platforms: {
      youtube: [
        { label: "Tiêu đề", value: "Vì sao đom đóm phát sáng?" },
        { label: "Mô tả", value: description },
        { label: "Thẻ (tags)", value: "đom đóm, khoa học vui" },
      ],
      facebook: [],
      tiktok: [],
    },
    copy: {
      youtube: {
        title: "Vì sao đom đóm phát sáng?",
        description: "Đom đóm phát sáng nhờ phản ứng hóa học.",
        tags: ["a", "b", "c"],
        hashtags: ["#A"],
      },
      facebook: {
        title: "Đom đóm nè",
        caption: "Đom đóm phát sáng thế nào nhỉ bạn ơi?",
        hashtags: ["#A"],
      },
      tiktok: { caption: "Đom đóm phát sáng!!", hashtags: ["#A", "#B", "#C"] },
    },
  },
});

const ARTIFACTS = [
  { id: EXPORT_ID, type: "export", version: 1 },
  { id: KIT_ID, type: "publish_kit", version: 1 },
];

describe("đăng YouTube (ADR-031)", () => {
  it("chưa kết nối: nhắc kết nối ở Bộ nhận diện kênh, không có nút Đăng", async () => {
    installFakeApi({
      "GET /api/youtube/connection": () =>
        jsonResponse(200, connection({ connected: false, channelTitle: null })),
      [`GET /api/workflow-runs/${RUN_ID}/youtube-uploads`]: () =>
        jsonResponse(200, { busy: false, lastError: null, uploads: [] }),
      [`GET /api/artifacts/${KIT_ID}`]: () => jsonResponse(200, kit()),
    });
    render(wrap(<YoutubeUploadPanel runId={RUN_ID} artifacts={ARTIFACTS} />));
    expect(await screen.findByText(t.panelNotConnected)).toBeTruthy();
    expect(screen.queryByRole("button", { name: t.upload })).toBeNull();
  });

  it("hộp xác nhận điền sẵn từ bộ đăng bài, ghi tên kênh, bắt chọn 'Dành cho trẻ em', mặc định Riêng tư", async () => {
    const api = installFakeApi({
      "GET /api/youtube/connection": () => jsonResponse(200, connection()),
      [`GET /api/workflow-runs/${RUN_ID}/youtube-uploads`]: () =>
        jsonResponse(200, { busy: false, lastError: null, uploads: [] }),
      [`GET /api/artifacts/${KIT_ID}`]: () => jsonResponse(200, kit()),
      [`POST /api/workflow-runs/${RUN_ID}/youtube-uploads`]: () =>
        jsonResponse(202, { status: "queued", uploadId: UPLOAD_ID }),
    });
    const user = userEvent.setup();
    render(wrap(<YoutubeUploadPanel runId={RUN_ID} artifacts={ARTIFACTS} />));
    await user.click(await screen.findByRole("button", { name: t.upload }));
    const dialog = await screen.findByTestId("youtube-upload-dialog");
    expect(dialog.textContent).toContain("Tí Hay Hỏi");
    expect((screen.getByLabelText(t.title) as HTMLInputElement).value).toBe(
      "Vì sao đom đóm phát sáng?",
    );
    expect((screen.getByLabelText(t.privacyNames.private ?? "") as HTMLInputElement).checked).toBe(
      true,
    );
    const submit = screen.getByRole("button", { name: t.submit });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByLabelText(t.kidsNo));
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    await user.click(submit);
    await waitFor(() =>
      expect(api.callsTo(`POST /api/workflow-runs/${RUN_ID}/youtube-uploads`)).toHaveLength(1),
    );
    const [, init] = api.callsTo(`POST /api/workflow-runs/${RUN_ID}/youtube-uploads`)[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      title: "Vì sao đom đóm phát sáng?",
      description: "Mô tả có liên hệ lienhe@example.com",
      tags: ["đom đóm", "khoa học vui"],
      privacy: "private",
      madeForKids: false,
      containsSyntheticMedia: false,
      includeThumbnail: true,
    });
  });

  it("mô tả quá 5.000 byte hoặc còn dòng nhắc liên hệ thì không đăng được; bộ đếm theo byte", async () => {
    installFakeApi({
      "GET /api/youtube/connection": () => jsonResponse(200, connection()),
      [`GET /api/workflow-runs/${RUN_ID}/youtube-uploads`]: () =>
        jsonResponse(200, { busy: false, lastError: null, uploads: [] }),
      [`GET /api/artifacts/${KIT_ID}`]: () =>
        jsonResponse(200, kit("[CHƯA CÓ LIÊN HỆ - điền ở Bộ nhận diện kênh rồi tạo lại]")),
    });
    const user = userEvent.setup();
    render(wrap(<YoutubeUploadPanel runId={RUN_ID} artifacts={ARTIFACTS} />));
    await user.click(await screen.findByRole("button", { name: t.upload }));
    await user.click(await screen.findByLabelText(t.kidsYes));
    expect(screen.getByText(t.missingContact)).toBeTruthy();
    expect((screen.getByRole("button", { name: t.submit }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    const box = screen.getByLabelText(t.description);
    await user.clear(box);
    await user.click(box);
    await user.paste("ệ".repeat(1700));
    expect(screen.getByText(/5\.100\/5\.000 byte/)).toBeTruthy();
    expect((screen.getByRole("button", { name: t.submit }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("đã đăng: hiện link, chế độ hiển thị đọc lại, nút đặt lại ảnh bìa; đăng thêm cần xác nhận lần hai", async () => {
    const api = installFakeApi({
      "GET /api/youtube/connection": () => jsonResponse(200, connection()),
      [`GET /api/workflow-runs/${RUN_ID}/youtube-uploads`]: () =>
        jsonResponse(200, {
          busy: false,
          lastError: null,
          uploads: [
            {
              id: UPLOAD_ID,
              exportArtifactId: EXPORT_ID,
              status: "completed",
              videoId: "vid_ABC123",
              url: "https://www.youtube.com/watch?v=vid_ABC123",
              isShort: false,
              privacyStatus: "unlisted",
              publishAt: null,
              title: "Vì sao đom đóm phát sáng?",
              thumbnail: "failed",
              thumbnailReason: "Kênh chưa xác minh",
              errorCode: null,
              errorMessage: null,
              createdAt: NOW_ISO,
            },
          ],
        }),
      [`GET /api/artifacts/${KIT_ID}`]: () => jsonResponse(200, kit()),
      [`POST /api/youtube-uploads/${UPLOAD_ID}/thumbnail`]: () =>
        jsonResponse(202, { status: "queued" }),
    });
    const user = userEvent.setup();
    render(wrap(<YoutubeUploadPanel runId={RUN_ID} artifacts={ARTIFACTS} />));
    const link = await screen.findByRole("link", { name: t.view });
    expect(link.getAttribute("href")).toBe("https://www.youtube.com/watch?v=vid_ABC123");
    expect(screen.getByText(t.privacyNames.unlisted ?? "")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: t.thumbRetry }));
    await waitFor(() =>
      expect(api.callsTo(`POST /api/youtube-uploads/${UPLOAD_ID}/thumbnail`)).toHaveLength(1),
    );

    await user.click(screen.getByRole("button", { name: t.uploadAgain }));
    await user.click(await screen.findByLabelText(t.kidsNo));
    const submit = screen.getByRole("button", { name: t.submit }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    await user.click(screen.getByLabelText(t.repeat));
    expect(submit.disabled).toBe(false);
  });
});

describe("kết nối kênh YouTube (ADR-031)", () => {
  it("chưa cấu hình: form nhập Client ID, secret; lưu gửi PUT rồi hiện nút kết nối", async () => {
    let configured = false;
    const api = installFakeApi({
      "GET /api/youtube/connection": () =>
        jsonResponse(
          200,
          configured
            ? connection({ connected: false, channelTitle: null })
            : connection({
                configured: false,
                connected: false,
                channelTitle: null,
                clientIdHint: null,
                hasClientSecret: false,
              }),
        ),
      "PUT /api/youtube/config": () => {
        configured = true;
        return jsonResponse(200, connection({ connected: false, channelTitle: null }));
      },
    });
    const user = userEvent.setup();
    render(wrap(<YoutubeConnectCard />));
    const form = await screen.findByTestId("youtube-config-form");
    expect(form).toBeTruthy();
    expect(screen.queryByRole("button", { name: t.connect })).toBeNull();
    const save = screen.getByRole("button", { name: t.configSave }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await user.type(screen.getByLabelText(t.clientId), "khong-hop-le");
    expect(screen.getByText(t.clientIdInvalid)).toBeTruthy();
    await user.clear(screen.getByLabelText(t.clientId));
    await user.type(
      screen.getByLabelText(t.clientId),
      "123456789012-abcdefghijklmnop.apps.googleusercontent.com",
    );
    const secret = screen.getByLabelText(t.clientSecret) as HTMLInputElement;
    expect(secret.type).toBe("password");
    await user.type(secret, "GOCSPX-abcdefghijklmnop");
    expect(save.disabled).toBe(false);
    await user.click(save);
    await waitFor(() => expect(api.callsTo("PUT /api/youtube/config")).toHaveLength(1));
    const [, init] = api.callsTo("PUT /api/youtube/config")[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      clientId: "123456789012-abcdefghijklmnop.apps.googleusercontent.com",
      clientSecret: "GOCSPX-abcdefghijklmnop",
    });
    expect(await screen.findByRole("button", { name: t.connect })).toBeTruthy();
    expect(screen.getByTestId("youtube-client-hint").textContent).toContain(
      "apps.googleusercontent.com",
    );
    expect(screen.queryByTestId("youtube-config-form")).toBeNull();
  });

  it("đã cấu hình: đổi Client ID được, bỏ trống secret để giữ secret cũ", async () => {
    const api = installFakeApi({
      "GET /api/youtube/connection": () => jsonResponse(200, connection()),
      "PUT /api/youtube/config": () => jsonResponse(200, connection()),
    });
    const user = userEvent.setup();
    render(wrap(<YoutubeConnectCard />));
    await user.click(await screen.findByRole("button", { name: t.configChange }));
    expect((screen.getByLabelText(t.clientSecret) as HTMLInputElement).placeholder).toBe(
      t.clientSecretKeep,
    );
    await user.type(
      screen.getByLabelText(t.clientId),
      "999999999999-zyxwvutsrqponmlk.apps.googleusercontent.com",
    );
    await user.click(screen.getByRole("button", { name: t.configSave }));
    await waitFor(() => expect(api.callsTo("PUT /api/youtube/config")).toHaveLength(1));
    const [, init] = api.callsTo("PUT /api/youtube/config")[0] ?? [];
    expect(JSON.parse(String(init?.body)).clientSecret).toBe("");
  });

  it("bấm Kết nối mở trang Google ở tab mới; đã kết nối thì hiện tên kênh và ngắt được sau khi xác nhận", async () => {
    const open = vitest.fn();
    vitest.stubGlobal("open", open);
    let connected = false;
    const api = installFakeApi({
      "GET /api/youtube/connection": () =>
        jsonResponse(
          200,
          connected ? connection() : connection({ connected: false, channelTitle: null }),
        ),
      "POST /api/youtube/oauth/start": () =>
        jsonResponse(200, { authUrl: "https://accounts.google.com/o/oauth2/v2/auth?state=x" }),
      "DELETE /api/youtube/connection": () => {
        connected = false;
        return jsonResponse(200, connection({ connected: false, channelTitle: null }));
      },
    });
    const user = userEvent.setup();
    const { unmount } = render(wrap(<YoutubeConnectCard />));
    await user.click(await screen.findByRole("button", { name: t.connect }));
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    expect(open.mock.calls[0]?.[0]).toBe("https://accounts.google.com/o/oauth2/v2/auth?state=x");
    expect(open.mock.calls[0]?.[2]).toContain("noopener");
    expect(screen.getByRole("status").textContent).toContain(t.connecting);
    unmount();

    connected = true;
    render(wrap(<YoutubeConnectCard />));
    expect((await screen.findByTestId("youtube-channel")).textContent).toBe("Tí Hay Hỏi");
    await user.click(screen.getByRole("button", { name: t.disconnect }));
    const confirm = screen.getAllByRole("button", { name: t.disconnect }).at(-1);
    if (confirm === undefined) throw new Error("no confirm");
    await user.click(confirm);
    await waitFor(() => expect(api.callsTo("DELETE /api/youtube/connection")).toHaveLength(1));
    expect(await screen.findByText(t.notConnected)).toBeTruthy();
  });
});
