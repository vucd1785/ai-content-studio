import { readFile, realpath } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { normalizeImage, writeImageAsset } from "./image-asset.js";

const IMAGE_KEY = /^uploads\/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$/;

export type ReferenceLike = { id: string; kind: string; uri: string; title: string | null };

const inside = (root: string, path: string) => path === root || path.startsWith(root + sep);

/**
 * Cách 1 của ADR-030: ảnh Director tải lên ở "Tài liệu tham khảo" thành tài sản `prop` `approved` của kênh, dùng
 * trong video như hình minh họa thật. Mỗi ảnh tạo một lần (khóa `ref:<referenceId>`). Ảnh hỏng thì bỏ qua và ghi
 * log, không làm hỏng job kịch bản. Trả id tài sản theo thứ tự tài liệu.
 */
export async function importReferenceImages(input: {
  dataDir: string;
  kitSrc: string;
  references: readonly ReferenceLike[];
  brandSlug: string;
  log?: (line: string) => void;
}): Promise<{ id: string; description: string }[]> {
  const out: { id: string; description: string }[] = [];
  const images = input.references.filter((r) => r.kind === "user_file" && IMAGE_KEY.test(r.uri));
  if (images.length === 0) {
    return out;
  }
  const dataReal = await realpath(input.dataDir);
  for (const ref of images) {
    try {
      const file = await realpath(resolve(input.dataDir, ref.uri));
      if (!inside(join(dataReal, "uploads"), file)) {
        throw new Error("đường dẫn ra ngoài thư mục uploads");
      }
      const title = (ref.title ?? "Ảnh Director cung cấp").slice(0, 120);
      const description = `Ảnh thật Director cung cấp: ${title}.`;
      const image = await normalizeImage(
        await readFile(file),
        join(input.dataDir, "tmp", "images"),
      );
      const id = writeImageAsset(input.kitSrc, {
        description,
        tags: [title, "ảnh thật", "ảnh Director cung cấp"],
        status: "approved",
        requestKey: `ref:${ref.id}`,
        brandProfile: input.brandSlug,
        licenses: [{ name: "Director cung cấp", source: "Tải lên trong dự án" }],
        image,
      });
      out.push({ id, description });
    } catch (error) {
      input.log?.(
        `ảnh tham khảo ${ref.id}: bỏ qua, ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return out;
}
