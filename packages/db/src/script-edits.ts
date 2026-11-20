import { and, desc, eq } from "drizzle-orm";
import type { StudioDb } from "./db.js";
import {
  artifactDependencies,
  artifacts,
  motionAssetRequests,
  workflowRuns,
} from "./schema/index.js";
import { ScriptEditError } from "./workflow.js";

/**
 * Ghi phiên bản script `2` mới sau khi Director sửa câu tại Cổng 1 (ADR-020), trong một transaction
 * (`saveDirectorScriptEdit` là đường cũ của script `1`):
 * - run phải đang `waiting_script_approval`, và artifact nguồn là script mới nhất của run;
 * - artifact mới có version kế tiếp, phụ thuộc artifact nguồn;
 * - yêu cầu tài sản của artifact nguồn được chép sang (giữ trạng thái và tài sản đã tạo), để storyboard và
 *   render dùng đúng tài sản như bản trước.
 * Không đổi trạng thái run, không ghi approval.
 */
export async function createEditedScriptArtifact(
  db: StudioDb,
  input: {
    workflowRunId: string;
    sourceArtifactId: string;
    storageKey: string;
    contentHash: string;
    metadata: Record<string, unknown>;
  },
): Promise<{ id: string; version: number }> {
  return db.transaction(async (tx) => {
    const [run] = await tx
      .select({
        id: workflowRuns.id,
        projectId: workflowRuns.projectId,
        status: workflowRuns.status,
      })
      .from(workflowRuns)
      .where(eq(workflowRuns.id, input.workflowRunId))
      .for("update");
    if (run === undefined) {
      throw new ScriptEditError("not_found", "workflow run not found");
    }
    if (run.status !== "waiting_script_approval") {
      throw new ScriptEditError("invalid_transition", `workflow run is ${run.status}`);
    }
    const [latest] = await tx
      .select({ id: artifacts.id, version: artifacts.version })
      .from(artifacts)
      .where(and(eq(artifacts.workflowRunId, run.id), eq(artifacts.type, "script")))
      .orderBy(desc(artifacts.version))
      .limit(1);
    if (latest === undefined) {
      throw new ScriptEditError("not_found", "script artifact not found");
    }
    if (latest.id !== input.sourceArtifactId) {
      throw new ScriptEditError("stale", "a newer script version exists");
    }
    const [row] = await tx
      .insert(artifacts)
      .values({
        projectId: run.projectId,
        workflowRunId: run.id,
        type: "script",
        version: latest.version + 1,
        schemaVersion: "2",
        contentHash: input.contentHash,
        storageKey: input.storageKey,
        metadata: input.metadata,
      })
      .returning({ id: artifacts.id, version: artifacts.version });
    if (row === undefined) {
      throw new Error("insert_artifact_failed");
    }
    await tx
      .insert(artifactDependencies)
      .values({ artifactId: row.id, parentArtifactId: latest.id });
    const requests = await tx
      .select()
      .from(motionAssetRequests)
      .where(eq(motionAssetRequests.scriptArtifactId, latest.id));
    if (requests.length > 0) {
      await tx.insert(motionAssetRequests).values(
        requests.map(({ id: _id, createdAt: _c, updatedAt: _u, ...r }) => ({
          ...r,
          scriptArtifactId: row.id,
        })),
      );
    }
    return row;
  });
}
