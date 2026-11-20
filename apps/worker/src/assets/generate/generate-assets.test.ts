import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ScriptV2 } from "@studio/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveRepoRoot } from "../../cli/paths.js";
import type { StructuredGenerateClient } from "../../llm/structured-output.js";
import {
  type AssetRequestInput,
  isReusable,
  proposeAssetId,
  requestKeyFor,
  resolveAssetRequests,
  reuseMatch,
} from "./generate-assets.js";
import { buildGenerationPrompt, GENERATION_ROLE, GENERATION_SYSTEM_INSTRUCTION } from "./prompt.js";
import { checkAssetQuality, isSkyThing, qualityCriteria } from "./quality.js";
import {
  type AssetManifest,
  assetFileName,
  listManifests,
  readManifest,
  removeAsset,
  rewriteGeneratedRegistry,
  writeAssetFiles,
} from "./registry.js";
import { checkGeneratedSource, isAllowedImport } from "./static-check.js";
import { applyAssetSubstitutions } from "./substitute.js";

const GOOD_PROP = `import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import { wobble } from "../../../rig/math.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../../prop/prop_server/index.js";

const Bed: FC<PropProps> = ({ frame, seed }) => {
  const breathe = 4 * wobble(frame, seed, 40);
  return (
    <g>
      <ContactShadow halfWidth={80} />
      <rect x={-80} y={-120 - breathe} width={160} height={120} rx={16} fill={PALETTE.paper} stroke={PALETTE.ink} strokeWidth={6} />
      <rect x={-80} y={-40} width={160} height={40} rx={8} fill="#8a5a3c" stroke={PALETTE.ink} strokeWidth={6} />
      <rect x={-70} y={-110 - breathe} width={50} height={30} rx={12} fill="#ffffff" stroke={PALETTE.ink} strokeWidth={5} />
      <rect x={-20} y={-90 - breathe} width={95} height={50} rx={14} fill="#5aa9e6" stroke={PALETTE.ink} strokeWidth={5} />
      <circle cx={-60} cy={-112 - breathe} r={8} fill="#ffffff" opacity={0.5} />
      <circle cx={30} cy={-80 - breathe} r={10} fill="#ffffff" opacity={0.35} />
      <rect x={-20} y={-50 - breathe} width={95} height={10} fill="#2b2b3a" opacity={0.2} />
      <line x1={-76} y1={0} x2={-76} y2={-10} stroke={PALETTE.ink} strokeWidth={6} />
    </g>
  );
};

export const asset: PropAsset = { placement: "floor", halfWidth: 88, height: 140, Component: Bed };
`;

const BAD_PROP = GOOD_PROP.replace("const breathe", "fetch('x');\n  const breathe");

const repoRoot = resolveRepoRoot(import.meta.url);
let kitRoot = "";
let kitSrc = "";

beforeAll(() => {
  // Bản sao kho trong packages/motion-kit để typecheck tìm được kiểu React như kho thật.
  kitRoot = mkdtempSync(join(repoRoot, "packages", "motion-kit", ".test-kit-"));
  kitSrc = join(kitRoot, "src");
  cpSync(join(repoRoot, "packages", "motion-kit", "src"), kitSrc, { recursive: true });
  // Bản sao chỉ giữ tài sản làm tay: tài sản kho thật đã tự tạo không được làm lệch các ca thử.
  for (const m of listManifests(kitSrc).filter((x) => x.requestKey !== null)) {
    removeAsset(kitSrc, m.kind, m.id);
  }
  rewriteGeneratedRegistry(kitSrc);
  const config = JSON.parse(
    readFileSync(join(repoRoot, "packages", "motion-kit", "tsconfig.json"), "utf8"),
  ) as Record<string, unknown>;
  writeFileSync(
    join(kitRoot, "tsconfig.json"),
    JSON.stringify({ ...config, extends: "../../../tsconfig.base.json", include: ["src/**/*"] }),
  );
});

afterAll(() => {
  rmSync(kitRoot, { recursive: true, force: true });
});

