import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeText } from "../../llm/asset-selection.js";
import type { StructuredGenerateClient } from "../../llm/structured-output.js";
import type { LlmUsage } from "../../llm/types.js";
import { type NormalizedImage, writeImageAsset } from "../images/image-asset.js";
import {
  buildGenerationPrompt,
  GENERATION_JSON_SCHEMA,
  GENERATION_SYSTEM_INSTRUCTION,
  parseDraft,
} from "./prompt.js";
import { checkAssetQuality, type QualityIssue } from "./quality.js";
import {
  type AssetLicense,
  type AssetManifest,
  assetDir,
  assetFileName,
  GENERATABLE_KINDS,
  listManifests,
  removeAsset,
  rewriteGeneratedRegistry,
  writeAssetFiles,
} from "./registry.js";
import { checkGeneratedSource } from "./static-check.js";
import { type GeneratableKind, typecheckAssetFile } from "./type-check.js";

/**
 * Trần tài sản tạo mới mỗi run (ADR-017 mục 4) và số lần thử mỗi tài sản. Director 2026-11-12 bỏ trần: tạo đủ mọi
 * hình chủ đề cần, không ngại tốn lượt Claude (ADR-027). Số yêu cầu vẫn bị chặn bởi trần `assetRequests` của script.
 */
export const MAX_NEW_ASSETS_PER_RUN = Number.POSITIVE_INFINITY;
export const ATTEMPTS_PER_ASSET = 2;
/**
 * Ngưỡng dùng lại (ADR-017 bổ sung 2026-11-11 (3)): đủ điểm **và** khớp ít nhất 2 tag khác nhau.
 * Một tag chung chung ("dòng sông") không đủ để ghép đồng bằng Cửu Long với bản đồ thế giới.
 */
export const REUSE_MIN_SCORE = 2;
export const REUSE_MIN_TAGS = 2;

export type AssetRequestInput = {
  variantIndex: 1 | 2;
  requestId: string;
  kind: string;
  description: string;
  sceneIds: string[];
  fallbackAssetId: string;
  /** Tạo lại ở Cổng 2 (ADR-021): luôn tạo mới, không dùng lại tài sản có sẵn. */
  avoidReuse?: boolean;
  /** ADR-030: lấy ảnh thật có giấy phép mở (tìm bằng `searchQuery`), không để Claude vẽ. */
  real?: boolean;
  searchQuery?: string;
  /** ADR-032: chân dung một người có thật. */
  person?: boolean;
};

export type AssetRequestOutcome = AssetRequestInput & {
  status: "fulfilled" | "open";
  assetId: string | null;
  /** Dùng lại tài sản có sẵn thay vì tạo mới. */
  reused: boolean;
  error: string | null;
};

export type AssetGeneratorDeps = {
  /** `packages/motion-kit/src`. */
  kitSrc: string;
  /** Null khi Claude Code chưa cấu hình: yêu cầu giữ `open`, cảnh dùng tài sản thay thế. */
  claude: StructuredGenerateClient | null;
  /** Render thử trong Chromium của Remotion (thuần frame, có ảnh xem trước). Trả lỗi hoặc null. */
  renderCheck: (asset: { kind: GeneratableKind; id: string }) => Promise<string | null>;
  recordUsage?: (usage: LlmUsage) => Promise<void>;
  maxNewAssets?: number;
  log?: (line: string) => void;
  /**
   * ADR-030: tìm ảnh thật có giấy phép mở cho yêu cầu `real`, đã chuẩn hóa sẵn. Không có thì null; không cấu hình
   * thì yêu cầu `real` được Claude vẽ như thường.
   */
  findRealImage?: (q: {
    query: string;
    description: string;
    person: boolean;
  }) => Promise<{ image: NormalizedImage; licenses: AssetLicense[] } | null>;
};

/**
 * Khóa của tài sản tạo cho một yêu cầu: run, kịch bản (khi có), phương án, id yêu cầu. Kịch bản viết lại ở Cổng 1
 * đánh lại r1…, nên thiếu kịch bản thì yêu cầu mới trùng khóa và nhận lại tài sản của kịch bản cũ.
 */
export function requestKeyFor(
  input: { runId: string; scriptArtifactId?: string },
  req: { variantIndex: 1 | 2; requestId: string },
): string {
  const script =
    input.scriptArtifactId === undefined ? "" : `${input.scriptArtifactId.slice(0, 8)}:`;
  return `${input.runId}:${script}${req.variantIndex}:${req.requestId}`;
}

