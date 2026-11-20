import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  type AssetLicense,
  type AssetManifest,
  listManifests,
  rewriteGeneratedRegistry,
  writeAssetFiles,
} from "../generate/registry.js";

const run = promisify(execFile);

/** Cạnh dài nhất sau khi thu nhỏ (ADR-032: 1280, trước 900): ảnh phóng to trong minh họa vẫn nét. */
export const IMAGE_MAX_EDGE = 1280;
/** Ảnh vào quá lớn thì từ chối trước khi giải mã. */
export const IMAGE_MAX_INPUT_BYTES = 10 * 1024 * 1024;

export type NormalizedImage = { data: Buffer; width: number; height: number };

/** Loại ảnh theo chữ ký đầu file (ADR-030); chỉ nhận PNG, JPEG, WebP. */
export function sniffImage(buffer: Buffer): "png" | "jpg" | "webp" | null {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

/**
 * Chuẩn hóa ảnh bằng ffmpeg: một khung, cạnh dài tối đa `IMAGE_MAX_EDGE`, xuất WebP. Giải mã lại từ đầu nên siêu dữ
 * liệu và nội dung lạ trong file gốc không đi theo. Chỉ nhận PNG, JPEG, WebP đã sniff chữ ký.
 */
export async function normalizeImage(input: Buffer, tmpDir: string): Promise<NormalizedImage> {
  const kind = sniffImage(input);
  if (kind === null) {
    throw new Error("không phải ảnh PNG, JPEG hay WebP");
  }
  if (input.length > IMAGE_MAX_INPUT_BYTES) {
    throw new Error("ảnh quá lớn");
  }
  await mkdir(tmpDir, { recursive: true });
  const id = randomUUID();
  const src = join(tmpDir, `${id}.${kind}`);
  // Tên khác file vào: ảnh WebP vào cùng đuôi, ffmpeg không đọc và ghi cùng một file.
  const out = join(tmpDir, `${id}-out.webp`);
  try {
    await writeFile(src, input);
    await run(
      "ffmpeg",
      [
        "-v",
        "error",
        "-y",
        "-i",
        src,
        "-frames:v",
        "1",
        "-vf",
        `scale='if(gt(iw,ih),min(${IMAGE_MAX_EDGE},iw),-2)':'if(gt(iw,ih),-2,min(${IMAGE_MAX_EDGE},ih))'`,
        "-c:v",
        "libwebp",
        "-quality",
        "82",
        out,
      ],
      { timeout: 60_000 },
    );
    const probe = await run(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-of",
        "csv=p=0",
        out,
      ],
      { timeout: 30_000 },
    );
    const [w, h] = probe.stdout.trim().split(",").map(Number);
    if (!w || !h) {
      throw new Error("không đọc được kích thước ảnh");
    }
    return { data: await readFile(out), width: w, height: h };
  } finally {
    await rm(src, { force: true });
    await rm(out, { force: true });
  }
}

/** Id tài sản ảnh thật: `photo_<vài chữ của mô tả>_<hash>`, không trùng id có sẵn. */
export function proposePhotoId(
  description: string,
  seed: string,
  taken: ReadonlySet<string>,
): string {
  const words = description
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .replace(/[đĐ]/gu, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 1)
    .slice(0, 3)
    .join("_");
  const hash = createHash("sha1").update(seed).digest("hex").slice(0, 6);
  let id = `photo_${words || "anh"}_${hash}`.slice(0, 60);
  for (let n = 2; taken.has(id); n++) {
    id = `photo_${words || "anh"}_${hash}${n}`.slice(0, 64);
  }
  return id;
}

export type ImageAssetInput = {
  description: string;
  tags: string[];
  status: "candidate" | "approved";
  /** Khóa nguồn để không tạo trùng: `ref:<referenceId>` (ảnh tải lên) hoặc khóa yêu cầu của run (Commons). */
  requestKey: string;
  brandProfile: string | null;
  licenses: AssetLicense[];
  image: NormalizedImage;
};

/**
 * Ghi ảnh thật thành tài sản `prop` trong kho (ADR-030) và đăng ký vào `generated.ts`. Mã do worker viết, không do
 * model sinh, nên không qua kiểm AST; ảnh nằm trong mã dạng data URI WebP.
 */
export function writeImageAsset(kitSrc: string, input: ImageAssetInput): string {
  const existing = listManifests(kitSrc).find((m) => m.requestKey === input.requestKey);
  if (existing !== undefined) {
    return existing.id;
  }
  const taken = new Set(listManifests(kitSrc).map((m) => m.id));
  const id = proposePhotoId(input.description, input.requestKey, taken);
  const href = `data:image/webp;base64,${input.image.data.toString("base64")}`;
  const code = [
    `import { imageProp } from "../../../stage/image-prop.js";`,
    "",
    `/** Ảnh thật (ADR-030): ${input.description.replace(/\*\//g, "* /").slice(0, 160)} */`,
    `export const asset = imageProp(${JSON.stringify(id)}, ${JSON.stringify(href)}, ${input.image.width}, ${input.image.height});`,
    "",
  ].join("\n");
  const manifest: AssetManifest = {
    id,
    kind: "prop",
    version: "0.1.0",
    description: input.description,
    tags: input.tags,
    brandProfile: input.brandProfile,
    createdBy: "director",
    status: input.status,
    requestKey: input.requestKey,
    licenses: input.licenses,
  };
  writeAssetFiles(kitSrc, manifest, code);
  rewriteGeneratedRegistry(kitSrc);
  return id;
}
