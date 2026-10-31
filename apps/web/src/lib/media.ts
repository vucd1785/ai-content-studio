/** Route media (P2-09): MP4 của preview và export, WAV trong `audio.storageKey` của render props. Chỉ đọc. */
export const artifactMediaUrl = (artifactId: string) =>
  `/api/artifacts/${encodeURIComponent(artifactId)}/media`;
