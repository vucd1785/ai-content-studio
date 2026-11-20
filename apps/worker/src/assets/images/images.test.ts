import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { imageCreditsFor } from "../../publish/image-credits.js";
import { fullFooter, shortFooter } from "../../publish/publish-text.js";
import { resolveAssetRequests } from "../generate/generate-assets.js";
import { readManifest } from "../generate/registry.js";
import { findCommonsImage, isFreeLicense, pickCandidate, plainText } from "./commons.js";
import { normalizeImage, sniffImage, writeImageAsset } from "./image-asset.js";
import { importReferenceImages } from "./reference-images.js";

let root = "";
let kitSrc = "";
let dataDir = "";

/** Ảnh PNG thật tạo bằng ffmpeg (màu đặc), để kiểm chuẩn hóa mà không cần file mẫu. */
function makePng(path: string, w: number, h: number) {
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=orange:s=${w}x${h}`,
    "-frames:v",
    "1",
    path,
  ]);
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "real-images-"));
  kitSrc = join(root, "kit", "src");
  mkdirSync(join(kitSrc, "assets", "prop"), { recursive: true });
  dataDir = join(root, "data");
  mkdirSync(join(dataDir, "uploads"), { recursive: true });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

const FAKE_IMAGE = { data: Buffer.from("RIFF0000WEBPfake"), width: 600, height: 400 };

describe("ảnh thật từ Wikimedia Commons (ADR-030)", () => {
  it("chỉ nhận giấy phép mở; bỏ thẻ HTML ở tên tác giả", () => {
    for (const l of ["pd", "PD-old", "cc0", "cc-by-4.0", "cc-by-sa-3.0", "CC BY-SA 4.0"]) {
      expect(isFreeLicense(l), l).toBe(true);
    }
    for (const l of ["", "fair use", "cc-by-nc-4.0", "cc-by-nd-4.0", "copyrighted"]) {
      expect(isFreeLicense(l), l).toBe(false);
    }
    expect(plainText('<a href="//x">Jane &amp; <b>Doe</b></a>')).toBe("Jane & Doe");
  });

  it("chọn ảnh có tên khớp từ khóa trước ảnh phong cảnh; bỏ giấy phép đóng, host lạ, ảnh có hạn chế", () => {
    const page = (index: number, title: string, over: Record<string, unknown> = {}) => ({
      index,
      title: `File:${title}`,
      imageinfo: [
        {
          thumburl: "https://upload.wikimedia.org/x/thumb.png",
          thumbmime: "image/png",
          width: 1200,
          descriptionurl: `https://commons.wikimedia.org/wiki/File:${title}`,
          extmetadata: {
            License: { value: "cc-by-sa-4.0" },
            LicenseShortName: { value: "CC BY-SA 4.0" },
            Artist: { value: "<a>Ana</a>" },
            Restrictions: { value: "" },
          },
          ...over,
        },
      ],
    });
    const picked = pickCandidate(
      [page(1, "Volcano in Chile.jpg"), page(4, "Chile location map.svg")],
      "Chile location map",
    );
    expect(picked?.title).toBe("Chile location map.svg");
    expect(picked?.author).toBe("Ana");
    expect(
      pickCandidate(
        [
          page(1, "Chile map a.png", { thumburl: "https://evil.example/x.png" }),
          page(2, "Chile map b.png", {
            extmetadata: { License: { value: "cc-by-nc-4.0" }, Restrictions: { value: "" } },
          }),
          page(3, "Chile map c.png", {
            extmetadata: { License: { value: "pd" }, Restrictions: { value: "trademarked" } },
          }),
        ],
        "Chile map",
      ),
    ).toBeNull();
  });

  it("gọi API và tải ảnh với User-Agent chung, không theo redirect; trả dòng ghi công", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.startsWith("https://commons.wikimedia.org/")) {
        return new Response(
          JSON.stringify({
            query: {
              pages: [
                {
                  index: 1,
                  title: "File:Eiffel Tower.jpg",
                  imageinfo: [
                    {
                      thumburl: "https://upload.wikimedia.org/eiffel.jpg",
                      thumbmime: "image/jpeg",
                      width: 2000,
                      descriptionurl: "https://commons.wikimedia.org/wiki/File:Eiffel_Tower.jpg",
                      extmetadata: {
                        License: { value: "cc-by-sa-3.0" },
                        LicenseShortName: { value: "CC BY-SA 3.0" },
                        Artist: { value: "Ben" },
                        Restrictions: { value: "" },
                      },
                    },
                  ],
                },
              ],
            },
          }),
          { headers: { "content-type": "application/json" } },
        );
      }
      return new Response(Buffer.from([0xff, 0xd8, 0xff, 0x00]), {
        headers: { "content-type": "image/jpeg" },
      });
    };
    const found = await findCommonsImage("Eiffel Tower", fake);
    expect(found?.license).toBe("CC BY-SA 3.0");
    expect(found?.attribution).toContain("Ben, CC BY-SA 3.0, Wikimedia Commons");
    expect(calls).toHaveLength(2);
    for (const c of calls) {
      expect(c.init.redirect).toBe("error");
      expect((c.init.headers as Record<string, string>)["user-agent"]).toMatch(
        /^AIContentStudio\//,
      );
    }
    expect(calls[0]?.url).toContain("gsrsearch=Eiffel+Tower");
  });
});

