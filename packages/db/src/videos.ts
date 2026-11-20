import { and, desc, eq, inArray } from "drizzle-orm";
import type { StudioDb } from "./db.js";
import {
  artifactDependencies,
  artifacts,
  briefs,
  jobs,
  projects,
  workflowRuns,
  youtubeUploads,
} from "./schema/index.js";

export type ExportedVideoRow = {
  exportArtifactId: string;
  workflowRunId: string;
  projectId: string;
  projectTitle: string;
  topic: string;
  exportedAt: Date;
  aspectRatio: string;
  exportMetadata: Record<string, unknown>;
  /** `storage_key` của `render_props` cha (export → preview → render_props); null nếu thiếu. */
  renderPropsKey: string | null;
  youtube: {
    uploadId: string;
    status: string;
    videoId: string | null;
    resultMetadata: Record<string, unknown> | null;
  } | null;
};

/**
 * Bản xuất mới nhất của mỗi run ở mọi dự án, mới nhất trước (P8-08, màn Video). Kèm render props cha để đọc khung
 * và thời lượng, và lần đăng YouTube gần nhất của chính bản xuất đó.
 */
export async function listExportedVideos(db: StudioDb): Promise<ExportedVideoRow[]> {
  const rows = await db
    .select({
      exportArtifactId: artifacts.id,
      workflowRunId: artifacts.workflowRunId,
      exportedAt: artifacts.createdAt,
      exportMetadata: artifacts.metadata,
      aspectRatio: workflowRuns.aspectRatio,
      projectId: projects.id,
      projectTitle: projects.title,
      topic: briefs.topic,
    })
    .from(artifacts)
    .innerJoin(workflowRuns, eq(workflowRuns.id, artifacts.workflowRunId))
    .innerJoin(projects, eq(projects.id, workflowRuns.projectId))
    .innerJoin(briefs, eq(briefs.id, workflowRuns.briefId))
    .where(eq(artifacts.type, "export"))
    .orderBy(desc(artifacts.createdAt), desc(artifacts.version));

  const seenRuns = new Set<string>();
  const latest = rows.filter((row) => {
    if (seenRuns.has(row.workflowRunId)) {
      return false;
    }
    seenRuns.add(row.workflowRunId);
    return true;
  });
  if (latest.length === 0) {
    return [];
  }
  const exportIds = latest.map((row) => row.exportArtifactId);

  // export → preview
  const previewLinks = await db
    .select({ exportId: artifactDependencies.artifactId, previewId: artifacts.id })
    .from(artifactDependencies)
    .innerJoin(artifacts, eq(artifacts.id, artifactDependencies.parentArtifactId))
    .where(and(inArray(artifactDependencies.artifactId, exportIds), eq(artifacts.type, "preview")));
  const previewOf = new Map(previewLinks.map((link) => [link.exportId, link.previewId]));

  // preview → render_props
  const previewIds = [...new Set(previewLinks.map((link) => link.previewId))];
  const propsLinks =
    previewIds.length === 0
      ? []
      : await db
          .select({ previewId: artifactDependencies.artifactId, storageKey: artifacts.storageKey })
          .from(artifactDependencies)
          .innerJoin(artifacts, eq(artifacts.id, artifactDependencies.parentArtifactId))
          .where(
            and(
              inArray(artifactDependencies.artifactId, previewIds),
              eq(artifacts.type, "render_props"),
            ),
          );
  const propsOf = new Map(propsLinks.map((link) => [link.previewId, link.storageKey]));

  const uploads = await db
    .select({
      uploadId: youtubeUploads.id,
      exportArtifactId: youtubeUploads.exportArtifactId,
      videoId: youtubeUploads.videoId,
      status: jobs.status,
      resultMetadata: artifacts.metadata,
    })
    .from(youtubeUploads)
    .innerJoin(jobs, eq(jobs.id, youtubeUploads.jobId))
    .leftJoin(artifacts, eq(artifacts.id, youtubeUploads.resultArtifactId))
    .where(inArray(youtubeUploads.exportArtifactId, exportIds))
    .orderBy(desc(youtubeUploads.createdAt));
  const uploadOf = new Map<string, (typeof uploads)[number]>();
  for (const upload of uploads) {
    // Ưu tiên lần đăng đã có video; nếu chưa có thì lấy lần mới nhất.
    const current = uploadOf.get(upload.exportArtifactId);
    if (current === undefined || (current.videoId === null && upload.videoId !== null)) {
      uploadOf.set(upload.exportArtifactId, upload);
    }
  }

  return latest.map((row) => {
    const previewId = previewOf.get(row.exportArtifactId);
    const upload = uploadOf.get(row.exportArtifactId);
    return {
      exportArtifactId: row.exportArtifactId,
      workflowRunId: row.workflowRunId,
      projectId: row.projectId,
      projectTitle: row.projectTitle,
      topic: row.topic,
      exportedAt: row.exportedAt,
      aspectRatio: row.aspectRatio,
      exportMetadata: (row.exportMetadata ?? {}) as Record<string, unknown>,
      renderPropsKey: previewId === undefined ? null : (propsOf.get(previewId) ?? null),
      youtube:
        upload === undefined
          ? null
          : {
              uploadId: upload.uploadId,
              status: upload.status,
              videoId: upload.videoId,
              resultMetadata: (upload.resultMetadata ?? null) as Record<string, unknown> | null,
            },
    };
  });
}