const claudeReturning = (...codes: string[]): StructuredGenerateClient & { calls: number } => {
  const client = {
    calls: 0,
    async generateStructured() {
      const code = codes[Math.min(client.calls, codes.length - 1)] as string;
      client.calls += 1;
      return {
        jsonText: JSON.stringify({ description: "Giường ngủ êm", tags: ["giường", "ngủ"], code }),
        usage: {
          provider: "claude-code" as const,
          model: "fake",
          inputTokens: 1,
          outputTokens: 1,
          thinkingTokens: 0,
        },
      };
    },
  };
  return client;
};

const request = (over: Partial<AssetRequestInput> = {}): AssetRequestInput => ({
  variantIndex: 1,
  requestId: "r1",
  kind: "prop",
  description: "Chiếc giường ngủ có gối và chăn",
  sceneIds: ["c2"],
  fallbackAssetId: "prop_laptop",
  ...over,
});

describe("kiểm tĩnh code tài sản (ADR-017 mục 2.4)", () => {
  it("code mẫu hợp lệ qua kiểm", () => {
    expect(checkGeneratedSource(GOOD_PROP)).toEqual([]);
  });

  it("import tương đối so theo file được trỏ tới: prop viết ngắn ../prop_server vẫn hợp lệ, đi lệch thì chặn", () => {
    expect(isAllowedImport("../prop_server/index.js", "prop")).toBe(true);
    expect(isAllowedImport("../../prop/prop_server/index.js", "background")).toBe(true);
    expect(isAllowedImport("./../../../palette.js", "prop")).toBe(true);
    // Từ thư mục background, ../prop_server là background/prop_server: không phải module được phép.
    expect(isAllowedImport("../prop_server/index.js", "background")).toBe(false);
    // Không biết kind thì chỉ nhận đúng chữ.
    expect(isAllowedImport("../prop_server/index.js", null)).toBe(false);
    expect(isAllowedImport("../../../../../package.json", "prop")).toBe(false);
    expect(isAllowedImport("../../../rig/rig.js", "prop")).toBe(false);
    const shortImport = GOOD_PROP.replace(
      `import { wobble } from "../../../rig/math.js";`,
      `import { wobble } from "../../../rig/math.js";
import { ContactShadow } from "../prop_server/index.js";`,
    );
    expect(shortImport).toContain("../prop_server/index.js");
    expect(checkGeneratedSource(shortImport, "index.tsx", "prop")).toEqual([]);
  });

  it("chặn mạng, import lạ, chữ, truy cập chuỗi, Math.random, thiếu export", () => {
    const messages = (src: string) => checkGeneratedSource(src).map((i) => i.message);
    expect(messages(BAD_PROP)).toContain("định danh bị cấm: fetch");
    expect(messages(`import fs from "node:fs";\nexport const asset = 1;`)).toContain(
      "import không được phép: node:fs",
    );
    expect(messages(`const C = () => <text>hi</text>;\nexport const asset = C;`)).toContain(
      "phần tử bị cấm: <text>",
    );
    expect(
      messages(`const a = {}; const b = a["con" + "structor"];\nexport const asset = b;`),
    ).toContain("truy cập phần tử chỉ được dùng số hoặc biến");
    expect(messages(`export const asset = Math.random();`)).toContain(
      "không dùng Math.random; dùng rnd/wobble của motion kit",
    );
    expect(messages(`const x = "https://evil";\nexport const asset = x;`)).toContain(
      "không được có URL trong chuỗi",
    );
    expect(messages(`const asset = 1;`)).toContain("thiếu `export const asset`");
  });

  it("đồ vật quá rộng hoặc quá cao bị chặn để giữ luật khung", () => {
    const wide = GOOD_PROP.replace("halfWidth: 88", "halfWidth: 104").replace(
      "height: 140",
      "height: 400",
    );
    expect(checkGeneratedSource(wide, "index.tsx", "prop").map((i) => i.message)).toEqual([
      "halfWidth phải là số từ 40 đến 90; vẽ thu gọn trong khoảng đó",
      "height phải là số từ 1 đến 320",
    ]);
    expect(checkGeneratedSource(GOOD_PROP, "index.tsx", "prop")).toEqual([]);
  });
});

