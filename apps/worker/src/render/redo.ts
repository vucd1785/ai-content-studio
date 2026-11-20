import { readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  type RedoRequestFile,
  redoRequestFileSchema,
  redoResultFileSchema,
  redoResultStorageKey,
} from "@studio/contracts";
import type { StickStoryRenderProps } from "@studio/video/stick-story/props";
import { readJsonArtifact } from "../jobs/job-support.js";

/**
 * Làm lại một phần ở Cổng 2 (ADR-021): mỗi lần là một file trong `artifacts/<run>/redo/`. Render dựng props từ
 * kịch bản đã duyệt rồi áp mọi lần đổi nền và tạo lại hình **sau** approval kịch bản đó, theo thứ tự thời gian,
 * nên lần làm lại sau không làm mất lần trước. Đọc lại cảnh không cần áp: bản đọc mới đã nằm trong audio.
 */
export type RedoOverride =
  | { kind: "background"; sceneId: string; backgroundId: string }
  | { kind: "swap"; from: string; to: string };

/** Mọi file yêu cầu làm lại của run, cũ trước. File hỏng thì bỏ qua (route chỉ ghi file đúng schema). */
export async function listRedoRequests(
  dataDir: string,
  workflowRunId: string,
): Promise<RedoRequestFile[]> {
  const dir = join(dataDir, "artifacts", workflowRunId, "redo");
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const files: RedoRequestFile[] = [];
  for (const name of names) {
    if (!name.endsWith(".json") || name.endsWith(".result.json")) {
      continue;
    }
    const file = await readJsonArtifact(
      dataDir,
      `artifacts/${workflowRunId}/redo/${name}`,
      redoRequestFileSchema,
    );
    if (file !== null) {
      files.push(file);
    }
  }
  return files.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Phép đổi cần áp, từ các lần làm lại sau `since` (thời điểm duyệt kịch bản). */
export async function loadRedoOverrides(
  dataDir: string,
  workflowRunId: string,
  since: Date,
): Promise<RedoOverride[]> {
  const overrides: RedoOverride[] = [];
  for (const file of await listRedoRequests(dataDir, workflowRunId)) {
    if (Date.parse(file.createdAt) <= since.getTime()) {
      continue;
    }
    const request = file.request;
    if (request.kind === "background") {
      overrides.push({
        kind: "background",
        sceneId: request.sceneId,
        backgroundId: request.backgroundId,
      });
    } else if (request.kind === "regenerate_asset") {
      const result = await readJsonArtifact(
        dataDir,
        redoResultStorageKey(workflowRunId, file.redoId),
        redoResultFileSchema,
      );
      if (result?.newAssetId !== null && result?.newAssetId !== undefined) {
        overrides.push({ kind: "swap", from: result.oldAssetId, to: result.newAssetId });
      }
    }
  }
  return overrides;
}

/** Áp phép đổi lên props (thuần). Caller parse lại props sau đó. */
export function applyRedoOverrides(
  props: StickStoryRenderProps,
  overrides: readonly RedoOverride[],
): StickStoryRenderProps {
  let shots = props.shots;
  for (const o of overrides) {
    if (o.kind === "background") {
      shots = shots.map((shot) =>
        shot.sceneId === o.sceneId ? { ...shot, background: o.backgroundId } : shot,
      );
    } else {
      const swap = (id: string) => (id === o.from ? o.to : id);
      shots = shots.map((shot) => ({
        ...shot,
        background: swap(shot.background),
        props: shot.props.map(swap),
        ...(shot.illustration === undefined
          ? {}
          : { illustration: { ...shot.illustration, items: shot.illustration.items.map(swap) } }),
      }));
    }
  }
  return { ...props, shots };
}
