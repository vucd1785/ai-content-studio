import { createHash } from "node:crypto";
import type { StickStoryRenderProps } from "./stick-story-props";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

/**
 * `content_hash` của props `StickStory`: mọi trường trừ `audio.src` (đường dẫn tạm), cộng sha256 của WAV.
 * `templateVersion` và `motionKitVersion` đều nằm trong hash (05).
 */
export function hashStickStoryRenderProps(
  props: StickStoryRenderProps,
  options: { audioContentSha256: string },
): string {
  const { src: _src, ...audio } = props.audio;
  const payload = { ...props, audio: { ...audio, contentSha256: options.audioContentSha256 } };
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}
