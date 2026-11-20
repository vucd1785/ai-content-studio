/**
 * Nhập cờ quốc gia từ gói `flag-icons` (MIT) vào kho hình động (ADR-029). Chạy lại khi nâng version gói:
 *   pnpm --dir packages/motion-kit exec tsx scripts/import-flags.mts
 * Ghi: `src/assets/prop/flag_<mã>/{index.ts,asset.json}`, `src/assets/flags.generated.ts`, `src/assets/LICENSE.flag-icons`.
 * Chỉ lấy mã ISO 3166-1 (cờ quốc gia); bỏ cờ vùng, tổ chức.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const here = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const kit = join(here, "..");
const require = createRequire(join(kit, "package.json"));
const pkgDir = dirname(require.resolve("flag-icons/package.json"));
const version = (
  JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")) as { version: string }
).version;

type Country = { code: string; name: string; iso: boolean; continent?: string };
const countries = (
  JSON.parse(readFileSync(join(pkgDir, "country.json"), "utf8")) as Country[]
).filter((c) => c.iso && /^[a-z]{2}$/.test(c.code));

/** Tên tiếng Việt quen dùng; nước không có ở đây giữ tên tiếng Anh (thường cũng là cách viết tiếng Việt). */
const VI: Record<string, string> = {
  vn: "Việt Nam",
  cn: "Trung Quốc",
  jp: "Nhật Bản",
  kr: "Hàn Quốc",
  kp: "Triều Tiên",
  la: "Lào",
  kh: "Campuchia",
  th: "Thái Lan",
  mm: "Myanmar",
  my: "Malaysia",
  sg: "Singapore",
  id: "Indonesia",
  ph: "Philippines",
  bn: "Brunei",
  tl: "Đông Timor",
  in: "Ấn Độ",
  pk: "Pakistan",
  bd: "Bangladesh",
  np: "Nepal",
  lk: "Sri Lanka",
  mn: "Mông Cổ",
  tw: "Đài Loan",
  hk: "Hồng Kông",
  af: "Afghanistan",
  ir: "Iran",
  iq: "Iraq",
  sa: "Ả Rập Xê Út",
  ae: "Các Tiểu vương quốc Ả Rập Thống nhất",
  il: "Israel",
  tr: "Thổ Nhĩ Kỳ",
  qa: "Qatar",
  kw: "Kuwait",
  jo: "Jordan",
  sy: "Syria",
  lb: "Liban",
  ru: "Nga",
  ua: "Ukraina",
  by: "Belarus",
  pl: "Ba Lan",
  de: "Đức",
  fr: "Pháp",
  gb: "Anh",
  ie: "Ireland",
  es: "Tây Ban Nha",
  pt: "Bồ Đào Nha",
  it: "Ý",
  nl: "Hà Lan",
  be: "Bỉ",
  ch: "Thụy Sĩ",
  at: "Áo",
  se: "Thụy Điển",
  no: "Na Uy",
  fi: "Phần Lan",
  dk: "Đan Mạch",
  is: "Iceland",
  gr: "Hy Lạp",
  cz: "Séc",
  sk: "Slovakia",
  hu: "Hungary",
  ro: "Romania",
  bg: "Bulgaria",
  rs: "Serbia",
  hr: "Croatia",
  si: "Slovenia",
  ee: "Estonia",
  lv: "Latvia",
  lt: "Litva",
  us: "Mỹ",
  ca: "Canada",
  mx: "Mexico",
  cu: "Cuba",
  br: "Brazil",
  ar: "Argentina",
  cl: "Chile",
  pe: "Peru",
  co: "Colombia",
  ve: "Venezuela",
  ec: "Ecuador",
  bo: "Bolivia",
  py: "Paraguay",
  uy: "Uruguay",
  au: "Úc",
  nz: "New Zealand",
  eg: "Ai Cập",
  za: "Nam Phi",
  ng: "Nigeria",
  ke: "Kenya",
  et: "Ethiopia",
  ma: "Ma-rốc",
  dz: "Algeria",
  tn: "Tunisia",
  gh: "Ghana",
  sn: "Senegal",
  tz: "Tanzania",
  cd: "Cộng hòa Dân chủ Congo",
  ao: "Angola",
  mg: "Madagascar",
  kz: "Kazakhstan",
  uz: "Uzbekistan",
  ge: "Gruzia",
  am: "Armenia",
  az: "Azerbaijan",
  va: "Vatican",
  mc: "Monaco",
  lu: "Luxembourg",
  mt: "Malta",
  cy: "Síp",
};

