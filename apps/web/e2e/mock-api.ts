import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page, Route } from "@playwright/test";

/**
 * API giả cho E2E (P7-10). Dữ liệu mẫu, chỉ dùng trong test: tên dự án ghi rõ "(mẫu)".
 * Ảnh storyboard mẫu lấy từ docs/design/ui-kit; ảnh tài sản lấy từ ui-kit.
 */
export const REPO = join(import.meta.dirname, "..", "..", "..");
const KIT = join(REPO, "docs", "design", "ui-kit");

export const IDS = {
  p1: "00000000-0000-4000-8000-0000000000a1",
  p2: "00000000-0000-4000-8000-0000000000a2",
  p3: "00000000-0000-4000-8000-0000000000a3",
  p4: "00000000-0000-4000-8000-0000000000a4",
  run1: "00000000-0000-4000-8000-0000000000b1",
  brief: "00000000-0000-4000-8000-0000000000c1",
  script: "00000000-0000-4000-8000-0000000000d1",
  board: "00000000-0000-4000-8000-0000000000d2",
  preview: "00000000-0000-4000-8000-0000000000d3",
  qa: "00000000-0000-4000-8000-0000000000d4",
  exported: "00000000-0000-4000-8000-0000000000d5",
  kit: "00000000-0000-4000-8000-0000000000d6",
} as const;

/** Bộ đăng bài mẫu (ADR-018), đúng `publishKitSchema`. */
const FOOTER =
  "-----\nVỀ VIDEO NÀY\nVideo do kênh Tí và Bit tự sản xuất. Kịch bản, nhân vật hoạt hình, hình động và giọng đọc được làm với sự hỗ trợ của công cụ AI, rồi được người biên tập kiểm tra và duyệt trước khi đăng.\n\nBẢN QUYỀN\nNếu bạn cho rằng video có nội dung vi phạm bản quyền của bạn, vui lòng liên hệ [CHƯA CÓ LIÊN HỆ - điền ở Bộ nhận diện kênh rồi tạo lại].";
const KIT_COPY = {
  youtube: {
    title: "Vì sao thức khuya làm bạn mệt? Giải thích trong 2 phút",
    description:
      "Thức khuya một đêm, cơ thể bạn mất gì?\nTí, Đậu và Bit kể lại bằng ví dụ đời thường.",
    tags: ["thức khuya", "giấc ngủ", "sức khỏe"],
    hashtags: ["#GiacNgu", "#SucKhoe"],
  },
  facebook: {
    title: "Thức khuya một đêm, cơ thể mất gì?",
    caption: "Bạn từng thức tới 2 giờ sáng chưa? Xem Bit giải thích nhé. Bạn ngủ lúc mấy giờ?",
    hashtags: ["#GiacNgu"],
  },
  tiktok: { caption: "Thức khuya có sao không?", hashtags: ["#GiacNgu", "#SucKhoe", "#HocVui"] },
};
const PUBLISH_KIT = {
  schemaVersion: 1,
  videoTitle: "Vì sao thức khuya làm bạn mệt",
  durationSec: 120,
  copyrightContact: null,
  platforms: {
    youtube: [
      { label: "Tiêu đề", value: KIT_COPY.youtube.title },
      {
        label: "Mô tả",
        value: `${KIT_COPY.youtube.description}\n\n#GiacNgu #SucKhoe #Shorts\n\n${FOOTER}`,
      },
      { label: "Thẻ (tags)", value: KIT_COPY.youtube.tags.join(", ") },
    ],
    facebook: [
      { label: "Tiêu đề", value: KIT_COPY.facebook.title },
      { label: "Mô tả", value: `${KIT_COPY.facebook.caption}\n\n#GiacNgu\n\n${FOOTER}` },
    ],
    tiktok: [
      {
        label: "Chú thích",
        value: `${KIT_COPY.tiktok.caption}\n\n#GiacNgu #SucKhoe #HocVui\n\nVideo gốc của Tí và Bit, làm với hỗ trợ AI.`,
      },
    ],
  },
  copy: KIT_COPY,
};

const NOW = new Date("2026-11-10T08:00:00+07:00").toISOString();
const minutesAgo = (m: number) => new Date(Date.parse(NOW) - m * 60_000).toISOString();

