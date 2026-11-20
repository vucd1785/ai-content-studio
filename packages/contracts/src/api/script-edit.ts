import { z } from "zod/v4";
import { normalizedWords, normalizeWord } from "../script/words.js";

/**
 * Sửa câu thoại tại Cổng 1 (ADR-020): Director đổi chữ trong câu mà không gọi lại LLM. Route ghi một phiên bản
 * script mới (cùng shot, cùng yêu cầu tài sản), không ghi `approved`; Director vẫn bấm duyệt như thường.
 */
export const scriptLineEditsBodySchema = z
  .object({
    artifactId: z.uuid(),
    variantIndex: z.union([z.literal(1), z.literal(2)]),
    edits: z
      .array(
        z
          .object({
            lineId: z.string().min(1).max(40),
            text: z.string().trim().min(1).max(300),
          })
          .strict(),
      )
      .min(1)
      .max(60),
  })
  .strict();
export type ScriptLineEditsBody = z.infer<typeof scriptLineEditsBodySchema>;

export const scriptLineEditsResponseSchema = z
  .object({
    artifactId: z.uuid(),
    version: z.number().int().positive(),
    /** Shot có từ cắt cảnh không còn trong câu mới: đổi sang từ đầu câu. */
    retargetedShots: z.array(z.object({ shotId: z.string(), cutOnWord: z.string() }).strict()),
  })
  .strict();
export type ScriptLineEditsResponse = z.infer<typeof scriptLineEditsResponseSchema>;

type EditableVariant = {
  scenes: {
    lines: { id: string; text: string }[];
    shots: { id: string; lineId: string; cutOnWord: string }[];
  }[];
};

/** Từ đầu tiên của câu còn chữ sau khi bỏ dấu câu, giữ nguyên cách viết để khớp alignment. */
function firstWord(text: string): string | null {
  for (const raw of text.split(/\s+/)) {
    const word = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (normalizeWord(word) !== "") {
      return word;
    }
  }
  return null;
}

/**
 * Áp các câu đã sửa vào một phương án (hàm thuần, không đổi đầu vào). Id câu lạ trả trong `unknownLineIds`.
 * Shot neo vào câu đã sửa mà `cutOnWord` không còn trong câu thì đổi sang từ đầu câu.
 */
export function applyScriptLineEdits<T extends EditableVariant>(
  variant: T,
  edits: readonly { lineId: string; text: string }[],
): { variant: T; retargeted: { shotId: string; cutOnWord: string }[]; unknownLineIds: string[] } {
  const byId = new Map(edits.map((e) => [e.lineId, e.text.trim()]));
  const known = new Set(variant.scenes.flatMap((s) => s.lines.map((l) => l.id)));
  const unknownLineIds = [...byId.keys()].filter((id) => !known.has(id));
  const retargeted: { shotId: string; cutOnWord: string }[] = [];
  const scenes = variant.scenes.map((scene) => {
    const lines = scene.lines.map((line) => {
      const text = byId.get(line.id);
      return text === undefined ? line : { ...line, text };
    });
    const shots = scene.shots.map((shot) => {
      const text = byId.get(shot.lineId);
      if (text === undefined) {
        return shot;
      }
      if (normalizedWords(text).includes(normalizeWord(shot.cutOnWord))) {
        return shot;
      }
      const word = firstWord(text);
      if (word === null) {
        return shot;
      }
      retargeted.push({ shotId: shot.id, cutOnWord: word });
      return { ...shot, cutOnWord: word };
    });
    return { ...scene, lines, shots };
  });
  return { variant: { ...variant, scenes }, retargeted, unknownLineIds };
}