/** Tên tiếng Việt dễ trùng từ thường gặp: không dùng làm tag trần. */
const AMBIGUOUS = new Set(["Anh", "Mỹ", "Pháp", "Đức", "Ý", "Áo", "Bỉ", "Séc", "Síp"]);

const assetsDir = join(kit, "src", "assets");
const imports: string[] = [];
const entries: string[] = [];
for (const c of countries) {
  const id = `flag_${c.code}`;
  const dir = join(assetsDir, "prop", id);
  mkdirSync(dir, { recursive: true });
  const svg = readFileSync(join(pkgDir, "flags", "4x3", `${c.code}.svg`), "utf8")
    .replace(/<\?xml[^>]*\?>/g, "")
    .replace(/\s*\n\s*/g, " ")
    .trim();
  const vi = VI[c.code] ?? c.name;
  writeFileSync(
    join(dir, "index.ts"),
    `import { flagProp } from "../../../stage/flag.js";\n\n/** Cờ ${vi} (flag-icons ${version}, MIT). Sinh bởi scripts/import-flags.mts, không sửa tay. */\nexport const asset = flagProp(${JSON.stringify(c.code)}, ${JSON.stringify(svg)});\n`,
  );
  // Tên tiếng Việt một âm tiết trùng từ thường gặp ("anh ấy", "phương pháp", "lưu ý", "đạo đức") chỉ khớp khi đi
  // kèm "nước", "cờ", "người"; tên khác khớp cả tên trần.
  const bare = AMBIGUOUS.has(vi) ? [] : [vi];
  const tags = [
    ...new Set([`cờ ${vi}`, `nước ${vi}`, `người ${vi}`, ...bare, c.name, `quốc kỳ ${vi}`]),
  ];
  writeFileSync(
    join(dir, "asset.json"),
    `${JSON.stringify(
      {
        id,
        kind: "prop",
        version: "0.1.0",
        description: `Lá cờ ${vi} bay trên cột cờ. Hình cờ lấy từ nguồn có sẵn (flag-icons), đúng chi tiết; dùng khi nhắc tới nước ${vi}.`,
        tags,
        brandProfile: null,
        createdBy: "director",
        status: "approved",
        requestKey: null,
        licenses: [
          {
            name: "MIT",
            source: `flag-icons ${version} (github.com/lipis/flag-icons)`,
            file: "LICENSE.flag-icons",
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  const name = `flag${c.code.toUpperCase()}`;
  imports.push(`import { asset as ${name} } from "./prop/${id}/index.js";`);
  entries.push(`  ${id}: ${name},`);
}
writeFileSync(
  join(assetsDir, "flags.generated.ts"),
  `/** Cờ quốc gia từ flag-icons ${version} (MIT), ADR-029. Sinh bởi scripts/import-flags.mts, không sửa tay. */\nimport type { PropAsset } from "../stage/types.js";\n${imports.join("\n")}\n\nexport const FLAG_ASSETS: Record<string, PropAsset> = {\n${entries.join("\n")}\n};\n`,
);
copyFileSync(join(pkgDir, "LICENSE"), join(assetsDir, "LICENSE.flag-icons"));
console.log(`nhập ${countries.length} cờ từ flag-icons ${version}`);
