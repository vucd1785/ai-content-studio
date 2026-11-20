import { existsSync, mkdirSync, renameSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { resolveCachedMp4Path } from "../render/cached-render";
import { crfForPurpose, RENDER_CODEC, type RenderPurpose } from "../render/config";
import { isValidCachedMp4 } from "../render/validate-cached-mp4";
import { hashStickStoryRenderProps } from "./stick-story-hash";
import type { StickStoryRenderProps } from "./stick-story-props";

export type StickStoryRenderMediaFn = (options: {
  codec: typeof RENDER_CODEC;
  crf: number;
  composition: unknown;
  serveUrl: string;
  outputLocation: string;
  inputProps: StickStoryRenderProps;
}) => Promise<void>;

/**
 * Render `StickStory` có cache (quy tắc cache của P1-04, P3-06): đường dẫn MP4 gồm `templateVersion`
 * (có version motion kit) và `content_hash` (gồm `motionKitVersion`). Đổi kit thì không trúng MP4 cũ.
 */
export async function renderStickStoryWithCache(params: {
  purpose: RenderPurpose;
  props: StickStoryRenderProps;
  cacheRoot: string;
  serveUrl: string;
  composition: unknown;
  renderMedia: StickStoryRenderMediaFn;
  audioContentSha256: string;
  validateCachedMp4?: (path: string) => boolean;
  /** Xử lý MP4 tạm trước khi vào cache, ví dụ chuẩn hóa độ to (ADR-021). */
  postProcess?: (path: string) => void | Promise<void>;
}): Promise<{ outputLocation: string; contentHash: string; cacheHit: boolean; crf: number }> {
  const contentHash = hashStickStoryRenderProps(params.props, {
    audioContentSha256: params.audioContentSha256,
  });
  const crf = crfForPurpose(params.purpose);
  const outputLocation = resolveCachedMp4Path(params.cacheRoot, {
    templateId: params.props.templateId,
    templateVersion: params.props.templateVersion,
    purpose: params.purpose,
    contentHash,
  });
  mkdirSync(dirname(outputLocation), { recursive: true });
  const validate = params.validateCachedMp4 ?? isValidCachedMp4;
  if (existsSync(outputLocation) && validate(outputLocation)) {
    return { outputLocation, contentHash, cacheHit: true, crf };
  }
  const tmp = `${outputLocation}.tmp.mp4`;
  if (existsSync(tmp)) {
    unlinkSync(tmp);
  }
  await params.renderMedia({
    codec: RENDER_CODEC,
    crf,
    composition: params.composition,
    serveUrl: params.serveUrl,
    outputLocation: tmp,
    inputProps: params.props,
  });
  await params.postProcess?.(tmp);
  renameSync(tmp, outputLocation);
  return { outputLocation, contentHash, cacheHit: false, crf };
}
