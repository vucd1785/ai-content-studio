/**
 * Tên file tải về theo chủ đề video, không dấu, nối bằng gạch ngang (Director 2026-11-12):
 * "Vì sao đom đóm phát sáng?" → "vi-sao-dom-dom-phat-sang". Rỗng hoặc toàn ký tự lạ thì `fallback`.
 */
export function topicFileSlug(topic: string, fallback = "video", maxLength = 80): string {
  const slug = topic
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .replace(/[đĐ]/gu, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  // Cắt theo từ để không để lại nửa chữ ở cuối.
  const head = slug.slice(0, maxLength);
  const cut =
    slug.length <= maxLength || slug[maxLength] === "-"
      ? head.replace(/-+$/u, "")
      : head.replace(/-[^-]*$/u, "");
  return cut === "" ? fallback : cut;
}
