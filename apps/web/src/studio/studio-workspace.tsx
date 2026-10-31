import { Component, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { RoleInspector, selectionLabel } from "./role-inspector";
import { studioLabels } from "./studio-labels";
import { AGENT_ROLES, type StudioSelection } from "./studio-model";
import { StudioScene } from "./studio-scene";
import { type StudioRunDeps, useStudioRun } from "./use-studio-run";

const SELECTIONS: readonly StudioSelection[] = ["director", ...AGENT_ROLES];

/**
 * Studio kèm inspector (P4-04). Click avatar trên canvas và nút trong danh sách 2D cùng đổi một lựa chọn.
 * Danh sách vai trò và inspector nằm ngoài canvas, nên ẩn canvas vẫn chọn và duyệt được bằng phím hoặc nút 2D.
 */
export function StudioWorkspace({ runId, deps }: { runId: string | null; deps?: StudioRunDeps }) {
  const state = useStudioRun(runId, deps);
  const [selected, setSelected] = useState<StudioSelection | null>(null);
  const [canvasVisible, setCanvasVisible] = useState(true);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={!canvasVisible}
          onClick={() => setCanvasVisible((visible) => !visible)}
        >
          {canvasVisible ? studioLabels.hideCanvas : studioLabels.showCanvas}
        </Button>
      </div>
      {canvasVisible ? (
        <div className="h-80 min-h-0" data-testid="studio-canvas">
          <CanvasBoundary>
            <StudioScene
              statuses={state.statuses}
              renderProgress={state.renderProgress}
              selected={selected}
              onSelect={setSelected}
            />
          </CanvasBoundary>
        </div>
      ) : null}
      <nav aria-label={studioLabels.rolePicker}>
        <ul className="flex flex-wrap gap-2">
          {SELECTIONS.map((id) => {
            const status = id === "director" ? null : (state.statuses[id] ?? "idle");
            return (
              <li key={id} className="flex items-center gap-1">
                {/* Nhãn nút chỉ là tên vai trò (từ điển vi); trạng thái nằm cạnh nút. */}
                <Button
                  type="button"
                  size="sm"
                  variant={id === selected ? "secondary" : "outline"}
                  aria-pressed={id === selected}
                  aria-describedby={status === null ? undefined : `studio-status-${id}`}
                  onClick={() => setSelected(id)}
                >
                  {selectionLabel(id)}
                </Button>
                {status === null ? null : (
                  <span id={`studio-status-${id}`} className="text-muted-foreground text-xs">
                    {studioLabels.statuses[status]}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      {selected === null ? (
        <p className="text-muted-foreground text-sm">{studioLabels.inspectorHint}</p>
      ) : (
        <RoleInspector
          selection={selected}
          status={selected === "director" ? null : (state.statuses[selected] ?? "idle")}
          runId={runId}
        />
      )}
    </div>
  );
}

/**
 * Canvas lỗi (không có WebGL, thiếu ResizeObserver) chỉ thay vùng canvas bằng thông báo;
 * danh sách vai trò và inspector vẫn chạy, đúng yêu cầu "ẩn canvas không gỡ route duyệt".
 */
class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    if (this.state.failed) {
      return (
        <p role="status" className="text-muted-foreground text-sm">
          {studioLabels.canvasUnavailable}
        </p>
      );
    }
    return this.props.children;
  }
}