describe("giải yêu cầu tài sản (ADR-017 mục 2)", () => {
  it("tạo mới: qua kiểm, ghi candidate, đăng ký generated.ts", async () => {
    const claude = claudeReturning(GOOD_PROP);
    const checked: string[] = [];
    const [outcome] = await resolveAssetRequests(
      { topic: "giấc ngủ", runId: "run-1", requests: [request()] },
      {
        kitSrc,
        claude,
        renderCheck: async (a) => {
          checked.push(a.id);
          return null;
        },
      },
    );
    expect(outcome?.status).toBe("fulfilled");
    expect(outcome?.reused).toBe(false);
    const id = outcome?.assetId as string;
    expect(id).toMatch(/^prop_chiec_giuong_ngu_[0-9a-f]{4}$/);
    expect(checked).toEqual([id]);
    expect(readManifest(kitSrc, "prop", id)).toMatchObject({
      status: "candidate",
      createdBy: "claude-code",
      requestKey: "run-1:1:r1",
      tags: ["giường", "ngủ"],
    });
    expect(readFileSync(join(kitSrc, "assets", "generated.ts"), "utf8")).toContain(
      `import { asset as gen_${id} } from "./prop/${id}/index.js";`,
    );
  });

  it("ngưỡng dùng lại: một tag chung chung không đủ, hai tag khác nhau thì đủ (ADR-017 (3))", () => {
    const map: AssetManifest = {
      id: "bg_map",
      kind: "background",
      version: "0.1.0",
      description: "",
      tags: ["bản đồ thế giới", "sông Nile", "dòng sông", "dòng sông"],
      brandProfile: null,
      createdBy: "claude-code",
      status: "candidate",
      requestKey: null,
      licenses: [],
    };
    const delta = reuseMatch(map, "Đồng bằng sông Cửu Long: ruộng lúa, dòng sông chia nhánh");
    expect(delta).toEqual({ score: 2, tags: 1 });
    expect(isReusable(delta)).toBe(false);
    const race = reuseMatch(map, "Đường đua sông: bản đồ thế giới, sông Nile chảy qua sa mạc");
    expect(isReusable(race)).toBe(true);
  });

  it("lần sau dùng lại tài sản khớp tag, không gọi Claude", async () => {
    const claude = claudeReturning(GOOD_PROP);
    const [outcome] = await resolveAssetRequests(
      {
        topic: "giấc ngủ",
        runId: "run-2",
        requests: [request({ description: "Cái giường để ngủ trưa" })],
      },
      { kitSrc, claude, renderCheck: async () => null },
    );
    expect(outcome).toMatchObject({ status: "fulfilled", reused: true });
    expect(claude.calls).toBe(0);
  });

  it("code bị kiểm AST chặn cả hai lần: yêu cầu giữ open, không để lại thư mục", async () => {
    const claude = claudeReturning(BAD_PROP, BAD_PROP);
    const before = proposeAssetId("prop", "Máy pha cà phê bốc hơi", new Set());
    const [outcome] = await resolveAssetRequests(
      {
        topic: "cà phê",
        runId: "run-3",
        requests: [request({ description: "Máy pha cà phê bốc hơi" })],
      },
      { kitSrc, claude, renderCheck: async () => null },
    );
    expect(claude.calls).toBe(2);
    expect(outcome?.status).toBe("open");
    expect(outcome?.error).toMatch(/kiểm AST: định danh bị cấm: fetch/);
    expect(existsSync(join(kitSrc, "assets", "prop", before))).toBe(false);
  });

  it("render thử lỗi: bỏ tài sản và gỡ khỏi generated.ts", async () => {
    const claude = claudeReturning(GOOD_PROP, GOOD_PROP);
    const [outcome] = await resolveAssetRequests(
      { topic: "x", runId: "run-4", requests: [request({ description: "Ống kính thiên văn" })] },
      { kitSrc, claude, renderCheck: async () => "không thuần frame" },
    );
    expect(outcome?.status).toBe("open");
    expect(readFileSync(join(kitSrc, "assets", "generated.ts"), "utf8")).not.toContain("thien_van");
  });

  it("render thử ném lỗi ở một yêu cầu: yêu cầu đó open, yêu cầu sau vẫn được xử lý", async () => {
    let calls = 0;
    const outcomes = await resolveAssetRequests(
      {
        topic: "x",
        runId: "run-7",
        requests: [
          request({ requestId: "r1", description: "Kính lúp cổ" }),
          request({ requestId: "r2", description: "Đồng hồ cát" }),
        ],
      },
      {
        kitSrc,
        claude: claudeReturning(GOOD_PROP, GOOD_PROP, GOOD_PROP),
        renderCheck: async () => {
          calls += 1;
          if (calls <= 2) {
            throw new Error("Cannot find module index.tsx");
          }
          return null;
        },
      },
    );
    expect(outcomes.map((o) => [o.requestId, o.status])).toEqual([
      ["r1", "open"],
      ["r2", "fulfilled"],
    ]);
    expect(outcomes[0]?.error).toMatch(/Cannot find module/);
  });

  it("loại chưa hỗ trợ, chưa có Claude, vượt trần: giữ open có lý do", async () => {
    const outcomes = await resolveAssetRequests(
      {
        topic: "x",
        runId: "run-5",
        requests: [
          request({ requestId: "r1", kind: "camera", description: "Lia máy vòng quanh" }),
          request({ requestId: "r2", description: "Đèn ngủ hình mặt trăng" }),
        ],
      },
      { kitSrc, claude: null, renderCheck: async () => null },
    );
    expect(outcomes.map((o) => [o.status, o.error])).toEqual([
      ["open", "loại camera chưa tự tạo được"],
      ["open", "Claude Code chưa cấu hình"],
    ]);
    const capped = await resolveAssetRequests(
      { topic: "x", runId: "run-6", requests: [request({ description: "Cây xương rồng" })] },
      {
        kitSrc,
        claude: claudeReturning(GOOD_PROP),
        renderCheck: async () => null,
        maxNewAssets: 0,
      },
    );
    expect(capped[0]?.error).toBe("vượt trần 0 tài sản mới mỗi run");
  });
});

