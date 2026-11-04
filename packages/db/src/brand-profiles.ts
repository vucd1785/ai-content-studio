import { asc, eq, inArray } from "drizzle-orm";
import type { StudioDb } from "./db.js";
import { brandCharacters, brandProfiles } from "./schema/index.js";

/** Kênh và dàn nhân vật (ADR-013, P6-07). Chỉ đọc; sửa kênh làm ở P6-11. */

export type BrandCharacterRow = typeof brandCharacters.$inferSelect;
export type BrandProfileRow = typeof brandProfiles.$inferSelect;

function toIso(date: Date): string {
  return date.toISOString();
}

export function mapBrandCharacterRow(row: BrandCharacterRow) {
  return {
    id: row.id,
    characterKey: row.characterKey,
    displayName: row.displayName,
    role: row.role as "protagonist" | "explainer" | "companion",
    skinAssetId: row.skinAssetId,
    personality: row.personality,
    catchphrases: row.catchphrases as string[],
    signatureActionId: row.signatureActionId,
    speaks: row.speaks,
    voiceId: row.voiceId,
    sortOrder: row.sortOrder,
  };
}

export function mapBrandProfileRow(row: BrandProfileRow, characters: BrandCharacterRow[]) {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.displayName,
    palette: row.palette as Record<string, string>,
    fonts: row.fonts as { heading?: string; body?: string },
    introAssetId: row.introAssetId,
    outroAssetId: row.outroAssetId,
    sonicLogoAssetId: row.sonicLogoAssetId,
    toneRules: row.toneRules,
    narratorVoiceId: row.narratorVoiceId,
    isDefault: row.isDefault,
    characters: characters.map(mapBrandCharacterRow),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

async function charactersByProfile(db: StudioDb, profileIds: string[]) {
  const grouped = new Map<string, BrandCharacterRow[]>();
  if (profileIds.length === 0) {
    return grouped;
  }
  const rows = await db
    .select()
    .from(brandCharacters)
    .where(inArray(brandCharacters.brandProfileId, profileIds))
    .orderBy(asc(brandCharacters.sortOrder), asc(brandCharacters.characterKey));
  for (const row of rows) {
    const list = grouped.get(row.brandProfileId) ?? [];
    list.push(row);
    grouped.set(row.brandProfileId, list);
  }
  return grouped;
}

export async function listBrandProfiles(db: StudioDb) {
  const rows = await db.select().from(brandProfiles).orderBy(asc(brandProfiles.createdAt));
  const characters = await charactersByProfile(
    db,
    rows.map((row) => row.id),
  );
  return rows.map((row) => mapBrandProfileRow(row, characters.get(row.id) ?? []));
}

export async function getBrandProfileById(db: StudioDb, brandProfileId: string) {
  const [row] = await db
    .select()
    .from(brandProfiles)
    .where(eq(brandProfiles.id, brandProfileId))
    .limit(1);
  if (row === undefined) {
    return null;
  }
  const characters = await charactersByProfile(db, [row.id]);
  return mapBrandProfileRow(row, characters.get(row.id) ?? []);
}

export async function getDefaultBrandProfile(db: StudioDb) {
  const [row] = await db
    .select()
    .from(brandProfiles)
    .where(eq(brandProfiles.isDefault, true))
    .limit(1);
  if (row === undefined) {
    return null;
  }
  const characters = await charactersByProfile(db, [row.id]);
  return mapBrandProfileRow(row, characters.get(row.id) ?? []);
}
