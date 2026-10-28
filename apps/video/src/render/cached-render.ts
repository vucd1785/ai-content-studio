import { existsSync, mkdirSync, renameSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  hashEduVerticalRenderProps,
  type RenderPropsHashOptions,
} from "../render-props/content-hash";
import type { EduVerticalRenderProps } from "../render-props/schema";
import { crfForPurpose, RENDER_CODEC, type RenderPurpose } from "./config";
import { isValidCachedMp4 } from "./validate-cached-mp4";

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
  audioContentSha256: string;
  frameRange?: [number, number];
  /** Injectable for unit tests; defaults to ffprobe validation. */
  validateCachedMp4?: (path: string) => boolean;
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
  const hashOptions: RenderPropsHashOptions = {
    audioContentSha256: params.audioContentSha256,
  };
  const contentHash = hashEduVerticalRenderProps(params.props, hashOptions);
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
    return {
      outputLocation,
      contentHash,
      templateVersion: params.props.templateVersion,
      purpose: params.purpose,
      crf,
      cacheHit: true,
    };
  }

  if (existsSync(outputLocation)) {
    try {
      unlinkSync(outputLocation);
    } catch {
      // best-effort; render will overwrite via temp file
    }
  }

  const tempLocation = outputLocation.replace(/\.mp4$/i, ".partial.mp4");
  await params.renderMedia({
    codec: RENDER_CODEC,
    crf,
    composition: params.composition,
    serveUrl: params.serveUrl,
    outputLocation: tempLocation,
    inputProps: params.props,
    ...(params.frameRange ? { frameRange: params.frameRange } : {}),
  });

  if (!validate(tempLocation)) {
    try {
      unlinkSync(tempLocation);
    } catch {
      // ignore
    }
    throw new Error("render produced invalid MP4 (missing streams or corrupt output)");
  }

  renameSync(tempLocation, outputLocation);

  return {
    outputLocation,
    contentHash,
    templateVersion: params.props.templateVersion,
    purpose: params.purpose,
    crf,
    cacheHit: false,
  };
}
