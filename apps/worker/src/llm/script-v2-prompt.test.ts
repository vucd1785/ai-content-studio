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
    expect(catalog.length).toBe(22);
    expect(catalog.map((a) => a.kind)).toContain("background");
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
    ]) {
      expect(prompt, text).toContain(text);
    }
    expect(prompt).not.toMatch(/onScreenText|board|assetRequests/);
    expect(buildScriptV2Prompt(input("creative"))).toContain("assetRequests");
  });

  it("schema sinh tối đa hai tầng mảng-chứa-object, id là enum lấy từ kho", () => {
    const schema = scriptV2GenerationSchema(input());
    expect(objectArrayDepth(schema)).toBe(2);
    const text = JSON.stringify(schema);
    expect(text).toContain('"bg_room"');
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
