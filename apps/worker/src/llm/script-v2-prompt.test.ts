import { type FormatPack, getFormatPack, scriptV2ArtifactSchema } from "@studio/contracts";
import { describe, expect, it } from "vitest";
import { loadApprovedAssetCatalog } from "./asset-catalog.js";
import {
  buildScriptV2Prompt,
  type CastProfile,
  decodeFlatScriptV2,
  type ScriptV2GenerationInput,
  scriptV2GenerationSchema,
} from "./script-v2-prompt.js";

const WHAT_IF = getFormatPack("what_if", 1) as FormatPack;
const CAST: CastProfile[] = [
  {
    characterKey: "ti",
    speaks: true,
    displayName: "Tí",
    role: "protagonist",
    personality: "Tò mò, hấp tấp.",
    catchphrases: [],
  },
  {
    characterKey: "bit",
    speaks: true,
    displayName: "Bit",
    role: "explainer",
    personality: "Bình tĩnh, giỏi giải thích.",
    catchphrases: ["Khoan đã."],
  },
  {
    characterKey: "dau",
    speaks: false,
    displayName: "Đậu",
    role: "companion",
    personality: "Phản ứng bằng biểu cảm.",
    catchphrases: [],
  },
];
const catalog = loadApprovedAssetCatalog("kenh-mac-dinh");

const input = (mode: "standard" | "creative" = "standard"): ScriptV2GenerationInput => ({
  brief: {
    topic: "Nếu như con người không cần ngủ?",
    audience: "Học sinh",
    goal: "Vui",
    durationSec: 45,
    language: "vi",
    tone: "hài",
    visualStyle: "hoạt hình",
  },
  format: WHAT_IF,
  cast: CAST,
  assetCatalog: catalog,
  mode,
  toneRules: "Thân thiện, câu ngắn.",
  researchSources: [{ id: "src1", title: "Nghiên cứu", url: "https://example.org" }],
});

/** Đếm số tầng mảng-chứa-object lồng nhau sâu nhất (P6-01: Gemini từ chối từ tầng thứ 3). */
function objectArrayDepth(node: unknown): number {
  if (node === null || typeof node !== "object") {
    return 0;
  }
  const record = node as Record<string, unknown>;
  const own =
    record.type === "array" && (record.items as { type?: string } | undefined)?.type === "object"
      ? 1
      : 0;
  const children = Object.values(record).map(objectArrayDepth);
  return own + Math.max(0, ...children);
}

describe("kho tài sản cho prompt", () => {
  it("đọc manifest approved của motion kit", () => {
    // 22 tài sản của P6-05 và 8 đồ vật của P6-19; tài sản tự tạo đã duyệt ở Cổng 1 (ADR-017) cộng thêm.
    expect(catalog.length).toBeGreaterThanOrEqual(30);
    expect(catalog.map((a) => a.kind)).toContain("background");
    expect(catalog.filter((a) => a.kind === "prop").length).toBeGreaterThanOrEqual(8);
    expect(catalog.find((a) => a.id === "bg_classroom")?.description).toContain("Lớp học");
  });
});

