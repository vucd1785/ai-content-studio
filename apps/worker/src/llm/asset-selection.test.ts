import { describe, expect, it } from "vitest";
import { loadApprovedAssetCatalog } from "./asset-catalog.js";
import { normalizeText, relevanceScore, selectRelevantAssets } from "./asset-selection.js";
import type { CatalogEntry } from "./script-v2-prompt.js";

const DDOS = [
  "Tấn công DDoS là gì: vì sao hàng nghìn máy bị chiếm quyền cùng gửi yêu cầu có thể làm sập một website",
  "Kẻ tấn công dùng botnet, router bị nhiễm mã độc. Máy chủ quá tải. Phòng chống: lọc lưu lượng, CDN, bảo vệ.",
  "Quán trà sữa bị hàng trăm người giả xếp hàng chặn cửa.",
];
const SLEEP = [
  "Thiếu ngủ ảnh hưởng tới cơ thể thế nào, vì sao ngủ bù cuối tuần không đủ, 3 thói quen giúp ngủ ngon hơn.",
  "Học sinh, sinh viên và người đi làm hay thức khuya lướt điện thoại.",
  "Bối cảnh phòng ngủ buổi tối, lớp học buổi sáng, quán cà phê.",
];

const entry = (id: string, kind: CatalogEntry["kind"], tags: string[]): CatalogEntry => ({
  id,
  kind,
  tags,
  description: "",
});

describe("chọn tài sản cho prompt (ADR-017 mục 1)", () => {
  it("so cả cụm từ, không khớp nửa từ; tag nhiều âm tiết nặng hơn", () => {
    const text = normalizeText("Máy chủ bị QUÁ TẢI, người dùng chờ.");
    expect(relevanceScore(entry("a", "prop", ["máy chủ", "quá tải"]), text)).toBe(4);
    expect(relevanceScore(entry("b", "prop", ["người"]), text)).toBe(1);
    expect(relevanceScore(entry("c", "prop", ["máy"]), normalizeText("máytính"))).toBe(0);
  });

  it("cờ quốc gia (ADR-029): tên nước một âm tiết cũng đủ điểm; brief về Chile có cờ Chile, Việt Nam trong danh mục", () => {
    const text = normalizeText(
      "Quốc gia nào dài nhất thế giới? Chile dài gấp hai lần rưỡi Việt Nam.",
    );
    expect(relevanceScore(entry("flag_cl", "prop", ["cờ Chile", "Chile"]), text)).toBe(2);
    expect(relevanceScore(entry("prop_x", "prop", ["Chile"]), text)).toBe(1);
    const catalog = loadApprovedAssetCatalog("kenh-mac-dinh");
    const { selected } = selectRelevantAssets(catalog, [
      "Quốc gia nào dài nhất thế giới?",
      "Chile dài khoảng 4.300 km; Việt Nam dài khoảng 1.650 km.",
    ]);
    const ids = selected.map((a) => a.id);
    expect(ids).toContain("flag_cl");
    expect(ids).toContain("flag_vn");
    expect(ids).not.toContain("flag_br");
    // Tên dễ trùng từ thường ("lưu ý", "phương pháp", "anh ấy") không kéo cờ Ý, Pháp, Anh vào.
    const common = selectRelevantAssets(catalog, [
      "Lưu ý phương pháp học: anh ấy chú ý từng chi tiết, có đạo đức.",
    ]).selected.map((a) => a.id);
    expect(common.filter((id) => id.startsWith("flag_"))).toEqual([]);
    // Nhiều đồ vật hợp chủ đề vẫn không đẩy cờ ra: cờ có suất riêng.
    const crowded = selectRelevantAssets(
      [
        ...Array.from({ length: 10 }, (_, i) => entry(`prop_p${i}`, "prop", ["chile dài"])),
        entry("flag_cl", "prop", ["cờ Chile", "Chile"]),
        entry("flag_vn", "prop", ["cờ Việt Nam", "Việt Nam"]),
      ],
      ["Chile dài hơn Việt Nam"],
    ).selected.map((a) => a.id);
    expect(crowded).toEqual(expect.arrayContaining(["flag_cl", "flag_vn"]));
  });

  it("đồ vật chỉ vào khi khớp đủ điểm; bối cảnh luôn có tối thiểu 3; diễn xuất lấy hết", () => {
    const catalog = [
      entry("bg_a", "background", ["rừng"]),
      entry("bg_b", "background", ["biển"]),
      entry("bg_c", "background", ["lớp học"]),
      entry("bg_d", "background", ["núi"]),
      entry("prop_x", "prop", ["người"]),
      entry("prop_y", "prop", ["máy chủ"]),
      entry("action_a", "action", ["đi"]),
    ];
    const { selected, omitted } = selectRelevantAssets(catalog, [
      "Một người ở lớp học nói về máy chủ",
    ]);
    expect(selected.map((a) => a.id)).toEqual(["action_a", "bg_a", "bg_b", "bg_c", "prop_y"]);
    expect(omitted).toEqual(["bg_d", "prop_x"]);
  });

  it("kho thật: brief DDoS giữ đồ vật mạng; brief giấc ngủ bỏ đồ vật mạng và cờ, prompt ngắn hơn", () => {
    const catalog = loadApprovedAssetCatalog("tinhoc-vui");
    const ddos = selectRelevantAssets(catalog, DDOS).selected.map((a) => a.id);
    expect(ddos).toEqual(
      expect.arrayContaining([
        "prop_server",
        "prop_server_overload",
        "prop_router_infected",
        "prop_queue_crowd",
        "prop_shield",
      ]),
    );
    const sleep = selectRelevantAssets(catalog, SLEEP);
    // Kho thật lớn dần (đồ vật tự tạo của các run, ADR-017): đồ vật hợp chủ đề giấc ngủ (cốc cà phê, điện thoại)
    // được chọn, nhưng đồ vật mạng và cờ quốc gia thì không.
    const sleepProps = sleep.selected.filter((a) => a.kind === "prop").map((a) => a.id);
    for (const id of ddos.filter((id) => id.startsWith("prop_server") || id === "prop_shield")) {
      expect(sleepProps).not.toContain(id);
    }
    expect(sleepProps.filter((id) => id.startsWith("flag_"))).toEqual([]);
    // Bối cảnh và mọi loại diễn xuất vẫn đủ để dựng cảnh.
    for (const kind of ["background", "action", "expression", "camera"] as const) {
      expect(sleep.selected.some((a) => a.kind === kind)).toBe(true);
    }
    expect(sleep.selected.length).toBeLessThan(catalog.length);
  });

  it("hòa điểm: bối cảnh gốc của kit trước bối cảnh tự tạo của chủ đề khác (2026-11-11)", () => {
    const entry = (id: string, generated = false): CatalogEntry => ({
      id,
      kind: "background",
      description: "",
      tags: ["không khớp"],
      ...(generated ? { generated: true } : {}),
    });
    const { selected } = selectRelevantAssets(
      [
        entry("bg_bai_bien_luc_e3f3", true),
        entry("bg_be_mat_mat_6d40", true),
        entry("bg_room"),
        entry("bg_classroom"),
        entry("bg_meadow"),
      ],
      ["Redis cache"],
    );
    expect(selected.map((a) => a.id)).toEqual(["bg_classroom", "bg_meadow", "bg_room"]);
  });
});
