import {
  type MotionAsset,
  motionAssetListResponseSchema,
  motionAssetUsageResponseSchema,
} from "@studio/contracts";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { assetPreviewUrl } from "@/features/script-review/variant-assets";
import { vi } from "@/i18n/vi";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

const KINDS = ["prop", "background", "action", "pose", "expression", "camera", "character_skin"];

/**
 * Kho hình động chỉ đọc (P7-09, ADR-016/017): lọc theo loại và trạng thái, ảnh xem trước của tài sản tự tạo.
 * Không có nút duyệt: tài sản mới được duyệt cùng phương án ở Cổng 1.
 */
export function LibraryPage() {
  const [kind, setKind] = useState<string | null>(null);
  const [status, setStatus] = useState<"candidate" | "approved" | null>(null);
  /** `null`: mọi tài sản; `"unused"`: chưa dùng; số: chỉ số video trong `usage.videos`. */
  const [video, setVideo] = useState<number | "unused" | null>(null);
  const assets = useQuery({
    queryKey: ["motion-assets"] as const,
    queryFn: () => apiRequest("/api/motion-assets", { schema: motionAssetListResponseSchema }),
  });
  // ADR-021: tài sản có trong video nào (render props mới nhất của mỗi lượt chạy).
  const usage = useQuery({
    queryKey: ["motion-assets", "usage"] as const,
    queryFn: () =>
      apiRequest("/api/motion-assets/usage", { schema: motionAssetUsageResponseSchema }),
  });
  const usedBy = (assetId: string) => usage.data?.usage[assetId] ?? [];
  const list = (assets.data?.assets ?? []).filter(
    (a) =>
      (kind === null || a.kind === kind) &&
      (status === null || a.status === status) &&
      (video === null ||
        (video === "unused" ? usedBy(a.assetId).length === 0 : usedBy(a.assetId).includes(video))),
  );
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{vi.shell.navLibrary}</h1>
        <p className="text-muted-foreground text-sm">{vi.library.intro}</p>
      </div>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">{vi.library.kindFilter}</legend>
        <FilterChip active={kind === null} onClick={() => setKind(null)}>
          {vi.library.all}
        </FilterChip>
        {KINDS.map((k) => (
          <FilterChip key={k} active={kind === k} onClick={() => setKind(k)}>
            {(vi.library.kinds as Record<string, string>)[k] ?? k}
          </FilterChip>
        ))}
      </fieldset>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">{vi.library.statusFilter}</legend>
        <FilterChip active={status === null} onClick={() => setStatus(null)}>
          {vi.library.all}
        </FilterChip>
        <FilterChip active={status === "approved"} onClick={() => setStatus("approved")}>
          {vi.library.approved}
        </FilterChip>
        <FilterChip active={status === "candidate"} onClick={() => setStatus("candidate")}>
          {vi.library.candidate}
        </FilterChip>
      </fieldset>
      {usage.data !== undefined && usage.data.videos.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="library-video-filter" className="text-sm font-semibold">
            {vi.library.usageFilter}
          </label>
          <select
            id="library-video-filter"
            className="bg-card rounded-lg border px-3 py-1.5 text-sm"
            value={video === null ? "" : String(video)}
            onChange={(event) => {
              const value = event.target.value;
              setVideo(value === "" ? null : value === "unused" ? "unused" : Number(value));
            }}
          >
            <option value="">{vi.library.usageAll}</option>
            <option value="unused">{vi.library.usageUnused}</option>
            {usage.data.videos.map((v, i) => (
              <option key={v.workflowRunId} value={i}>
                {v.projectName}
                {v.exported ? ` (${vi.library.exportedMark})` : ""}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {assets.isError ? (
        <p className="text-destructive text-sm">{vi.library.error}</p>
      ) : assets.isPending ? (
        <p className="text-muted-foreground text-sm">{vi.app.loading}</p>
      ) : list.length === 0 ? (
        <EmptyState illustration="empty_projects" title={vi.library.empty} />
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {list.map((asset) => (
            <AssetCard
              key={asset.assetId}
              asset={asset}
              videos={
                usage.data === undefined
                  ? null
                  : usedBy(asset.assetId).map((i) => usage.data.videos[i]?.projectName ?? "")
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm font-semibold",
        active ? "bg-warning-bg border-warning/50 text-foreground" : "bg-card hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function AssetCard({
  asset,
  videos,
}: {
  asset: MotionAsset;
  /** Tên dự án dùng tài sản; null khi chưa tải được dữ liệu dùng. */
  videos: string[] | null;
}) {
  return (
    <li className="bg-card flex flex-col overflow-hidden rounded-2xl border">
      {asset.hasPreview ? (
        <img
          src={assetPreviewUrl(asset.assetId)}
          alt={asset.assetId}
          className="aspect-[9/16] w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="bg-muted text-muted-foreground flex h-28 w-full items-center justify-center text-xs">
          {vi.library.noPreview}
        </div>
      )}
      <div className="flex flex-col gap-1.5 p-3 text-xs">
        <span className="truncate text-sm font-semibold" title={asset.assetId}>
          {asset.assetId}
        </span>
        <span className="text-muted-foreground">
          {(vi.library.kinds as Record<string, string>)[asset.kind] ?? asset.kind} ·{" "}
          {asset.createdBy === "claude-code" ? vi.library.byClaude : vi.library.byDirector}
        </span>
        <span
          className={cn(
            "self-start rounded-full px-2 py-0.5 font-semibold",
            asset.status === "approved" ? "bg-success-bg text-success" : "bg-info-bg text-info",
          )}
        >
          {asset.status === "approved" ? vi.library.approved : vi.library.candidate}
        </span>
        {videos === null ? null : (
          <span
            data-testid="asset-usage"
            className="text-muted-foreground truncate"
            title={videos.join(", ")}
          >
            {videos.length === 0 ? vi.library.notUsed : vi.library.usedInCount(videos.length)}
          </span>
        )}
        {asset.tags.length > 0 ? (
          <span className="text-muted-foreground truncate">{asset.tags.join(", ")}</span>
        ) : null}
      </div>
    </li>
  );
}
