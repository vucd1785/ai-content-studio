import { MEDIA_ARTIFACT_TYPES } from "@studio/contracts";

export type ArtifactSummary = { id: string; type: string; version: number; createdAt: string };

export type ArtifactGroup = { type: string; versions: ArtifactSummary[] };

/** Thứ tự nhóm theo pipeline (03-DATABASE-DESIGN); loại lạ xếp cuối. */
const TYPE_ORDER = [
  "render_props",
  "preview",
  "script",
  "research",
  "fetch_log",
  "storyboard",
  "audio",
  "alignment",
  "captions",
  "caption_override",
  "qa_report",
  "export",
];

/** Nhóm artifact theo loại, version mới trước. Chỉ sắp xếp, không bỏ version nào. */
export function groupArtifactVersions(artifacts: readonly ArtifactSummary[]): ArtifactGroup[] {
  const groups = new Map<string, ArtifactSummary[]>();
  for (const artifact of artifacts) {
    groups.set(artifact.type, [...(groups.get(artifact.type) ?? []), artifact]);
  }
  const rank = (type: string) => {
    const index = TYPE_ORDER.indexOf(type);
    return index === -1 ? TYPE_ORDER.length : index;
  };
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([type, versions]) => ({
      type,
      versions: [...versions].sort((a, b) => b.version - a.version),
    }));
}

/** Mặc định mở render props mới nhất, nếu có. */
export function defaultArtifactId(groups: readonly ArtifactGroup[]): string | null {
  return groups.find((group) => group.type === "render_props")?.versions[0]?.id ?? null;
}

const MEDIA: ReadonlySet<string> = new Set(MEDIA_ARTIFACT_TYPES);

export function isMediaArtifact(type: string): boolean {
  return MEDIA.has(type);
}
