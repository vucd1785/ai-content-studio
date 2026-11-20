import { and, desc, eq } from "drizzle-orm";
import type { StudioDb } from "./db.js";
import { briefs, projects, references, workflowRuns } from "./schema/index.js";

export type NewBriefInput = {
  topic: string;
  audience: string;
  goal: string;
  durationSec: number;
  language: "vi";
  tone: string;
  visualStyle: string;
  notes?: string | undefined;
  /** Gói thể loại (ADR-013); không có là `story` v1 như `DEFAULT_FORMAT` của contracts (bổ sung (2) 2026-11-03). */
  formatId?: string | undefined;
  formatVersion?: number | undefined;
};

export type ProjectRow = typeof projects.$inferSelect;

function toIso(date: Date): string {
  return date.toISOString();
}

export function mapProjectRow(row: ProjectRow) {
  return {
    id: row.id,
    title: row.title,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

/** Danh sách dự án kèm run mới nhất của mỗi dự án (P2-11): trang dự án biết việc nào chờ Director. */
export async function listProjects(db: StudioDb) {
  const rows = await db.select().from(projects).orderBy(desc(projects.createdAt));
  const runs = await db
    .select({
      id: workflowRuns.id,
      projectId: workflowRuns.projectId,
      status: workflowRuns.status,
      updatedAt: workflowRuns.updatedAt,
    })
    .from(workflowRuns)
    .orderBy(desc(workflowRuns.createdAt));
  const latest = new Map<string, (typeof runs)[number]>();
  for (const run of runs) {
    if (!latest.has(run.projectId)) {
      latest.set(run.projectId, run);
    }
  }
  return rows.map((row) => {
    const run = latest.get(row.id);
    return {
      ...mapProjectRow(row),
      latestRun:
        run === undefined
          ? null
          : { id: run.id, status: run.status, updatedAt: toIso(run.updatedAt) },
    };
  });
}

/** `brandProfileId` không có thì DB gắn kênh mặc định (P6-07). */
export async function createProject(
  db: StudioDb,
  title: string,
  options: { brandProfileId?: string } = {},
) {
  const [row] = await db
    .insert(projects)
    .values(
      options.brandProfileId === undefined
        ? { title }
        : { title, brandProfileId: options.brandProfileId },
    )
    .returning();
  if (row === undefined) {
    throw new Error("insert_project_failed");
  }
  return mapProjectRow(row);
}

export async function getProjectById(db: StudioDb, projectId: string) {
  const [row] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  return row === undefined ? null : mapProjectRow(row);
}

export async function updateProjectTitle(db: StudioDb, projectId: string, title: string) {
  const [row] = await db
    .update(projects)
    .set({ title, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning();
  return row === undefined ? null : mapProjectRow(row);
}

/** Chủ đề trong brief mà run dùng (brief lúc bắt đầu run, không phải brief mới nhất); không có run thì null. */
export async function getRunBriefTopic(db: StudioDb, runId: string): Promise<string | null> {
  const [row] = await db
    .select({ topic: briefs.topic })
    .from(workflowRuns)
    .innerJoin(briefs, eq(briefs.id, workflowRuns.briefId))
    .where(eq(workflowRuns.id, runId))
    .limit(1);
  return row?.topic ?? null;
}

export async function getLatestBrief(db: StudioDb, projectId: string) {
  const [row] = await db
    .select()
    .from(briefs)
    .where(eq(briefs.projectId, projectId))
    .orderBy(desc(briefs.createdAt))
    .limit(1);
  if (row === undefined) {
    return null;
  }
  return {
    id: row.id,
    projectId: row.projectId,
    topic: row.topic,
    audience: row.audience,
    goal: row.goal,
    durationSec: row.durationSec,
    language: row.language as "vi",
    tone: row.tone,
    visualStyle: row.visualStyle,
    notes: row.notes ?? undefined,
    formatId: row.formatId,
    formatVersion: row.formatVersion,
    createdAt: toIso(row.createdAt),
  };
}

export async function countBriefsForProject(db: StudioDb, projectId: string): Promise<number> {
  const rows = await db
    .select({ id: briefs.id })
    .from(briefs)
    .where(eq(briefs.projectId, projectId));
  return rows.length;
}

export async function listBriefsForProject(db: StudioDb, projectId: string) {
  return db
    .select({ id: briefs.id, topic: briefs.topic, durationSec: briefs.durationSec })
    .from(briefs)
    .where(eq(briefs.projectId, projectId))
    .orderBy(desc(briefs.createdAt));
}

export async function insertBrief(db: StudioDb, projectId: string, body: NewBriefInput) {
  const [row] = await db
    .insert(briefs)
    .values({
      projectId,
      topic: body.topic,
      audience: body.audience,
      goal: body.goal,
      durationSec: body.durationSec,
      language: body.language,
      tone: body.tone,
      visualStyle: body.visualStyle,
      notes: body.notes ?? null,
      formatId: body.formatId ?? "story",
      formatVersion: body.formatVersion ?? 1,
    })
    .returning();
  if (row === undefined) {
    throw new Error("insert_brief_failed");
  }
  return {
    id: row.id,
    projectId: row.projectId,
    topic: row.topic,
    audience: row.audience,
    goal: row.goal,
    durationSec: row.durationSec,
    language: row.language as "vi",
    tone: row.tone,
    visualStyle: row.visualStyle,
    notes: row.notes ?? undefined,
    formatId: row.formatId,
    formatVersion: row.formatVersion,
    createdAt: toIso(row.createdAt),
  };
}

export async function getLatestWorkflowRun(db: StudioDb, projectId: string) {
  const [row] = await db
    .select({
      id: workflowRuns.id,
      status: workflowRuns.status,
      createdAt: workflowRuns.createdAt,
      updatedAt: workflowRuns.updatedAt,
    })
    .from(workflowRuns)
    .where(eq(workflowRuns.projectId, projectId))
    .orderBy(desc(workflowRuns.createdAt))
    .limit(1);
  if (row === undefined) {
    return null;
  }
  return {
    id: row.id,
    status: row.status,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

export async function getReferenceById(db: StudioDb, referenceId: string) {
  const [row] = await db.select().from(references).where(eq(references.id, referenceId)).limit(1);
  return row ?? null;
}

export async function listReferences(db: StudioDb, projectId: string) {
  const rows = await db
    .select()
    .from(references)
    .where(eq(references.projectId, projectId))
    .orderBy(desc(references.createdAt));
  return rows.map((row) => ({
    id: row.id,
    projectId: row.projectId,
    kind: row.kind as "user_file" | "user_url",
    title: row.title,
    mediaType: row.mediaType,
    byteSize: row.byteSize,
    createdAt: toIso(row.createdAt),
  }));
}

export async function insertReferenceFile(
  db: StudioDb,
  input: {
    projectId: string;
    storageKey: string;
    title: string | null;
    mediaType: string;
    byteSize: number;
    contentHash: string | null;
  },
) {
  const [row] = await db
    .insert(references)
    .values({
      projectId: input.projectId,
      kind: "user_file",
      uri: input.storageKey,
      title: input.title,
      mediaType: input.mediaType,
      byteSize: input.byteSize,
      contentHash: input.contentHash,
    })
    .returning();
  if (row === undefined) {
    throw new Error("insert_reference_failed");
  }
  return {
    id: row.id,
    projectId: row.projectId,
    kind: row.kind as "user_file" | "user_url",
    title: row.title,
    mediaType: row.mediaType,
    byteSize: row.byteSize,
    createdAt: toIso(row.createdAt),
  };
}

export async function insertReferenceUrl(
  db: StudioDb,
  input: { projectId: string; url: string; title: string | null },
) {
  const [row] = await db
    .insert(references)
    .values({
      projectId: input.projectId,
      kind: "user_url",
      uri: input.url,
      title: input.title,
      mediaType: null,
      byteSize: null,
      contentHash: null,
    })
    .returning();
  if (row === undefined) {
    throw new Error("insert_reference_failed");
  }
  return {
    id: row.id,
    projectId: row.projectId,
    kind: row.kind as "user_file" | "user_url",
    title: row.title,
    mediaType: row.mediaType,
    byteSize: row.byteSize,
    createdAt: toIso(row.createdAt),
  };
}

export async function deleteReference(
  db: StudioDb,
  projectId: string,
  referenceId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(references)
    .where(and(eq(references.id, referenceId), eq(references.projectId, projectId)))
    .returning({ id: references.id });
  return deleted.length > 0;
}
