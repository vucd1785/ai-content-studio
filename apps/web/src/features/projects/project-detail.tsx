import { ScriptReviewPanel } from "@/features/script-review/script-review-panel";
import { UsagePanel } from "@/features/usage/usage-panel";
import { lazy, Suspense } from "react";
import { vi } from "@/i18n/vi";
import { BriefForm } from "./brief-form";
import { ReferenceUpload } from "./reference-upload";
import { useProjectDetail } from "./use-projects";

// Remotion player nặng (~1,3 MB): tải riêng khi trang project mở, không nằm trong bundle chính.
const PreviewPanel = lazy(() =>
  import("@/features/preview/preview-panel").then((module) => ({ default: module.PreviewPanel })),
);

export function ProjectDetail({ projectId }: { projectId: string }) {
  const detail = useProjectDetail(projectId);

  if (detail.isPending) {
    return <p className="text-muted-foreground text-sm">{vi.app.loading}</p>;
  }
  if (detail.isError) {
    return <p className="text-destructive text-sm">{vi.project.detailError}</p>;
  }

  const { project, brief, references, workflowRun } = detail.data;
  const runId = workflowRun?.id ?? null;
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-sm font-semibold">{project.title}</h2>
      {/* key theo project: đổi project thì nạp lại form; lưu brief không remount (giữ thông báo) */}
      <BriefForm key={project.id} projectId={project.id} brief={brief} />
      <ReferenceUpload projectId={project.id} references={references} />
      {/* Lượt chạy mới nhất của project (quyết định 2 của Director, 2026-10-31). */}
      <ScriptReviewPanel runId={runId} />
      <Suspense fallback={<p className="text-muted-foreground text-sm">{vi.app.loading}</p>}>
        <PreviewPanel runId={runId} />
      </Suspense>
      <UsagePanel runId={runId} />
    </div>
  );
}
