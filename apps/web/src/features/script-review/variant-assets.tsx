import { type RunAssetRequest, runAssetRequestListResponseSchema } from "@studio/contracts";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { vi } from "@/i18n/vi";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import { StillLightbox } from "./still-lightbox";

/** Yêu cầu tài sản của một run (ADR-017); đọc lại khi storyboard đang dựng. */
export function useRunAssetRequests(runId: string | null, storyboarding: boolean) {
  return useQuery({
    queryKey: ["asset-requests", runId] as const,
    enabled: runId !== null,
    refetchInterval: storyboarding ? 5_000 : false,
    queryFn: () =>
      apiRequest(`/api/workflow-runs/${encodeURIComponent(runId ?? "")}/asset-requests`, {
        schema: runAssetRequestListResponseSchema,
      }),
  });
}

export const assetPreviewUrl = (assetId: string) =>
  `/api/motion-assets/${encodeURIComponent(assetId)}/preview`;

function stateOf(request: RunAssetRequest): { label: string; className: string } {
  if (request.status !== "fulfilled" || request.asset === null) {
    return {
      label: `${vi.scriptReview.assetOpen} ${request.fallbackAssetId}`,
      className: "bg-warning-bg text-warning",
    };
  }
  return request.asset.status === "candidate"
    ? { label: vi.scriptReview.assetCandidate, className: "bg-info-bg text-info" }
    : { label: vi.scriptReview.assetApproved, className: "bg-success-bg text-success" };
}

/**
 * Tài sản hình động mới của một phương án (ADR-017 mục 3): ảnh xem trước, mô tả, cảnh dùng. Tài sản `candidate`
 * được duyệt cùng phương án khi Director bấm duyệt; khối này không có nút riêng.
 */
export function VariantAssets({ requests }: { requests: readonly RunAssetRequest[] }) {
  const [enlarged, setEnlarged] = useState<{ src: string; alt: string } | null>(null);
  if (requests.length === 0) {
    return null;
  }
  return (
    <section
      aria-label={vi.scriptReview.newAssetsHeading}
      className="bg-muted/60 flex flex-col gap-2 rounded-xl border p-3"
    >
      <h5 className="text-sm font-semibold">{vi.scriptReview.newAssetsHeading}</h5>
      <ul className="flex flex-col gap-2">
        {requests.map((request) => {
          const state = stateOf(request);
          return (
            <li key={request.id} className="flex gap-3">
              {request.asset?.hasPreview ? (
                <button
                  type="button"
                  title={vi.scriptReview.openStill}
                  aria-label={`${vi.scriptReview.openStill}: ${request.description}`}
                  className="cursor-zoom-in shrink-0 rounded-md"
                  onClick={() =>
                    setEnlarged({
                      src: assetPreviewUrl(request.asset?.assetId ?? ""),
                      alt: request.description,
                    })
                  }
                >
                  <img
                    src={assetPreviewUrl(request.asset.assetId)}
                    alt={request.description}
                    className="aspect-[9/16] w-20 rounded-md border object-cover"
                  />
                </button>
              ) : (
                <div className="bg-card text-muted-foreground flex aspect-[9/16] w-20 shrink-0 items-center justify-center rounded-md border text-[10px]">
                  {request.kind}
                </div>
              )}
              <div className="flex min-w-0 flex-col gap-1 text-xs">
                <span className="text-sm">{request.description}</span>
                <span className="text-muted-foreground">
                  {vi.scriptReview.scenes}: {request.sceneIds.join(", ")}
                  {request.asset === null ? "" : ` · ${request.asset.assetId}`}
                </span>
                <span
                  className={cn(
                    "self-start rounded-full px-2 py-0.5 font-semibold",
                    state.className,
                  )}
                >
                  {state.label}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <StillLightbox
        src={enlarged?.src ?? null}
        alt={enlarged?.alt ?? ""}
        onClose={() => setEnlarged(null)}
      />
    </section>
  );
}
