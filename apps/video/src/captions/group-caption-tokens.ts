import type { RemotionCaption } from "@studio/contracts";

const DEFAULT_WINDOW_MS = 1200;

export type CaptionDisplayGroup = {
  startMs: number;
  endMs: number;
  tokens: RemotionCaption[];
};

/**
 * Groups word-level captions into ~windowMs display lines without altering token timings.
 */
export function groupCaptionTokens(
  captions: RemotionCaption[],
  windowMs: number = DEFAULT_WINDOW_MS,
): CaptionDisplayGroup[] {
  if (captions.length === 0) {
    return [];
  }

  const sorted = [...captions].sort((a, b) => a.startMs - b.startMs);
  const groups: CaptionDisplayGroup[] = [];
  let current: RemotionCaption[] = [];
  let windowStart = sorted[0]?.startMs ?? 0;

  for (const token of sorted) {
    if (current.length === 0) {
      windowStart = token.startMs;
      current.push(token);
      continue;
    }
    if (token.startMs - windowStart >= windowMs) {
      groups.push(finishGroup(current));
      current = [token];
      windowStart = token.startMs;
    } else {
      current.push(token);
    }
  }

  if (current.length > 0) {
    groups.push(finishGroup(current));
  }

  return groups;
}

function finishGroup(tokens: RemotionCaption[]): CaptionDisplayGroup {
  const startMs = tokens[0]?.startMs ?? 0;
  const endMs = tokens.reduce((max, token) => Math.max(max, token.endMs), startMs);
  return { startMs, endMs, tokens };
}

export function findActiveToken(
  captions: RemotionCaption[],
  timeMs: number,
): RemotionCaption | undefined {
  for (const token of captions) {
    if (timeMs >= token.startMs && timeMs < token.endMs) {
      return token;
    }
  }
  return undefined;
}

export function findActiveGroup(
  groups: CaptionDisplayGroup[],
  timeMs: number,
): CaptionDisplayGroup | undefined {
  for (const group of groups) {
    if (timeMs >= group.startMs && timeMs < group.endMs) {
      return group;
    }
  }
  return undefined;
}
