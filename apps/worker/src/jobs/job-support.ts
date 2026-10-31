import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { applyWorkflowCommand } from "@studio/contracts";
import type { JobContext } from "@studio/db";
import type { z } from "zod/v4";

/** Phần dùng chung của job agent (research P3-03, script P3-04): file artifact JSON và cạnh workflow. */

type RunStatus = JobContext["workflowRun"]["status"];

export function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

/** Ghi JSON vào `DATA_DIR` qua file tạm rồi rename; trả sha256 của bytes đã ghi. */
export async function writeJsonArtifact(dataDir: string, key: string, value: unknown) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  const target = resolve(dataDir, key);
  if (!isInside(resolve(dataDir), target)) {
    throw new Error("artifact_key_outside_data_dir");
  }
  await mkdir(dirname(target), { recursive: true });
  const temp = `${target}.${randomUUID()}.tmp`;
  await writeFile(temp, bytes, { flag: "wx" });
  await rename(temp, target);
  return createHash("sha256").update(bytes).digest("hex");
}

/** Đọc artifact JSON đã lưu và validate. Thiếu file, path thoát `DATA_DIR` hoặc sai schema thì `null`. */
export async function readJsonArtifact<T>(dataDir: string, storageKey: string, schema: z.ZodType<T>) {
  try {
    const target = resolve(dataDir, storageKey);
    if (!isInside(await realpath(dataDir), await realpath(target))) {
      return null;
    }
    const parsed = schema.safeParse(JSON.parse(await readFile(target, "utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Cạnh `{ from, to }` đã kiểm bằng state machine của contracts; DB chỉ compare-and-set. */
export function advanceTransition(from: RunStatus, to: RunStatus) {
  const result = applyWorkflowCommand({ status: from, resumeFrom: null }, { kind: "advance", to });
  if (!result.ok) {
    throw new Error(`invalid_transition ${from} -> ${to}`);
  }
  return { from, to: result.to };
}
