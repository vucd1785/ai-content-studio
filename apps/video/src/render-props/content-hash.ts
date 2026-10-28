import { createHash } from "node:crypto";
import type { EduVerticalRenderProps } from "./schema";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${entries.join(",")}}`;
}

/** Canonical payload for cache keys; omits ephemeral `audio.src`. */
export function eduVerticalRenderPropsPayload(
  props: EduVerticalRenderProps,
): Record<string, unknown> {
  return {
    templateId: props.templateId,
    templateVersion: props.templateVersion,
    fps: props.fps,
    width: props.width,
    height: props.height,
    audio: {
      storageKey: props.audio.storageKey,
      durationMs: props.audio.durationMs,
    },
    scenes: props.scenes,
    captions: props.captions,
  };
}

/** SHA-256 hex digest of stable render props content (`content_hash`). */
export function hashEduVerticalRenderProps(props: EduVerticalRenderProps): string {
  const payload = eduVerticalRenderPropsPayload(props);
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}