/** Bỏ dấu tiếng Việt và ký tự lạ để làm id ASCII. */
function slugWords(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 1);
}

export function proposeAssetId(kind: GeneratableKind, description: string, taken: Set<string>) {
  const prefix = { prop: "prop", background: "bg", action: "action", pose: "pose" }[kind];
  const words = slugWords(description).slice(0, 3).join("_") || "asset";
  const hash = createHash("sha1").update(description).digest("hex").slice(0, 4);
  let id = `${prefix}_${words}_${hash}`.slice(0, 60);
  for (let n = 2; taken.has(id); n++) {
    id = `${prefix}_${words}_${hash}${n}`.slice(0, 64);
  }
  return id;
}

/** Điểm khớp của tài sản có sẵn với mô tả yêu cầu: tag xuất hiện nguyên cụm trong mô tả. */
export function reuseScore(manifest: AssetManifest, description: string): number {
  return reuseMatch(manifest, description).score;
}

/** Điểm và số tag khác nhau khớp mô tả. */
export function reuseMatch(
  manifest: AssetManifest,
  description: string,
): { score: number; tags: number } {
  const text = normalizeText(description);
  const seen = new Set<string>();
  let score = 0;
  for (const tag of manifest.tags) {
    const t = normalizeText(tag).trim();
    if (t !== "" && !seen.has(t) && text.includes(t)) {
      seen.add(t);
      score += t.includes(" ") ? 2 : 1;
    }
  }
  return { score, tags: seen.size };
}

/** Tài sản có sẵn đủ khớp để dùng lại thay vì tạo mới. */
export const isReusable = (match: { score: number; tags: number }) =>
  match.score >= REUSE_MIN_SCORE && match.tags >= REUSE_MIN_TAGS;

/**
 * Tiêu chí chất lượng chưa đạt của một tài sản trong kho (ADR-022). Đọc mã nguồn, không render, không gọi model.
 * Không đọc được file thì coi như không đạt, để worker tạo mới thay vì dùng một hình hỏng.
 */
export function storedAssetQuality(kitSrc: string, manifest: AssetManifest): QualityIssue[] {
  // Tài sản lấy từ nguồn (cờ ADR-029, ảnh thật ADR-030) không do Claude vẽ nên không chấm theo tiêu chí vẽ.
  if (
    manifest.createdBy === "director" &&
    (manifest.requestKey === null || manifest.licenses.length > 0)
  ) {
    return [];
  }
  const file = join(assetDir(kitSrc, manifest.kind, manifest.id), assetFileName(manifest.kind));
  if (!existsSync(file)) {
    return [{ id: "missing", label: "không đọc được mã nguồn", rule: "" }];
  }
  return checkAssetQuality(manifest.kind, readFileSync(file, "utf8"), manifest.description);
}

/**
 * Xử lý yêu cầu tài sản của cả hai phương án (ADR-017 mục 2): dùng lại nếu khớp, không thì tạo bằng Claude Code,
 * kiểm AST, typecheck, render thử; lỗi thì để `open` và cảnh dùng tài sản thay thế. Không ném lỗi ra ngoài.
 */