describe("prompt và schema sinh script v2", () => {
  it("prompt có gói, nhịp, nhịp cắt, dàn nhân vật, giọng điệu, kho tài sản; không chữ phủ hay bảng", () => {
    const prompt = buildScriptV2Prompt(input());
    for (const text of [
      "what_if",
      "cold_open",
      "fact: Sự thật có nguồn (must cite",
      "20-27 shots per minute",
      "about 15-20 shots",
      '"Đậu" (companion, never speaks)',
      "Khoan đã.",
      "Thân thiện, câu ngắn.",
      "bg_classroom",
      "src1",
      "prop_server_overload",
      "A standing prop takes one character spot: actors plus standing props are at most 3 in wide or high and 2 in medium",
      // ADR-023: tông ánh sáng theo cảm xúc của cảnh.
      "Lighting: give every shot a mood",
      // ADR-024: luật dựng hình.
      "Reaction shots: in a dialogue, do not always look at the speaker",
      "open each scene with a wide or high shot",
      // ADR-025: hiệu ứng điểm nhấn.
      "Effects are accents for key moments",
      "danger (problem, warning, tension)",
    ]) {
      expect(prompt, text).toContain(text);
    }
    // Bảng trắng minh họa (ADR-014 bổ sung 2026-11-11) chỉ có hình; không còn trường `board` của cảnh.
    expect(prompt).not.toMatch(/onScreenText|board:|"board"|codeSnippet|assetRequests/);
    expect(buildScriptV2Prompt(input("creative"))).toContain("assetRequests");
  });

  it("gói story v4 (ADR-026): mở bằng câu đọc tiêu đề trên hình tượng trưng, kết bằng cảnh mời theo dõi", () => {
    const v4 = getFormatPack("story", 4) as FormatPack;
    const prompt = buildScriptV2Prompt({ ...input(), format: v4 });
    expect(prompt).toContain("Opening (beat title)");
    expect(prompt).toContain("variant title read aloud");
    expect(prompt).toContain("Ending (beat outro)");
    expect(prompt).toContain("Follow chúng mình để biết thêm nhiều kiến thức thú vị nhé!");
    expect(prompt).not.toContain("Ending: the last scene");
    // Gói cũ giữ luật kết của ADR-020.
    const old = buildScriptV2Prompt(input());
    expect(old).toContain("Ending: the last scene");
    expect(old).not.toContain("Opening (beat title)");
  });

  it("danh mục có cờ (ADR-029): prompt dặn dùng cờ thật khi nhắc tên nước, không xin vẽ cờ", () => {
    // Danh mục mẫu đọc từ kho thật (có cả bộ cờ); bỏ cờ để so hai trường hợp.
    const full = input();
    const base = {
      ...full,
      assetCatalog: full.assetCatalog.filter((a) => !a.id.startsWith("flag_")),
    };
    const withFlags = buildScriptV2Prompt({
      ...base,
      assetCatalog: [
        ...base.assetCatalog,
        { id: "flag_cl", kind: "prop", description: "Lá cờ Chile", tags: ["cờ Chile"] },
      ],
    });
    expect(withFlags).toContain("show that country's real flag (flag_cl)");
    expect(withFlags).toContain("never ask for a new or hand-drawn flag");
    expect(buildScriptV2Prompt(base)).not.toContain("real flag");
  });

  it("ảnh thật (ADR-030): chế độ creative dặn đánh dấu real và searchQuery; ảnh Director tải lên được dặn dùng", () => {
    const creative = buildScriptV2Prompt(input("creative"));
    expect(creative).toContain("set real: true and searchQuery");
    expect(buildScriptV2Prompt(input())).not.toContain("set real: true");
    const withImages = buildScriptV2Prompt({
      ...input(),
      directorImageIds: ["photo_ban_do_chile_abc123"],
    });
    expect(withImages).toContain(
      "Director-provided pictures for this video (real images): photo_ban_do_chile_abc123",
    );
    const schema = JSON.stringify(scriptV2GenerationSchema(input("creative")));
    expect(schema).toContain('"real"');
    expect(schema).toContain('"searchQuery"');
  });

  it("schema sinh tối đa hai tầng mảng-chứa-object, id là enum lấy từ kho", () => {
    const schema = scriptV2GenerationSchema(input());
    expect(objectArrayDepth(schema)).toBe(2);
    const text = JSON.stringify(schema);
    expect(text).toContain('"bg_room"');
    expect(text).toContain('"prop_packets"');
    expect(text).not.toContain("onScreenText");
    expect(text).not.toContain("assetRequests");
    // Người nói chỉ gồm nhân vật có thoại; what_if không có narrator.
    expect(text).toContain('"enum":["ti","bit"]');
    expect(JSON.stringify(scriptV2GenerationSchema(input("creative")))).toContain("assetRequests");
  });

  it("giải mã flat thành script v2 lồng nhau mà contracts nhận", () => {
    const flat = {
      title: "A",
      sources: [{ id: "src1", title: "Nghiên cứu" }],
      scenes: [
        { id: "a", beat: "cold_open", sourceIds: [] },
        { id: "b", beat: "premise", sourceIds: [] },
        { id: "c", beat: "fun", sourceIds: [] },
        { id: "d", beat: "fact", sourceIds: ["src1"] },
        { id: "e", beat: "twist", sourceIds: [] },
      ],
      lines: ["a", "b", "c", "d", "e"].map((sceneId, i) => ({
        sceneId,
        id: `l${i + 1}`,
        speaker: i % 2 === 0 ? "ti" : "bit",
        text: "Chào bạn nhé",
      })),
      shots: ["a", "b", "c", "d", "e"].map((sceneId, i) => ({
        sceneId,
        id: `s${i + 1}`,
        lineId: `l${i + 1}`,
        cutOnWord: "Chào",
        background: "bg_room",
        shotSize: ["wide", "close", "medium", "high", "close"][i],
        focus: i % 2 === 0 ? "ti" : "bit",
        actor1: {
          character: i % 2 === 0 ? "ti" : "bit",
          action: "action_talk",
          expression: "expr_happy",
        },
      })),
    };
    const decoded = decodeFlatScriptV2({ variants: [flat, flat] }, WHAT_IF);
    const parsed = scriptV2ArtifactSchema({
      cast: CAST.map((c) => ({ characterKey: c.characterKey, speaks: c.speaks })),
      assetCatalog: catalog.map((a) => ({ id: a.id, kind: a.kind })),
      format: WHAT_IF,
      mode: "standard",
    }).safeParse(decoded);
    expect(parsed.success, JSON.stringify(parsed.error?.issues.slice(0, 3))).toBe(true);
    const scene = (
      decoded as { variants: { scenes: { lines: unknown[]; shots: { actors: unknown[] }[] }[] }[] }
    ).variants[0]?.scenes[0];
    expect(scene?.lines).toHaveLength(1);
    expect(scene?.shots[0]?.actors).toHaveLength(1);
  });

  it("JSON không đúng dạng thì trả nguyên để Zod báo lỗi cho lần repair", () => {
    expect(decodeFlatScriptV2({ nope: 1 }, WHAT_IF)).toEqual({ nope: 1 });
  });
});
