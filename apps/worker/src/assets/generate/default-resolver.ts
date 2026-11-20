import { join } from "node:path";
import { REDO_REGENERATABLE_KINDS } from "@studio/contracts";
import { insertUsageRecord, type StudioDb } from "@studio/db";
import { resolveRepoRoot } from "../../cli/paths.js";
import type { StructuredGenerateClient } from "../../llm/structured-output.js";
import type { LlmUsage } from "../../llm/types.js";
import type { RenderJobDeps } from "../../render/render-job.js";
import { safeFetchBytes } from "../../research/safe-fetch.js";
import { findCommonsImage } from "../images/commons.js";
import { type NormalizedImage, normalizeImage } from "../images/image-asset.js";
import { findWebImage, WEB_IMAGE_LICENSE, WEB_IMAGE_MIN_EDGE } from "../images/web-image.js";
import { resolveAssetRequests } from "./generate-assets.js";
import type { AssetLicense } from "./registry.js";
import { listManifests } from "./registry.js";
import { renderCheckAsset } from "./render-check.js";
import { type ResolveAssets, syncAssetRow } from "./storyboard-assets.js";

/**
 * Bộ giải yêu cầu tài sản mặc định của worker (ADR-017): Claude Code headless, kho trong repo, render thử
 * bằng Remotion, ghi `usage_records` cho agent `visual` của job storyboard.
 */
export function createDefaultAssetResolver(options: {
  db: StudioDb;
  dataDir: string;
  /** Null khi Claude Code chưa cấu hình: yêu cầu nào chưa có tài sản khớp thì giữ `open`. */
  claude: StructuredGenerateClient | null;
  /** ADR-032: Claude Code chỉ bật `WebSearch` để tìm ảnh thật trên web; null thì chỉ tìm trên Commons. */
  webSearch?: StructuredGenerateClient | null;
  kitSrc?: string;
}): ResolveAssets {
  const kitSrc =
    options.kitSrc ?? join(resolveRepoRoot(import.meta.url), "packages", "motion-kit", "src");
  const log = (line: string) => console.log(`storyboard: ${line}`);
  return (input) => {
    const recordUsage = async (usage: LlmUsage) => {
      await insertUsageRecord(options.db, {
        workflowRunId: input.runId,
        agentRunId: input.agentRunId,
        provider: usage.provider,
        model: usage.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        thinkingTokens: usage.thinkingTokens,
      });
    };
    return resolveAssetRequests(input, {
      kitSrc,
      claude: options.claude,
      renderCheck: (asset) => renderCheckAsset(options.dataDir, kitSrc, asset),
      recordUsage,
      log,
      // ADR-032: ảnh thật tìm trên mọi trang web trước, rồi Wikimedia Commons (ADR-030), không có thì Claude vẽ.
      findRealImage: async ({ query, description, person }) => {
        const tmp = join(options.dataDir, "tmp", "images");
        const web = options.webSearch ?? null;
        if (web !== null) {
          const found = await findWebImage<{ image: NormalizedImage; licenses: AssetLicense[] }>(
            { query, description, person },
            {
              search: web,
              fetchBytes: (url, kind) =>
                safeFetchBytes(url, {
                  allowedHosts: "any-public",
                  contentTypes: kind.contentTypes,
                  accept: kind.accept,
                  maxBytes: kind.maxBytes,
                  truncate: kind.truncate,
                }),
              log,
              recordUsage,
            },
            async (hit) => {
              const image = await normalizeImage(hit.buffer, tmp);
              if (Math.max(image.width, image.height) < WEB_IMAGE_MIN_EDGE) {
                throw new Error(`ảnh nhỏ (${image.width}×${image.height})`);
              }
              return {
                image,
                licenses: [
                  {
                    name: WEB_IMAGE_LICENSE,
                    source: hit.host,
                    url: hit.pageUrl,
                    file: hit.imageUrl,
                    attribution: `Ảnh: ${hit.pageTitle} (${hit.pageUrl})`,
                  },
                ],
              };
            },
          ).catch((error: unknown) => {
            log(
              `ảnh web "${query}" lỗi: ${error instanceof Error ? error.message : String(error)}`,
            );
            return null;
          });
          if (found !== null) {
            return found;
          }
        }
        const found = await findCommonsImage(query, fetch, { person });
        if (found === null) {
          return null;
        }
        const image = await normalizeImage(found.buffer, tmp);
        return {
          image,
          licenses: [
            {
              name: found.license,
              source: "Wikimedia Commons",
              author: found.author,
              url: found.pageUrl,
              attribution: found.attribution,
            },
          ],
        };
      },
    });
  };
}

/**
 * Tạo lại một hình ở Cổng 2 (ADR-021): Claude Code viết tài sản mới cùng loại theo mô tả cũ và ghi chú của
 * Director, không dùng lại tài sản có sẵn. Tài sản mới là `candidate` trong kho; video dùng nó ngay.
 */
export function createAssetRegenerator(options: {
  db: StudioDb;
  dataDir: string;
  claude: StructuredGenerateClient | null;
  kitSrc?: string;
}): NonNullable<RenderJobDeps["regenerateAsset"]> {
  const kitSrc =
    options.kitSrc ?? join(resolveRepoRoot(import.meta.url), "packages", "motion-kit", "src");
  const resolve = createDefaultAssetResolver({ ...options, kitSrc });
  return async ({ runId, agentRunId, topic, oldAssetId, note }) => {
    const manifest = listManifests(kitSrc).find((m) => m.id === oldAssetId);
    if (
      manifest === undefined ||
      !(REDO_REGENERATABLE_KINDS as readonly string[]).includes(manifest.kind)
    ) {
      return { assetId: null, error: `Không tạo lại được ${oldAssetId}: chỉ đồ vật và bối cảnh.` };
    }
    const [outcome] = await resolve({
      topic,
      runId,
      agentRunId,
      requests: [
        {
          variantIndex: 1,
          requestId: "redo",
          kind: manifest.kind,
          description: `${manifest.description}. Director yêu cầu sửa: ${note}`,
          sceneIds: [],
          fallbackAssetId: oldAssetId,
          avoidReuse: true,
        },
      ],
    });
    if (outcome?.assetId !== null && outcome?.assetId !== undefined) {
      await syncAssetRow(options.db, kitSrc, manifest.kind, outcome.assetId);
      return { assetId: outcome.assetId, error: null };
    }
    return { assetId: null, error: outcome?.error ?? "không rõ lỗi" };
  };
}