export async function resolveAssetRequests(
  input: {
    topic: string;
    runId: string;
    scriptArtifactId?: string;
    requests: readonly AssetRequestInput[];
  },
  deps: AssetGeneratorDeps,
): Promise<AssetRequestOutcome[]> {
  const log = deps.log ?? (() => {});
  const maxNew = deps.maxNewAssets ?? MAX_NEW_ASSETS_PER_RUN;
  const outcomes: AssetRequestOutcome[] = [];
  const createdThisRun = new Map<string, string>();
  let created = 0;

  for (const req of input.requests) {
    const base = { ...req, assetId: null, reused: false };
    if (!(GENERATABLE_KINDS as readonly string[]).includes(req.kind)) {
      outcomes.push({ ...base, status: "open", error: `loại ${req.kind} chưa tự tạo được` });
      continue;
    }
    const kind = req.kind as GeneratableKind;
    const key = `${kind}:${normalizeText(req.description).trim()}`;
    const same = createdThisRun.get(key);
    if (same !== undefined && req.avoidReuse !== true) {
      outcomes.push({ ...base, status: "fulfilled", assetId: same, reused: true, error: null });
      continue;
    }
    // ADR-022: hình khớp mô tả nhưng chưa đạt tiêu chí chất lượng thì không dùng lại; xét hình khớp kế tiếp,
    // hết hình thì tạo mới bằng Claude Code như thường.
    const wantsReal = req.real === true && kind === "prop" && deps.findRealImage !== undefined;
    const candidates = listManifests(deps.kitSrc)
      // Yêu cầu ảnh thật chỉ dùng lại tài sản lấy từ nguồn, không dùng lại hình Claude vẽ.
      .filter(
        (m) => m.kind === kind && req.avoidReuse !== true && (!wantsReal || m.licenses.length > 0),
      )
      .map((m) => ({ m, ...reuseMatch(m, req.description) }))
      .filter(isReusable)
      .sort((a, b) => b.score - a.score || a.m.id.localeCompare(b.m.id));
    let best: (typeof candidates)[number] | undefined;
    for (const c of candidates) {
      const issues = storedAssetQuality(deps.kitSrc, c.m);
      if (issues.length === 0) {
        best = c;
        break;
      }
      log(
        `tài sản ${req.requestId}: không dùng lại ${c.m.id}, chưa đạt: ${issues.map((i) => i.label).join("; ")}`,
      );
    }
    if (best !== undefined) {
      log(`tài sản ${req.requestId}: dùng lại ${best.m.id} (điểm ${best.score}, ${best.tags} tag)`);
      outcomes.push({
        ...base,
        status: "fulfilled",
        assetId: best.m.id,
        reused: true,
        error: null,
      });
      continue;
    }
    if (wantsReal && deps.findRealImage !== undefined) {
      const found = await deps
        .findRealImage({
          query: req.searchQuery ?? req.description,
          description: req.description,
          person: req.person === true,
        })
        .catch((error) => {
          log(`tài sản ${req.requestId}: tìm ảnh thật lỗi: ${message(error)}`);
          return null;
        });
      if (found !== null) {
        const id = writeImageAsset(deps.kitSrc, {
          description: req.description,
          tags: [...new Set([req.searchQuery ?? "", "ảnh thật"].filter((t) => t !== ""))],
          status: "candidate",
          requestKey: requestKeyFor(input, req),
          brandProfile: null,
          licenses: found.licenses,
          image: found.image,
        });
        log(`tài sản ${req.requestId}: ảnh thật ${id}`);
        createdThisRun.set(key, id);
        outcomes.push({ ...base, status: "fulfilled", assetId: id, error: null });
        continue;
      }
      log(`tài sản ${req.requestId}: không có ảnh thật phù hợp, Claude vẽ thay`);
    }
    if (created >= maxNew) {
      outcomes.push({ ...base, status: "open", error: `vượt trần ${maxNew} tài sản mới mỗi run` });
      continue;
    }
    if (deps.claude === null) {
      outcomes.push({ ...base, status: "open", error: "Claude Code chưa cấu hình" });
      continue;
    }
    created += 1;
    // Một yêu cầu lỗi không được chặn các yêu cầu sau và việc ghi kết quả của các yêu cầu trước.
    const result = await generateOne(input, req, kind, deps, log).catch((error) => ({
      assetId: null,
      error: `lỗi bất ngờ: ${message(error)}`,
    }));
    if (result.assetId !== null) {
      createdThisRun.set(key, result.assetId);
      outcomes.push({ ...base, status: "fulfilled", assetId: result.assetId, error: null });
    } else {
      outcomes.push({ ...base, status: "open", error: result.error });
    }
  }
  return outcomes;
}