const YAWN = `import { easing } from "../../../rig/math.js";
import { type ActionClip, pose } from "../../../rig/pose.js";

const stretch = pose({ armA: [-150, 10], armB: [150, -10], tilt: -12, lean: -4 });

export const asset: ActionClip = {
  keys: [
    { frame: 0, pose: pose({}) },
    { frame: 8, pose: pose({ squash: 0.95 }), ease: easing.in },
    { frame: 20, pose: stretch, ease: easing.outBack(1.2) },
    { frame: 32, pose: pose({ ...stretch, tilt: -6 }) },
  ],
  cycle: { from: 20, to: 32 },
};
`;

describe("tự tạo hành động và tư thế (ADR-017 bổ sung 2026-11-10)", () => {
  it("hành động là dữ liệu khung khóa: qua kiểm, ghi index.ts, đăng ký action trong generated.ts", async () => {
    const checked: string[] = [];
    const [outcome] = await resolveAssetRequests(
      {
        topic: "giấc ngủ",
        runId: "run-a",
        requests: [
          request({
            kind: "action",
            description: "Ngáp dài vươn vai",
            fallbackAssetId: "action_talk",
          }),
        ],
      },
      {
        kitSrc,
        claude: claudeReturning(YAWN),
        renderCheck: async (a) => {
          checked.push(`${a.kind}:${a.id}`);
          return null;
        },
      },
    );
    expect(outcome?.status).toBe("fulfilled");
    const id = outcome?.assetId as string;
    expect(id).toMatch(/^action_ngap_dai_vuon_[0-9a-f]{4}$/);
    expect(checked).toEqual([`action:${id}`]);
    expect(existsSync(join(kitSrc, "assets", "action", id, "index.ts"))).toBe(true);
    // Render thử nạp đúng file này (lỗi 2026-11-11: nạp index.tsx cho hành động).
    expect(assetFileName("action")).toBe("index.ts");
    expect(readFileSync(join(kitSrc, "assets", "generated.ts"), "utf8")).toMatch(
      new RegExp(`action: \\{\\n    ${id}: gen_${id},`),
    );
  });

  it("hành động có JSX hoặc import lạ bị chặn ở kiểm AST", async () => {
    const bad = YAWN.replace(
      'import { easing } from "../../../rig/math.js";',
      'import fs from "node:fs";\nimport { easing } from "../../../rig/math.js";',
    );
    const [outcome] = await resolveAssetRequests(
      {
        topic: "x",
        runId: "run-b",
        requests: [
          request({ kind: "pose", description: "Gục đầu ngủ gật", fallbackAssetId: "pose_stand" }),
        ],
      },
      { kitSrc, claude: claudeReturning(bad, bad), renderCheck: async () => null },
    );
    expect(outcome?.status).toBe("open");
    expect(outcome?.error).toMatch(/import không được phép: node:fs/);
  });
});

