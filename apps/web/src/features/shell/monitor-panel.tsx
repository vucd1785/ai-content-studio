import { lazy, Suspense, useState } from "react";
import { useProjectDetail, useProjects } from "@/features/projects/use-projects";
import { runTone } from "@/features/run/run-status";
import { vi } from "@/i18n/vi";
import { cn } from "@/lib/utils";
import { AGENT_ROLES, type AgentRole, type AgentStatus } from "@/studio/studio-model";
import { useStudioRun } from "@/studio/use-studio-run";

const StudioWorkspace = lazy(() =>
  import("@/studio/studio-workspace").then((module) => ({ default: module.StudioWorkspace })),
);

/** Robot ui-kit theo vai trò (agent_run_role). */
const ROBOT: Record<AgentRole, string> = {
  producer: "agent_coordinator",
  research: "agent_research",
  script: "agent_script",
  visual: "agent_visual",
  voice: "agent_voice",
  video: "agent_render",
  qa: "agent_qa",
  publish: "agent_script",
};

const STATUS_CLASS: Record<AgentStatus, string> = {
  idle: "text-muted-foreground",
  queued: "text-warning",
  running: "text-info",
  waiting_approval: "text-warning",
  completed: "text-success",
  failed: "text-destructive",
  cancelled: "text-muted-foreground",
};

/** Lượt chạy cần giám sát: của dự án đang mở; ở trang tổng quan là dự án đầu tiên máy đang chạy. */
export function useMonitoredRunId(projectId: string | null): string | null {
  const detail = useProjectDetail(projectId ?? "");
  const projects = useProjects();
  if (projectId !== null) {
    return detail.data?.workflowRun?.id ?? null;
  }
  const working = projects.data?.projects.find(
    (p) => runTone(p.latestRun?.status ?? null) === "working",
  );
  return working?.latestRun?.id ?? null;
}

const MONITOR_PREF_KEY = "monitor-panel";
type MonitorPref = "auto" | "open" | "closed";

function readPref(): MonitorPref {
  try {
    const value = localStorage.getItem(MONITOR_PREF_KEY);
    return value === "open" || value === "closed" ? value : "auto";
  } catch {
    return "auto";
  }
}

/**
 * Panel giám sát bên phải (P7-04, chế độ Làm việc): danh sách 2D các vai trò từ trạng thái đã lưu (snapshot + SSE)
 * và tiến độ render thật. Không có thao tác đổi workflow.
 * Thu gọn được (ADR-020): mặc định thu gọn khi không có lượt chạy để nhường chỗ cho nội dung, mở khi có.
 */
export function MonitorPanel({ projectId }: { projectId: string | null }) {
  const runId = useMonitoredRunId(projectId);
  const [pref, setPref] = useState<MonitorPref>(readPref);
  const collapsed = pref === "closed" || (pref === "auto" && runId === null);
  const toggle = () => {
    const next: MonitorPref = collapsed ? "open" : "closed";
    setPref(next);
    try {
      localStorage.setItem(MONITOR_PREF_KEY, next);
    } catch {
      // Trình duyệt chặn lưu: vẫn đổi trong phiên này.
    }
  };
  if (collapsed) {
    return (
      <aside
        aria-label={vi.shell.regionMonitor}
        className="bg-surface-raised hidden w-12 shrink-0 flex-col items-center gap-3 border-l py-4 lg:flex"
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={false}
          title={vi.shell.monitorExpand}
          className="hover:bg-muted rounded-lg p-1.5"
        >
          <img src="/assets/robots/agent_coordinator.svg" alt="" className="size-7" />
          <span className="sr-only">{vi.shell.monitorExpand}</span>
        </button>
      </aside>
    );
  }
  return (
    <aside
      aria-label={vi.shell.regionMonitor}
      className="bg-surface-raised hidden w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l p-4 lg:flex min-[1400px]:w-84"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{vi.shell.monitorTitle}</h2>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={true}
          className="text-muted-foreground hover:bg-muted rounded-lg px-2 py-1 text-xs font-semibold"
        >
          {vi.shell.monitorCollapse}
        </button>
      </div>
      {runId === null ? (
        <>
          <img
            src="/assets/studio/studio_isometric_light.svg"
            alt=""
            className="rounded-xl border dark:hidden"
          />
          <img
            src="/assets/studio/studio_isometric_dark.svg"
            alt=""
            className="hidden rounded-xl border dark:block"
          />
          <p className="text-muted-foreground text-xs">{vi.shell.monitorPlaceholder}</p>
          <p className="text-muted-foreground text-sm">{vi.shell.monitorNoRun}</p>
        </>
      ) : (
        <RoleList runId={runId} />
      )}
    </aside>
  );
}

function RoleList({ runId }: { runId: string }) {
  const state = useStudioRun(runId);
  const progress = state.renderProgress;
  return (
    <>
      <section aria-label={vi.studio.renderProgress} className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{vi.studio.renderProgress}</h3>
        {progress === null ? (
          <p className="text-muted-foreground text-xs">{vi.studio.statuses.idle}</p>
        ) : (
          <>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress.progress * 100)}
              aria-label={vi.studio.renderProgress}
              className="bg-muted h-2.5 overflow-hidden rounded-full"
            >
              <div
                className="bg-success h-full rounded-full"
                style={{ width: `${Math.round(progress.progress * 100)}%` }}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              {progress.renderedFrames} {vi.shell.renderFrames} ·{" "}
              {Math.round(progress.progress * 100)}%
            </p>
          </>
        )}
      </section>
      <ul className="flex flex-col gap-1" aria-label={vi.studio.rolePicker}>
        {AGENT_ROLES.map((role) => {
          const status = state.statuses[role] ?? "idle";
          return (
            <li key={role} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
              <img src={`/assets/robots/${ROBOT[role]}.svg`} alt="" className="size-10" />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold">{vi.studio.roles[role]}</span>
                <span className={cn("text-xs", STATUS_CLASS[status])}>
                  {vi.studio.statuses[status]}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Chế độ Giám sát: studio 3D cỡ lớn (lazy-load) cho lượt chạy của dự án đang mở. */
export function MonitorExpanded({ projectId }: { projectId: string | null }) {
  const runId = useMonitoredRunId(projectId);
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6">
      <h1 className="text-2xl font-semibold">{vi.studio.canvas}</h1>
      <p className="text-muted-foreground text-sm">{vi.shell.monitorExpandedHint}</p>
      {runId === null ? (
        <p className="text-muted-foreground text-sm">{vi.shell.monitorNoRun}</p>
      ) : (
        <section
          aria-label={vi.studio.canvas}
          // Canvas luôn nền tối: vùng này dùng token tối để chữ và nút đọc được ở cả hai theme.
          className="dark bg-background text-foreground rounded-2xl border p-4"
        >
          <Suspense fallback={<p className="text-muted-foreground text-sm">{vi.app.loading}</p>}>
            <StudioWorkspace runId={runId} />
          </Suspense>
        </section>
      )}
    </div>
  );
}