export type Scenario = {
  status: string;
  failure?: { role: string; code: string; message: string } | null;
  qaPassed?: boolean;
  workerAlive?: boolean;
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const png = (route: Route, file: string) =>
  existsSync(file)
    ? route.fulfill({ status: 200, contentType: "image/png", body: readFileSync(file) })
    : route.fulfill({ status: 404, body: "" });

function project(id: string, title: string, status: string | null) {
  return {
    id,
    title,
    createdAt: minutesAgo(600),
    updatedAt: minutesAgo(30),
    latestRun: status === null ? null : { id: IDS.run1, status, updatedAt: minutesAgo(5) },
  };
}

function run(s: Scenario) {
  return {
    id: IDS.run1,
    projectId: IDS.p1,
    briefId: IDS.brief,
    status: s.status,
    resumeFrom: s.status === "failed" ? "producing_assets" : null,
    failureCode: s.failure?.code ?? null,
    failureMessage: s.failure?.message ?? null,
    llmModel: "gemini-3.6-flash",
    createdAt: minutesAgo(40),
    updatedAt: minutesAgo(1),
  };
}

function agentRuns(s: Scenario) {
  const order = [
    "producer",
    "research",
    "script",
    "visual",
    "voice",
    "video",
    "qa",
    ...(s.status === "exported" ? ["publish"] : []),
  ];
  const doneUntil =
    s.status === "producing_assets" || s.status === "failed"
      ? 3
      : s.status === "waiting_script_approval"
        ? 3
        : s.status === "waiting_final_approval"
          ? 7
          : s.status === "exported"
            ? 8
            : 1;
  return order.map((role, i) => {
    const failed = s.failure?.role === role;
    const running = !failed && s.status === "producing_assets" && role === "voice";
    return {
      id: `00000000-0000-4000-8000-00000000e0${i}0`,
      role,
      status: failed ? "failed" : running ? "running" : i < doneUntil ? "completed" : "idle",
      startedAt: i <= doneUntil ? minutesAgo(40 - i * 4) : null,
      finishedAt: i < doneUntil ? minutesAgo(38 - i * 4) : null,
      errorCode: failed ? (s.failure?.code ?? null) : null,
      errorMessage: failed ? (s.failure?.message ?? null) : null,
      progress: running
        ? { done: 5, total: 14, unit: "scene_step", sceneIndex: 3, sceneCount: 7, phase: "align" }
        : null,
    };
  });
}

const line = (id: string, speaker: string, text: string) => ({ id, speaker, text });
function variant(title: string) {
  return {
    schemaVersion: 2,
    language: "vi",
    formatId: "story",
    formatVersion: 2,
    title,
    sources: [{ id: "src1", title: "Khuyến nghị giấc ngủ cho người trưởng thành (mẫu)" }],
    scenes: [
      {
        id: "mo-dau",
        beat: "cold_open",
        sourceIds: [],
        lines: [
          line("l1", "ti", "Một giờ sáng rồi, thêm một video nữa thôi…"),
          line("l2", "bit", "Cậu nói câu đó ba lần rồi đấy."),
        ],
        shots: [{ id: "s1" }],
      },
      {
        id: "dat-van-de",
        beat: "premise",
        sourceIds: [],
        lines: [line("l3", "dau", "Sao mắt Tí thâm thế?")],
        shots: [{ id: "s2" }],
      },
      {
        id: "su-that",
        beat: "fact",
        sourceIds: ["src1"],
        lines: [line("l4", "bit", "Người lớn cần khoảng bảy đến chín tiếng ngủ mỗi đêm.")],
        shots: [{ id: "s3" }],
      },
    ],
  };
}

const STILLS = ["01_mo_dau", "02_dat_van_de", "04_su_that"];

export async function installMockApi(page: Page, scenario: Scenario) {
  const s = scenario;
  // Chỉ chặn API: mẫu "**/api/**" sẽ chặn nhầm file nguồn Vite như packages/contracts/src/api/*.ts.
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const method = route.request().method();
      if (path === "/api/session") return json(route, { authenticated: true });
      if (path === "/api/worker-status")
        return json(route, {
          alive: s.workerAlive !== false,
          queues: ["llm", "media", "render"],
          lastSeenAt: NOW,
        });
      if (path === "/api/projects" && method === "GET")
        return json(route, {
          projects: [
            project(IDS.p1, "Vì sao thức khuya làm bạn mệt (mẫu)", s.status),
            project(IDS.p2, "DDoS là gì (mẫu)", "waiting_final_approval"),
            project(IDS.p3, "Lãi kép cho người mới (mẫu)", "exported"),
            project(IDS.p4, "Chủ đề mới (mẫu)", null),
          ],
        });
      if (path === `/api/projects/${IDS.p1}`)
        return json(route, {
          project: {
            id: IDS.p1,
            title: "Vì sao thức khuya làm bạn mệt (mẫu)",
            createdAt: NOW,
            updatedAt: NOW,
          },
          brief: {
            id: IDS.brief,
            projectId: IDS.p1,
            topic: "Thiếu ngủ ảnh hưởng tới cơ thể thế nào",
            audience: "Học sinh, sinh viên, người đi làm",
            goal: "Hiểu vì sao cần ngủ đủ và ba mẹo dễ làm",
            durationSec: 120,
            language: "vi",
            tone: "Vui, gần gũi",
            visualStyle: "Phòng ngủ buổi tối, lớp học buổi sáng",
            notes: "",
            formatId: "story",
            formatVersion: 2,
            createdAt: NOW,
          },
          workflowRun: { id: IDS.run1, status: s.status, createdAt: NOW, updatedAt: NOW },
          references: [],
        });
      if (path === `/api/workflow-runs/${IDS.run1}`)
        return json(route, {
          workflowRun: run(s),
          agentRuns: agentRuns(s),
          approvals: [],
          artifacts: [
            { id: IDS.script, type: "script", version: 1, createdAt: minutesAgo(20) },
            { id: IDS.board, type: "storyboard", version: 1, createdAt: minutesAgo(19) },
            ...(s.status === "waiting_final_approval"
              ? [
                  { id: IDS.preview, type: "preview", version: 1, createdAt: minutesAgo(3) },
                  { id: IDS.qa, type: "qa_report", version: 1, createdAt: minutesAgo(2) },
                ]
              : []),
            ...(s.status === "exported"
              ? [
                  { id: IDS.preview, type: "preview", version: 1, createdAt: minutesAgo(9) },
                  { id: IDS.qa, type: "qa_report", version: 1, createdAt: minutesAgo(8) },
                  { id: IDS.exported, type: "export", version: 1, createdAt: minutesAgo(3) },
                  { id: IDS.kit, type: "publish_kit", version: 1, createdAt: minutesAgo(2) },
                ]
              : []),
          ],
        });
      if (path === "/api/brand-profile/contact")
        return json(route, {
          brandProfileId: "00000000-0000-4000-8000-0000000000e1",
          displayName: "Tí và Bit",
          copyrightContact: null,
        });
      if (path === `/api/workflow-runs/${IDS.run1}/events/stream`)
        return route.fulfill({ status: 200, contentType: "text/event-stream", body: ":\n\n" });
      if (path === `/api/workflow-runs/${IDS.run1}/usage`)
        return json(route, {
          usageRecords: [
            {
              id: "00000000-0000-4000-8000-0000000000f1",
              workflowRunId: IDS.run1,
              agentRunId: "00000000-0000-4000-8000-00000000e010",
              provider: "gemini",
              model: "gemini-3.6-flash",
              inputTokens: 5120,
              outputTokens: 3480,
              thinkingTokens: 900,
              estimatedCostUsd: "0",
              createdAt: minutesAgo(20),
            },
          ],
        });
      if (path === `/api/workflow-runs/${IDS.run1}/asset-requests`)
        return json(route, {
          requests: [
            {
              id: "00000000-0000-4000-8000-0000000000f2",
              scriptArtifactId: IDS.script,
              variantIndex: 1,
              requestKey: "r1",
              kind: "prop",
              description: "Chiếc giường ngủ có gối và chăn kẻ sọc, chăn phập phồng nhẹ",
              sceneIds: ["mo-dau"],
              fallbackAssetId: "prop_laptop",
              status: "fulfilled",
              asset: {
                assetId: "prop_chiec_giuong_ngu_694e",
                kind: "prop",
                version: "0.1.0",
                tags: ["giường ngủ"],
                createdBy: "claude-code",
                status: "candidate",
                hasPreview: true,
              },
            },
          ],
        });
      if (path === "/api/usage/summary")
        return json(route, {
          from: url.searchParams.get("from"),
          to: url.searchParams.get("to"),
          calls: 14,
          inputTokens: 61200,
          outputTokens: 20400,
          thinkingTokens: 2600,
        });
      if (path === "/api/llm-models")
        return json(route, {
          defaultModel: "gemini-3.6-flash",
          models: ["gemini-3.6-flash", "claude-code"],
        });
      if (path === "/api/motion-assets")
        return json(route, {
          assets: [
            {
              assetId: "prop_chiec_giuong_ngu_694e",
              kind: "prop",
              version: "0.1.0",
              tags: ["giường ngủ", "gối"],
              createdBy: "claude-code",
              status: "candidate",
              hasPreview: true,
            },
            {
              assetId: "prop_server",
              kind: "prop",
              version: "0.1.0",
              tags: ["máy chủ"],
              createdBy: "claude-code",
              status: "approved",
              hasPreview: false,
            },
            {
              assetId: "bg_room",
              kind: "background",
              version: "0.1.0",
              tags: ["phòng"],
              createdBy: "claude-code",
              status: "approved",
              hasPreview: false,
            },
            {
              assetId: "action_wave",
              kind: "action",
              version: "0.1.0",
              tags: ["chào"],
              createdBy: "claude-code",
              status: "approved",
              hasPreview: false,
            },
          ],
        });
      if (path.startsWith("/api/motion-assets/") && path.endsWith("/preview"))
        return png(route, join(REPO, "data", "motion-assets", "prop_chiec_giuong_ngu_694e.png"));
      if (path.startsWith(`/api/artifacts/${IDS.board}/stills/`)) {
        const scene = path.split("/").at(-1) ?? "";
        const index = ["mo-dau", "dat-van-de", "su-that"].indexOf(scene);
        return png(
          route,
          join(KIT, "05_STORYBOARD_SAMPLES", "png", `${STILLS[Math.max(0, index)]}.png`),
        );
      }
      const artifact = (id: string, type: string, schemaVersion: string, content: unknown) =>
        json(route, {
          artifact: {
            id,
            projectId: IDS.p1,
            workflowRunId: IDS.run1,
            type,
            version: 1,
            schemaVersion,
            contentHash: "c".repeat(64),
            metadata: {},
            createdAt: NOW,
          },
          content,
        });
      if (path === `/api/artifacts/${IDS.script}`)
        return artifact(IDS.script, "script", "2", {
          variants: [
            variant("Thức khuya, não không kịp dọn phòng"),
            variant("Cuộc chiến với chiếc điện thoại"),
          ],
        });
      if (path === `/api/artifacts/${IDS.board}`)
        return artifact(IDS.board, "storyboard", "2", {
          schemaVersion: 2,
          scriptArtifactId: IDS.script,
          variants: [1, 2].map((variantIndex) => ({
            variantIndex,
            scenes: ["mo-dau", "dat-van-de", "su-that"].map((sceneId, i) => ({
              sceneId,
              shotId: `s${i + 1}`,
              stillKey: `x-${sceneId}.png`,
              issues: [],
            })),
          })),
          errors: [],
        });
      if (path === `/api/artifacts/${IDS.qa}`)
        return artifact(IDS.qa, "qa_report", "1", {
          schemaVersion: 1,
          previewArtifactId: IDS.preview,
          passed: s.qaPassed !== false,
          checks:
            s.qaPassed === false
              ? [
                  {
                    code: "caption_gap",
                    severity: "error",
                    message: "Cảnh 4 không có phụ đề trong 3,2 giây.",
                  },
                  {
                    code: "long_silence",
                    severity: "warning",
                    message: "Khoảng lặng 1,8 giây trước cú chốt.",
                  },
                ]
              : [
                  {
                    code: "long_silence",
                    severity: "warning",
                    message: "Khoảng lặng 1,1 giây ở cảnh 2.",
                  },
                ],
        });
      if (path === `/api/artifacts/${IDS.kit}`)
        return artifact(IDS.kit, "publish_kit", "1", PUBLISH_KIT);
      if (path === `/api/artifacts/${IDS.preview}`)
        return artifact(IDS.preview, "preview", "1", null);
      if (path.endsWith("/media")) return route.fulfill({ status: 404, body: "" });
      return json(route, { error: { code: "not_found", message: "mock", details: {} } }, 404);
    },
  );
}