async function generateOne(
  input: { topic: string; runId: string; scriptArtifactId?: string },
  req: AssetRequestInput,
  kind: GeneratableKind,
  deps: AssetGeneratorDeps,
  log: (line: string) => void,
): Promise<{ assetId: string | null; error: string | null }> {
  const taken = new Set(listManifests(deps.kitSrc).map((m) => m.id));
  const id = proposeAssetId(kind, req.description, taken);
  const basePrompt = buildGenerationPrompt(deps.kitSrc, {
    kind,
    description: req.description,
    suggestedId: id,
    topic: input.topic,
  });
  let feedback = "";
  let lastError = "không rõ";
  for (let attempt = 1; attempt <= ATTEMPTS_PER_ASSET; attempt++) {
    let draftValue: unknown;
    try {
      const response = await (deps.claude as StructuredGenerateClient).generateStructured({
        systemInstruction: GENERATION_SYSTEM_INSTRUCTION,
        userPrompt:
          feedback === ""
            ? basePrompt
            : `${basePrompt}\n\nYour previous file was rejected. Fix these problems and return the whole file again:\n${feedback}`,
        responseJsonSchema: GENERATION_JSON_SCHEMA,
        model: "claude-code",
        thinkingLevel: "low",
      });
      await deps.recordUsage?.(response.usage);
      draftValue = JSON.parse(response.jsonText);
    } catch (error) {
      // Lỗi provider (chưa đăng nhập, hết hạn mức): không thử lại, cảnh dùng tài sản thay thế.
      return { assetId: null, error: `Claude Code: ${message(error)}` };
    }
    const draft = parseDraft(draftValue);
    if (draft === null) {
      lastError = "JSON trả về thiếu trường";
      feedback = "- The JSON must have string description, string array tags, string code.";
      continue;
    }
    const staticIssues = checkGeneratedSource(draft.code, assetFileName(kind), kind);
    if (staticIssues.length > 0) {
      lastError = `kiểm AST: ${staticIssues.map((i) => i.message).join("; ")}`;
      feedback = staticIssues.map((i) => `- line ${i.line}: ${i.message}`).join("\n");
      log(`tài sản ${id}: lần ${attempt} bị chặn ở kiểm AST: ${lastError}`);
      continue;
    }
    // ADR-022: chấm tiêu chí chất lượng trước khi ghi file. Lần cuối vẫn thiếu thì nhận hình (còn hơn hình thay
    // thế) và ghi log; lần tới gặp yêu cầu tương tự, hình này không được dùng lại nên sẽ được vẽ lại.
    const qualityIssues = checkAssetQuality(kind, draft.code, req.description);
    if (qualityIssues.length > 0 && attempt < ATTEMPTS_PER_ASSET) {
      lastError = `chưa đạt tiêu chí: ${qualityIssues.map((i) => i.label).join("; ")}`;
      feedback = qualityIssues.map((i) => `- Quality bar not met: ${i.rule}`).join("\n");
      log(`tài sản ${id}: lần ${attempt} ${lastError}`);
      continue;
    }
    if (qualityIssues.length > 0) {
      log(
        `tài sản ${id}: nhận dù chưa đạt ${qualityIssues.map((i) => i.label).join("; ")} (hết lượt thử)`,
      );
    }
    const manifest: AssetManifest = {
      id,
      kind,
      version: "0.1.0",
      description: draft.description,
      tags: draft.tags,
      brandProfile: null,
      createdBy: "claude-code",
      status: "candidate",
      requestKey: requestKeyFor(input, req),
      licenses: [],
    };
    const file = writeAssetFiles(deps.kitSrc, manifest, draft.code);
    const typeErrors = typecheckAssetFile(join(deps.kitSrc, ".."), file, kind);
    if (typeErrors.length > 0) {
      removeAsset(deps.kitSrc, kind, id);
      lastError = `typecheck: ${typeErrors.slice(0, 3).join("; ")}`;
      feedback = typeErrors
        .slice(0, 10)
        .map((e) => `- ${e}`)
        .join("\n");
      // Ghi vài lỗi đầu để biết vì sao hình không qua mà không phải chạy lại.
      log(`tài sản ${id}: lần ${attempt} lỗi typecheck: ${typeErrors.slice(0, 3).join(" | ")}`);
      continue;
    }
    rewriteGeneratedRegistry(deps.kitSrc);
    // Lỗi bất ngờ khi render hoặc nạp module là một lần thử hỏng, không làm hỏng cả bước tài sản.
    const renderError = await deps.renderCheck({ kind, id }).catch((error) => message(error));
    if (renderError !== null) {
      removeAsset(deps.kitSrc, kind, id);
      rewriteGeneratedRegistry(deps.kitSrc);
      lastError = `render thử: ${renderError}`;
      feedback = `- ${renderError}`;
      log(`tài sản ${id}: lần ${attempt} lỗi render thử: ${renderError}`);
      continue;
    }
    log(`tài sản ${id}: tạo xong (candidate)`);
    return { assetId: id, error: null };
  }
  return { assetId: null, error: lastError };
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