describe("thay tài sản trong kịch bản", () => {
  it("chỉ thay trong cảnh được yêu cầu", () => {
    const shot = (id: string) => ({
      id,
      lineId: "l1",
      cutOnWord: "a",
      background: "bg_room",
      shotSize: "wide" as const,
      focus: "ti",
      props: ["prop_laptop"],
      actors: [{ character: "ti", action: "action_talk", expression: "expr_happy" }],
    });
    const script = {
      scenes: [
        { id: "c1", shots: [shot("s1")] },
        { id: "c2", shots: [shot("s2")] },
      ],
    } as unknown as ScriptV2;
    const out = applyAssetSubstitutions(script, [
      { sceneIds: ["c2"], fallbackAssetId: "prop_laptop", assetId: "prop_bed" },
    ]);
    expect(out.scenes.map((s) => s.shots[0]?.props)).toEqual([["prop_laptop"], ["prop_bed"]]);
  });

  it("minh họa nêu id yêu cầu: thay khi đã tạo, bỏ khi chưa có, bỏ cả minh họa nếu trống", () => {
    const shot = (id: string, items: string[]) => ({
      id,
      lineId: "l1",
      cutOnWord: "a",
      background: "bg_room",
      shotSize: "wide" as const,
      focus: "ti",
      actors: [{ character: "ti", action: "action_talk", expression: "expr_happy" }],
      illustration: { style: "board" as const, owner: "ti", items },
    });
    const script = {
      scenes: [{ id: "c1", shots: [shot("s1", ["r1", "prop_laptop", "r2"]), shot("s2", ["r2"])] }],
    } as unknown as ScriptV2;
    const out = applyAssetSubstitutions(script, [
      {
        sceneIds: ["c1"],
        fallbackAssetId: "prop_server",
        assetId: "prop_dam_may_1a2b",
        requestId: "r1",
      },
    ]);
    expect(out.scenes[0]?.shots[0]?.illustration?.items).toEqual([
      "prop_dam_may_1a2b",
      "prop_laptop",
    ]);
    expect(out.scenes[0]?.shots[1]?.illustration).toBeUndefined();
    // Không có yêu cầu nào xong: id yêu cầu vẫn bị bỏ.
    expect(applyAssetSubstitutions(script, []).scenes[0]?.shots[0]?.illustration?.items).toEqual([
      "prop_laptop",
    ]);
  });
});