describe("ảnh thành tài sản trong kho (ADR-030)", () => {
  it("chuẩn hóa ảnh PNG thật về WebP cạnh dài ≤ 1280; từ chối thứ không phải ảnh", async () => {
    const src = join(root, "big.png");
    makePng(src, 2000, 1000);
    const out = await normalizeImage(readFileSync(src), join(root, "tmp"));
    expect(sniffImage(out.data)).toBe("webp");
    expect(out.width).toBe(1280);
    expect(out.height).toBe(640);
    await expect(normalizeImage(Buffer.from("<svg/>"), join(root, "tmp"))).rejects.toThrow();
    // ADR-032: ảnh web thường là WebP; chuẩn hóa lại một ảnh WebP không được ghi đè lên chính file vào.
    const again = await normalizeImage(out.data, join(root, "tmp"));
    expect(sniffImage(again.data)).toBe("webp");
    expect(again.width).toBe(1280);
  });

  it("ghi tài sản ảnh: imageProp + data URI, asset.json có giấy phép, đăng ký generated.ts, không tạo trùng", () => {
    const id = writeImageAsset(kitSrc, {
      description: "Bản đồ Chile thật",
      tags: ["Chile map", "ảnh thật"],
      status: "candidate",
      requestKey: "run-9:1:r2",
      brandProfile: null,
      licenses: [{ name: "CC BY-SA 4.0", source: "Wikimedia Commons", attribution: "Map – Ana" }],
      image: FAKE_IMAGE,
    });
    expect(id).toMatch(/^photo_ban_do_chile_[0-9a-f]{6}$/);
    const code = readFileSync(join(kitSrc, "assets", "prop", id, "index.tsx"), "utf8");
    expect(code).toContain("imageProp(");
    expect(code).toContain("data:image/webp;base64,");
    expect(readManifest(kitSrc, "prop", id)).toMatchObject({
      createdBy: "director",
      status: "candidate",
      licenses: [{ attribution: "Map – Ana" }],
    });
    expect(readFileSync(join(kitSrc, "assets", "generated.ts"), "utf8")).toContain(
      `./prop/${id}/index.js`,
    );
    expect(
      writeImageAsset(kitSrc, {
        description: "khác",
        tags: [],
        status: "candidate",
        requestKey: "run-9:1:r2",
        brandProfile: null,
        licenses: [],
        image: FAKE_IMAGE,
      }),
    ).toBe(id);
  });

  it("yêu cầu real: dùng ảnh thật thay vì Claude vẽ; không tìm được thì đi đường Claude như thường", async () => {
    const req = {
      variantIndex: 1 as const,
      requestId: "r3",
      kind: "prop",
      description: "Tháp Eiffel ở Paris",
      sceneIds: ["c2"],
      fallbackAssetId: "prop_laptop",
      real: true,
      searchQuery: "Eiffel Tower",
    };
    const queries: string[] = [];
    const [ok] = await resolveAssetRequests(
      { topic: "Paris", runId: "run-7", requests: [req] },
      {
        kitSrc,
        claude: null,
        renderCheck: async () => null,
        findRealImage: async ({ query }) => {
          queries.push(query);
          return {
            image: FAKE_IMAGE,
            licenses: [
              { name: "CC BY-SA 3.0", source: "Wikimedia Commons", attribution: "Eiffel – Ben" },
            ],
          };
        },
      },
    );
    expect(queries).toEqual(["Eiffel Tower"]);
    expect(ok?.status).toBe("fulfilled");
    expect(ok?.assetId).toMatch(/^photo_thap_eiffel_paris_/);
    const [none] = await resolveAssetRequests(
      { topic: "Paris", runId: "run-8", requests: [{ ...req, description: "Khải Hoàn Môn" }] },
      { kitSrc, claude: null, renderCheck: async () => null, findRealImage: async () => null },
    );
    expect(none?.status).toBe("open");
    expect(none?.error).toBe("Claude Code chưa cấu hình");
  });

  it("ảnh Director tải lên thành tài sản approved của kênh, mỗi ảnh một lần; file lạ bị bỏ qua", async () => {
    const good = "uploads/11111111-1111-1111-1111-111111111111.png";
    const bad = "uploads/22222222-2222-2222-2222-222222222222.png";
    makePng(join(dataDir, good), 400, 300);
    writeFileSync(join(dataDir, bad), "not an image");
    const logs: string[] = [];
    const refs = [
      { id: "ref-a", kind: "user_file", uri: good, title: "Bản đồ Chile" },
      { id: "ref-b", kind: "user_file", uri: bad, title: "hỏng" },
      {
        id: "ref-c",
        kind: "user_file",
        uri: "uploads/33333333-3333-3333-3333-333333333333.md",
        title: "x",
      },
    ];
    const first = await importReferenceImages({
      dataDir,
      kitSrc,
      references: refs,
      brandSlug: "kenh-a",
      log: (l) => logs.push(l),
    });
    expect(first).toHaveLength(1);
    expect(readManifest(kitSrc, "prop", first[0]?.id as string)).toMatchObject({
      status: "approved",
      brandProfile: "kenh-a",
      requestKey: "ref:ref-a",
      tags: ["Bản đồ Chile", "ảnh thật", "ảnh Director cung cấp"],
    });
    expect(logs.join("\n")).toContain("ref-b");
    const again = await importReferenceImages({
      dataDir,
      kitSrc,
      references: refs,
      brandSlug: "kenh-a",
    });
    expect(again.map((a) => a.id)).toEqual(first.map((a) => a.id));
  });
});

