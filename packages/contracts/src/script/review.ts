/**
 * Tự phê bình kịch bản bằng luật (ADR-020): chạy được ở web và worker, không gọi LLM. Kết quả là gợi ý cho
 * Director ở Cổng 1, không chặn duyệt. Luật dựa trên điều người xem video ngắn cần: câu hỏi sớm, có hình khi
 * giải thích, bối cảnh thay đổi, câu ngắn đọc kịp, có nguồn đối chiếu.
 */

export type ScriptReviewCode =
  | "hook_late"
  | "explain_without_picture"
  | "same_background_run"
  | "long_line"
  | "few_sources"
  | "no_music"
  | "few_shot_sizes"
  | "no_reaction_shot"
  | "repeated_action";

export type ScriptReviewIssue = {
  code: ScriptReviewCode;
  /** `warning` nên sửa trước khi duyệt; `info` là gợi ý. */
  severity: "warning" | "info";
  message: string;
  sceneId?: string;
};

type ReviewableVariant = {
  music?: string;
  sources?: readonly unknown[];
  scenes: readonly {
    id: string;
    beat: string;
    lines: readonly { text: string; id?: string; speaker?: string }[];
    shots: readonly {
      background: string;
      props?: readonly string[];
      illustration?: unknown;
      shotSize?: string;
      lineId?: string;
      focus?: string;
      actors?: readonly { character: string; action: string }[];
    }[];
  }[];
};

/** Nhịp cần hình khi giải thích. */
const EXPLAIN_BEATS = new Set(["play", "fact", "fun"]);
/** Câu dài hơn mức này khó đọc kịp trên phụ đề hai dòng. */
export const REVIEW_LONG_LINE_CHARS = 110;
/** Số câu đầu video phải có câu hỏi hoặc câu gây tò mò. */
const HOOK_LINES = 2;
/** Luật dựng hình (ADR-024) chỉ xét khi video có từ ngần này shot. */
const EDITING_MIN_SHOTS = 6;
/** Video nên dùng ít nhất ngần này cỡ cảnh khác nhau. */
const MIN_SHOT_SIZES = 3;
/** Một nhân vật giữ nguyên một hành động quá ngần này shot liền nhau thì trông như đứng yên. */
const MAX_SAME_ACTION_RUN = 3;

export function reviewScriptV2(variant: ReviewableVariant): ScriptReviewIssue[] {
  const issues: ScriptReviewIssue[] = [];
  const opening = variant.scenes.flatMap((s) => s.lines).slice(0, HOOK_LINES);
  if (opening.length > 0 && !opening.some((l) => l.text.includes("?"))) {
    issues.push({
      code: "hook_late",
      severity: "warning",
      message:
        "Hai câu đầu chưa có câu hỏi. Video ngắn nên đặt câu hỏi chính trong 2 giây đầu để giữ người xem.",
    });
  }
  for (const scene of variant.scenes) {
    if (!EXPLAIN_BEATS.has(scene.beat)) {
      continue;
    }
    const pictured = scene.shots.some(
      (shot) => shot.illustration !== undefined || (shot.props ?? []).length > 0,
    );
    if (!pictured) {
      issues.push({
        code: "explain_without_picture",
        severity: "warning",
        message:
          "Cảnh giải thích nhưng không có đồ vật hay minh họa nào: người xem chỉ thấy nhân vật đứng nói.",
        sceneId: scene.id,
      });
    }
  }
  let run = 1;
  variant.scenes.forEach((scene, i) => {
    const bg = scene.shots[0]?.background;
    const prevBg = variant.scenes[i - 1]?.shots[0]?.background;
    run = i > 0 && bg !== undefined && bg === prevBg ? run + 1 : 1;
    if (run === 3) {
      issues.push({
        code: "same_background_run",
        severity: "info",
        message: "Ba cảnh liền nhau cùng một bối cảnh; đổi nền giúp mắt người xem đỡ chán.",
        sceneId: scene.id,
      });
    }
  });
  for (const scene of variant.scenes) {
    for (const line of scene.lines) {
      if (line.text.length > REVIEW_LONG_LINE_CHARS) {
        issues.push({
          code: "long_line",
          severity: "info",
          message: `Câu dài ${line.text.length} ký tự, phụ đề khó đọc kịp: "${line.text.slice(0, 40)}…"`,
          sceneId: scene.id,
        });
      }
    }
  }
  if ((variant.sources ?? []).length < 2) {
    issues.push({
      code: "few_sources",
      severity: "info",
      message: "Ít hơn 2 nguồn. Số liệu nên đối chiếu ít nhất hai nguồn trước khi đăng.",
    });
  }
  issues.push(...reviewEditing(variant));
  if (variant.music === undefined) {
    issues.push({
      code: "no_music",
      severity: "info",
      message: "Kịch bản chưa chọn nhạc nền; video sẽ dùng nhạc mặc định (Vui tươi).",
    });
  }
  return issues;
}

