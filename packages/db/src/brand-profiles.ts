import { asc, eq, inArray } from "drizzle-orm";
import type { StudioDb } from "./db.js";
import { brandCharacters, brandProfiles, projects } from "./schema/index.js";

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
    copyrightContact: row.copyrightContact,
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

/** Liên hệ bản quyền của kênh mặc định (ADR-018); null khi chưa có kênh mặc định. */
export async function getDefaultBrandContact(db: StudioDb) {
  const [row] = await db
    .select({
      id: brandProfiles.id,
      displayName: brandProfiles.displayName,
      copyrightContact: brandProfiles.copyrightContact,
    })
    .from(brandProfiles)
    .where(eq(brandProfiles.isDefault, true))
    .limit(1);
  return row ?? null;
}

/**
 * Ghi liên hệ bản quyền (chuỗi rỗng là xóa) và tên kênh (ADR-021; thiếu là giữ tên cũ) của kênh mặc định.
 * Trả hàng sau khi ghi.
 */
export async function setDefaultBrandContact(db: StudioDb, contact: string, displayName?: string) {
  const value = contact.trim() === "" ? null : contact.trim();
  const name = displayName?.trim();
  const [row] = await db
    .update(brandProfiles)
    .set({
      copyrightContact: value,
      ...(name === undefined || name === "" ? {} : { displayName: name }),
      updatedAt: new Date(),
    })
    .where(eq(brandProfiles.isDefault, true))
    .returning({
      id: brandProfiles.id,
      displayName: brandProfiles.displayName,
      copyrightContact: brandProfiles.copyrightContact,
    });
  return row ?? null;
}

/**
 * Chỉ test: kênh phụ có tên (không phải kênh mặc định, không nhân vật), gắn cho dự án test để duyệt bản cuối
 * mà không đổi tên kênh mặc định của Director (ADR-021). Xóa dự án trước rồi mới xóa kênh.
 */
export async function createBrandProfileForTests(db: StudioDb, displayName: string) {
  const slug = `test-${Math.random().toString(36).slice(2, 12)}`;
  const [row] = await db.insert(brandProfiles).values({ slug, displayName }).returning();
  if (row === undefined) {
    throw new Error("insert_brand_profile_failed");
  }
  return row.id;
}

export async function setProjectBrandForTests(db: StudioDb, projectId: string, brandId: string) {
  await db.update(projects).set({ brandProfileId: brandId }).where(eq(projects.id, projectId));
}

export async function deleteBrandProfileForTests(db: StudioDb, brandId: string) {
  await db.delete(brandProfiles).where(eq(brandProfiles.id, brandId));
}
