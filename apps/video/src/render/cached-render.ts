import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { hashEduVerticalRenderProps } from "../render-props/content-hash";
import type { EduVerticalRenderProps } from "../render-props/schema";
import { crfForPurpose, RENDER_CODEC, type RenderPurpose } from "./config";

export type RenderMediaInvokeOptions = {
  codec: typeof RENDER_CODEC;
  crf: number;
  composition: unknown;
  serveUrl: string;
  outputLocation: string;
  inputProps: EduVerticalRenderProps;
  frameRange?: [number, number];
};

export type RenderMediaFn = (options: RenderMediaInvokeOptions) => Promise<void>;

export type RenderEduVerticalWithCacheParams = {
  purpose: RenderPurpose;
  props: EduVerticalRenderProps;
  cacheRoot: string;
  serveUrl: string;
  composition: unknown;
  renderMedia: RenderMediaFn;
  frameRange?: [number, number];
};

export type RenderEduVerticalWithCacheResult = {
  outputLocation: string;
  contentHash: string;
  templateVersion: string;
  purpose: RenderPurpose;
  crf: number;
  cacheHit: boolean;
};

export function resolveCachedMp4Path(
  cacheRoot: string,
  params: {
    templateId: string;
    templateVersion: string;
    purpose: RenderPurpose;
    contentHash: string;
  },
): string {
  const fileName = `${params.purpose}-${params.templateVersion}-${params.contentHash}.mp4`;
  return join(cacheRoot, params.templateId, fileName);
}

export async function renderEduVerticalWithCache(
  params: RenderEduVerticalWithCacheParams,
): Promise<RenderEduVerticalWithCacheResult> {
  const contentHash = hashEduVerticalRenderProps(params.props);
  const crf = crfForPurpose(params.purpose);
  const outputLocation = resolveCachedMp4Path(params.cacheRoot, {
    templateId: params.props.templateId,
    templateVersion: params.props.templateVersion,
    purpose: params.purpose,
    contentHash,
  });

  mkdirSync(dirname(outputLocation), { recursive: true });

  if (existsSync(outputLocation)) {
    return {
      outputLocation,
      contentHash,
      templateVersion: params.props.templateVersion,
      purpose: params.purpose,
      crf,
      cacheHit: true,
    };
  }

  await params.renderMedia({
    codec: RENDER_CODEC,
    crf,
    composition: params.composition,
    serveUrl: params.serveUrl,
    outputLocation,
    inputProps: params.props,
    ...(params.frameRange ? { frameRange: params.frameRange } : {}),
  });

  return {
    outputLocation,
    contentHash,
    templateVersion: params.props.templateVersion,
    purpose: params.purpose,
    crf,
    cacheHit: false,
  };
}
