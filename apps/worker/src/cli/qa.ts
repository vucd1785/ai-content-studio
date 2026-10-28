import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type QaReport = {
  passed: boolean;
  checks: Array<{ code: string; severity: string; message: string }>;
};

export function writePipelineReport(path: string, payload: Record<string, unknown>): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(payload, null, 2), "utf8");
}