const LOW_PROP = `import type { FC } from "react";
import { PALETTE } from "../../../palette.js";
import type { PropAsset, PropProps } from "../../../stage/types.js";
import { ContactShadow } from "../../prop/prop_server/index.js";

const Chair: FC<PropProps> = () => (
  <g>
    <ContactShadow halfWidth={60} />
    <rect x={-50} y={-100} width={100} height={100} fill={PALETTE.paper} />
  </g>
);

export const asset: PropAsset = { placement: "floor", halfWidth: 60, height: 100, Component: Chair };
`;

describe("tiêu chí chất lượng hình (ADR-022)", () => {
  it("hình đủ chi tiết, màu, khối, chuyển động, nét viền thì đạt; hình sơ sài thì thiếu", () => {
    expect(checkAssetQuality("prop", GOOD_PROP, "Chiếc giường ngủ có gối và chăn")).toEqual([]);
    expect(checkAssetQuality("prop", LOW_PROP, "Chiếc ghế gỗ").map((i) => i.id)).toEqual([
      "detail",
      "colors",
      "depth",
      "alive",
      "outline",
    ]);
  });

  it("vật trên trời có bóng đất thì thiếu; xét phần đầu mô tả, có dấu", () => {
    expect(
      checkAssetQuality("prop", GOOD_PROP, "Mặt trời tròn gắn trên cột").map((i) => i.id),
    ).toEqual(["sky"]);
    expect(isSkyThing("Đám mây trắng trôi")).toBe(true);
    expect(isSkyThing("Cái máy giặt cửa trước")).toBe(false);
    // Lăng kính trên bàn: tia nắng chỉ là phần tả cảnh phía sau.
    expect(
      isSkyThing("Một lăng kính tam giác trong suốt đứng trên chiếc bàn nhỏ. Tia nắng chiếu vào"),
    ).toBe(false);
  });

  it("bối cảnh phải có ba lớp chiều sâu; bối cảnh mẫu của kit đạt mọi tiêu chí (ADR-023)", () => {
    const realKit = join(import.meta.dirname, "../../../../../packages/motion-kit/src");
    const meadow = readFileSync(
      join(realKit, "assets", "background", "bg_meadow", "index.tsx"),
      "utf8",
    );
    expect(checkAssetQuality("background", meadow, "Đồng cỏ ban ngày")).toEqual([]);
    // Bối cảnh một lớp (kiểu cũ) thiếu tiêu chí lớp, nên không được dùng lại mà vẽ mới.
    const room = readFileSync(
      join(realKit, "assets", "background", "bg_room", "index.tsx"),
      "utf8",
    );
    expect(checkAssetQuality("background", room, "Căn phòng").map((i) => i.id)).toContain("layers");
    const prompt = buildGenerationPrompt(realKit, {
      kind: "background",
      description: "Cánh đồng có mây giông",
      suggestedId: "bg_canh_dong_aaaa",
      topic: "sấm chớp",
    });
    expect(prompt).toContain("{ stage: GENERATED_WIDE_BACKGROUND_STAGE, Far, Component, Near }");
    // Mẫu trong prompt là bối cảnh ba lớp của kit.
    expect(prompt).toContain("export const bgMeadow");
    for (const c of qualityCriteria("background")) {
      expect(prompt).toContain(c.rule);
    }
  });

  it("prompt có vai trò họa sĩ hoạt hình và từng tiêu chí; hành động không có tiêu chí hình", () => {
    expect(GENERATION_SYSTEM_INSTRUCTION.startsWith(GENERATION_ROLE)).toBe(true);
    // Đúng tên hàm easing và màu của kit, để Claude không đoán tên (easeInOutCubic, inOutSine).
    expect(GENERATION_SYSTEM_INSTRUCTION).toContain(
      "easing has only linear, inOut, out, in, outBack(s?)",
    );
    expect(GENERATION_SYSTEM_INSTRUCTION).toContain("PALETTE keys: ink, outline, paper, accent");
    expect(GENERATION_SYSTEM_INSTRUCTION).not.toMatch(/easeInOut|inOutSine/);
    const prompt = buildGenerationPrompt(kitSrc, {
      kind: "prop",
      description: "Cầu vồng",
      suggestedId: "prop_cau_vong_aaaa",
      topic: "cầu vồng",
    });
    expect(prompt).toContain("Quality bar");
    for (const c of qualityCriteria("prop")) {
      expect(prompt).toContain(c.rule);
    }
    expect(
      buildGenerationPrompt(kitSrc, {
        kind: "action",
        description: "vẫy tay",
        suggestedId: "action_vay_tay_aaaa",
        topic: "chào",
      }),
    ).not.toContain("Quality bar");
  });

  it("hình cũ khớp tag nhưng chưa đạt tiêu chí: không dùng lại, tạo mới bằng Claude", async () => {
    const stored: AssetManifest = {
      id: "prop_ghe_go_test",
      kind: "prop",
      version: "0.1.0",
      description: "Chiếc ghế gỗ nhỏ",
      tags: ["chiếc ghế", "ghế gỗ"],
      brandProfile: null,
      createdBy: "claude-code",
      status: "candidate",
      requestKey: "old:1:r1",
      licenses: [],
    };
    writeAssetFiles(kitSrc, stored, LOW_PROP);
    const description = "Chiếc ghế gỗ nhỏ có tựa lưng";
    expect(isReusable(reuseMatch(stored, description))).toBe(true);
    const claude = claudeReturning(GOOD_PROP);
    const logs: string[] = [];
    try {
      const [outcome] = await resolveAssetRequests(
        { topic: "đồ gỗ", runId: "run-q", requests: [request({ description })] },
        { kitSrc, claude, renderCheck: async () => null, log: (l) => logs.push(l) },
      );
      expect(outcome).toMatchObject({ status: "fulfilled", reused: false });
      expect(outcome?.assetId).not.toBe(stored.id);
      expect(claude.calls).toBe(1);
      expect(logs.join("\n")).toContain("không dùng lại prop_ghe_go_test, chưa đạt");
      removeAsset(kitSrc, "prop", outcome?.assetId as string);
    } finally {
      removeAsset(kitSrc, "prop", stored.id);
      rewriteGeneratedRegistry(kitSrc);
    }
  });

  it("hình mới chưa đạt tiêu chí: gửi lại Claude kèm tiêu chí thiếu, lần sau đạt thì nhận", async () => {
    const prompts: string[] = [];
    const codes = [LOW_PROP, GOOD_PROP];
    const claude: StructuredGenerateClient = {
      async generateStructured(req) {
        prompts.push(req.userPrompt);
        const code = codes[prompts.length - 1] as string;
        return {
          jsonText: JSON.stringify({ description: "Ghế", tags: ["ghế"], code }),
          usage: {
            provider: "claude-code" as const,
            model: "fake",
            inputTokens: 1,
            outputTokens: 1,
            thinkingTokens: 0,
          },
        };
      },
    };
    const [outcome] = await resolveAssetRequests(
      {
        topic: "đồ gỗ",
        runId: "run-q2",
        requests: [request({ description: "Cái bàn học có ngăn kéo" })],
      },
      { kitSrc, claude, renderCheck: async () => null },
    );
    expect(outcome?.status).toBe("fulfilled");
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("Quality bar not met");
    removeAsset(kitSrc, "prop", outcome?.assetId as string);
    rewriteGeneratedRegistry(kitSrc);
  });
});

describe("khóa yêu cầu tài sản (ADR-032)", () => {
  it("kịch bản viết lại trong cùng run không trùng khóa với kịch bản cũ", () => {
    const req = { variantIndex: 1 as const, requestId: "r3" };
    expect(requestKeyFor({ runId: "run-1" }, req)).toBe("run-1:1:r3");
    const a = requestKeyFor({ runId: "run-1", scriptArtifactId: "aaaaaaaa-1111" }, req);
    const b = requestKeyFor({ runId: "run-1", scriptArtifactId: "bbbbbbbb-2222" }, req);
    expect(a).toBe("run-1:aaaaaaaa:1:r3");
    expect(a).not.toBe(b);
  });
});
