import { and, desc, eq } from "drizzle-orm";
import { briefs, projects, references, workflowRuns } from "./schema/index.js";
import type { StudioDb } from "./db.js";

export type NewBriefInput = {
  topic: string;
  audience: string;
  goal: string;
  durationSec: number;
  language: "vi";
  tone: string;
  visualStyle: string;
  notes?: string | undefined;
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

export async function listProjects(db: StudioDb) {
  const rows = await db.select().from(projects).orderBy(desc(projects.createdAt));
  return rows.map(mapProjectRow);
}

export async function createProject(db: StudioDb, title: string) {
  const [row] = await db.insert(projects).values({ title }).returning();
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
    createdAt: toIso(row.createdAt),
  };
}

export async function countBriefsForProject(db: StudioDb, projectId: string): Promise<number> {
  const rows = await db.select({ id: briefs.id }).from(briefs).where(eq(briefs.projectId, projectId));
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
