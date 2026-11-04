import { lazy, Suspense, useState } from "react";
import { FinalReviewPanel } from "@/features/final-review/final-review-panel";
import { RunControls } from "@/features/final-review/run-controls";
import { RunProgress } from "@/features/run/run-progress";
import { ScriptReviewPanel } from "@/features/script-review/script-review-panel";
import { useWorkflowRun } from "@/features/script-review/use-script-review";
import { UsagePanel } from "@/features/usage/usage-panel";
import { vi } from "@/i18n/vi";
import { cn } from "@/lib/utils";
import { BriefForm } from "./brief-form";
import { ReferenceUpload } from "./reference-upload";
import { StartRunButton } from "./start-run";
import { useProjectDetail } from "./use-projects";

// Remotion player và three.js nặng: chỉ tải khi mở đúng màn cần chúng.
const PreviewPanel = lazy(() =>
  import("@/features/preview/preview-panel").then((module) => ({ default: module.PreviewPanel })),
);
const StudioWorkspace = lazy(() =>
  import("@/studio/studio-workspace").then((module) => ({ default: module.StudioWorkspace })),
);

type Tab = "brief" | "running" | "script" | "preview" | "final";
const TABS: Tab[] = ["brief", "running", "script", "preview", "final"];

/** Màn mở sẵn theo trạng thái run (06 mục Năm màn hình). Director vẫn mở màn khác được. */
export function defaultTab(status: string | null): Tab {
  if (status === null || status === "cancelled") {
    return "brief";
  }
  if (status === "waiting_script_approval") {
    return "script";
  }
  if (["waiting_final_approval", "exporting", "exported"].includes(status)) {
    return "final";
  }
  return "running";
}

/**
 * Vùng làm việc của một dự án (P2-11, 06-3D-UI-DESIGN): tiêu đề, thanh tiến trình bảy bước, rồi màn của bước hiện tại.
 * Brief và bắt đầu lượt chạy; Đang chạy (studio 3D là khối chính); Duyệt kịch bản; Preview và version; Bản cuối.
 */
export function ProjectDetail({ projectId }: { projectId: string }) {
  const detail = useProjectDetail(projectId);
  const runId = detail.data?.workflowRun?.id ?? null;
  const run = useWorkflowRun(runId);
  const [chosenTab, setChosenTab] = useState<Tab | null>(null);

  if (detail.isPending) {
    return <p className="text-muted-foreground text-sm">{vi.app.loading}</p>;
  }
  if (detail.isError) {
    return <p className="text-destructive text-sm">{vi.project.detailError}</p>;
  }

  const { project, brief, references, workflowRun } = detail.data;
  const status = run.data?.workflowRun.status ?? workflowRun?.status ?? null;
  const tab = chosenTab ?? defaultTab(status);
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-semibold">{project.title}</h1>
        {run.data?.workflowRun.llmModel ? (
          <span className="text-muted-foreground text-xs" data-testid="run-model">
            {vi.runSteps.model} {run.data.workflowRun.llmModel}
            {brief === null ? null : ` · ${brief.durationSec} ${vi.workspace.seconds}`}
          </span>
        ) : null}
      </header>
      <RunProgress run={run.data ?? null} durationSec={brief?.durationSec ?? 60} />
      <div
        role="tablist"
        aria-label={vi.workspace.tabsLabel}
        className="flex flex-wrap gap-1 border-b"
      >
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              tab === id
                ? "border-primary text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
            onClick={() => setChosenTab(id)}
          >
            {vi.workspace.tabs[id]}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="flex flex-col gap-5"
      >
        {tab === "brief" ? (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex flex-col gap-5">
              {/* key theo project: đổi project thì nạp lại form; lưu brief không remount (giữ thông báo) */}
              <BriefForm key={project.id} projectId={project.id} brief={brief} />
              <ReferenceUpload projectId={project.id} references={references} />
            </div>
            <StartRunButton
              projectId={project.id}
              hasBrief={brief !== null}
              latestStatus={status}
              durationSec={brief?.durationSec ?? null}
            />
          </div>
        ) : null}
        {tab === "running" ? (
          runId === null ? (
            <p className="text-muted-foreground text-sm">{vi.workspace.noRunYet}</p>
          ) : (
            <>
              <RunControls runId={runId} />
              <section
                aria-label={vi.studio.canvas}
                className="rounded-2xl border bg-[#0b0d12] p-4"
              >
                <Suspense
                  fallback={<p className="text-muted-foreground text-sm">{vi.app.loading}</p>}
                >
                  <StudioWorkspace runId={runId} />
                </Suspense>
              </section>
              <UsagePanel runId={runId} />
            </>
          )
        ) : null}
        {tab === "script" ? <ScriptReviewPanel runId={runId} /> : null}
        {tab === "preview" ? (
          <Suspense fallback={<p className="text-muted-foreground text-sm">{vi.app.loading}</p>}>
            <PreviewPanel runId={runId} />
          </Suspense>
        ) : null}
        {tab === "final" ? <FinalReviewPanel runId={runId} /> : null}
      </div>
    </div>
  );
}
