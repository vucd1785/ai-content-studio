import { ScriptReviewPanel } from "@/features/script-review/script-review-panel";
import { studioLabels } from "./studio-labels";
import type { AgentStatus, StudioSelection } from "./studio-model";

/**
 * Bảng 2D mà mỗi lựa chọn mở (P4-04, 06-3D-UI-DESIGN). Chỉ dùng panel đã có:
 * vai trò kịch bản và bàn Director (nơi duyệt) mở bảng duyệt kịch bản của P2-07.
 * Vai trò chưa có panel thì chỉ hiện trạng thái đã lưu.
 */
export const INSPECTOR_PANELS = {
  director: "scriptReview",
  script: "scriptReview",
} as const satisfies Partial<Record<StudioSelection, "scriptReview">>;

export function inspectorPanelFor(selection: StudioSelection): "scriptReview" | null {
  return (INSPECTOR_PANELS as Partial<Record<StudioSelection, "scriptReview">>)[selection] ?? null;
}

export function selectionLabel(selection: StudioSelection): string {
  return selection === "director" ? studioLabels.director : studioLabels.roles[selection];
}

export function RoleInspector({
  selection,
  status,
  runId,
}: {
  selection: StudioSelection;
  /** Trạng thái đã lưu; bàn Director không có trạng thái agent. */
  status: AgentStatus | null;
  runId: string | null;
}) {
  const panel = inspectorPanelFor(selection);
  return (
    <section
      aria-label={studioLabels.inspector}
      className="flex flex-col gap-3"
      data-testid={`inspector-${selection}`}
    >
      <h3 className="text-sm font-semibold">
        {selectionLabel(selection)}
        {status === null ? null : ` · ${studioLabels.statuses[status]}`}
      </h3>
      {panel === "scriptReview" ? (
        <ScriptReviewPanel runId={runId} />
      ) : (
        <p className="text-muted-foreground text-sm">{studioLabels.noPanel}</p>
      )}
    </section>
  );
}