describe("ghi công ảnh thật trong bộ đăng bài (ADR-030)", () => {
  it("ảnh có trong video và giấy phép đòi ghi công thì có mục Nguồn hình ảnh; TikTok trỏ về mô tả YouTube", () => {
    const id = writeImageAsset(kitSrc, {
      description: "Núi Phú Sĩ",
      tags: [],
      status: "approved",
      requestKey: "run-c:1:r1",
      brandProfile: null,
      licenses: [
        {
          name: "CC BY 4.0",
          source: "Wikimedia Commons",
          attribution: '"Fuji.jpg" – Kai, CC BY 4.0',
        },
      ],
      image: FAKE_IMAGE,
    });
    const credits = imageCreditsFor(
      [{ props: [] }, { illustration: { items: [id, "prop_laptop"] } }, { props: [id] }],
      kitSrc,
    );
    expect(credits).toEqual(['"Fuji.jpg" – Kai, CC BY 4.0']);
    const ctx = {
      channelName: "Tí Hay Hỏi",
      copyrightContact: "x@example.org",
      videoTitle: "Núi",
      durationSec: 50,
      sources: [],
      imageCredits: credits,
    };
    expect(fullFooter(ctx)).toContain('NGUỒN HÌNH ẢNH\n- "Fuji.jpg" – Kai, CC BY 4.0');
    expect(fullFooter(ctx)).toContain("trừ các hình ảnh ghi ở mục Nguồn hình ảnh");
    expect(shortFooter(ctx)).toContain("Wikimedia Commons");
    expect(fullFooter({ ...ctx, imageCredits: [] })).not.toContain("NGUỒN HÌNH ẢNH");
  });
});