/**
 * Luật dựng hình (ADR-024): đủ cỡ cảnh, có shot nhìn người nghe, nhân vật không lặp một hành động quá lâu.
 * Chỉ là gợi ý (`info`). Kịch bản thiếu trường (bản cũ, test) thì bỏ qua luật cần trường đó.
 */
function reviewEditing(variant: ReviewableVariant): ScriptReviewIssue[] {
  const issues: ScriptReviewIssue[] = [];
  const shots = variant.scenes.flatMap((scene) => scene.shots.map((shot) => ({ shot, scene })));
  if (shots.length < EDITING_MIN_SHOTS) {
    return issues;
  }
  const sizes = new Set(shots.map(({ shot }) => shot.shotSize).filter((s) => s !== undefined));
  if (sizes.size > 0 && sizes.size < MIN_SHOT_SIZES) {
    issues.push({
      code: "few_shot_sizes",
      severity: "info",
      message: `Cả video chỉ dùng ${sizes.size} cỡ cảnh. Xen cỡ rộng, trung, cận và góc cao giúp hình đỡ đều đều.`,
    });
  }
  // Shot nhìn người nghe: nhân vật được lấy nét không phải người nói câu neo của shot.
  const judged = shots.filter(
    ({ shot, scene }) =>
      shot.focus !== undefined &&
      (shot.actors ?? []).length >= 2 &&
      scene.lines.some((l) => l.id === shot.lineId && l.speaker !== undefined),
  );
  const hasReaction = judged.some(
    ({ shot, scene }) => scene.lines.find((l) => l.id === shot.lineId)?.speaker !== shot.focus,
  );
  if (judged.length >= 3 && !hasReaction) {
    issues.push({
      code: "no_reaction_shot",
      severity: "info",
      message:
        "Mọi shot đều nhìn người đang nói. Thêm vài shot nhìn người nghe (ngạc nhiên, gật gù) để đoạn thoại sống hơn.",
    });
  }
  const run = new Map<string, { action: string; count: number }>();
  const flagged = new Set<string>();
  for (const { shot, scene } of shots) {
    const present = shot.actors ?? [];
    // Nhân vật vắng mặt ở shot này thì chuỗi của họ bắt đầu lại.
    for (const key of [...run.keys()]) {
      if (!present.some((a) => a.character === key)) {
        run.delete(key);
      }
    }
    for (const actor of present) {
      const prev = run.get(actor.character);
      const count = prev !== undefined && prev.action === actor.action ? prev.count + 1 : 1;
      run.set(actor.character, { action: actor.action, count });
      if (count > MAX_SAME_ACTION_RUN && !flagged.has(actor.character)) {
        flagged.add(actor.character);
        issues.push({
          code: "repeated_action",
          severity: "info",
          message: `Nhân vật ${actor.character} giữ một hành động (${actor.action}) hơn ${MAX_SAME_ACTION_RUN} shot liền. Đổi hành động theo nội dung câu nói.`,
          sceneId: scene.id,
        });
      }
    }
  }
  return issues;
}
