import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { ProjectDetail } from "@/features/projects/project-detail";
import { ProjectList } from "@/features/projects/project-list";
import { useProjectDetail } from "@/features/projects/use-projects";
import { useLogout } from "@/features/session/use-session";
import { vi } from "@/i18n/vi";

// three.js + react-three-fiber nặng: tải riêng khi chọn project, giữ bundle đăng nhập nhỏ.
const StudioWorkspace = lazy(() =>
  import("@/studio/studio-workspace").then((module) => ({ default: module.StudioWorkspace })),
);

/**
 * Shell ba vùng (06-3D-UI-DESIGN mục Bố cục): trái danh sách dự án, giữa studio 3D của lượt chạy
 * mới nhất, phải brief, tài liệu, duyệt kịch bản và usage của dự án đang chọn.
 */
export function AppShell() {
  const logout = useLogout();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <span className="font-semibold">{vi.app.name}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          {logout.isPending ? vi.shell.loggingOut : vi.shell.logout}
        </Button>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[16rem_1fr_22rem]">
        <aside aria-label={vi.shell.regionProjects} className="flex min-h-0 flex-col gap-3 border-r p-4">
          <ProjectList selectedId={selectedId} onSelect={setSelectedId} />
        </aside>
        <main aria-label={vi.shell.regionStudio} className="min-h-0 overflow-y-auto bg-black/30 p-4">
          {selectedId === null ? (
            <p className="text-muted-foreground text-sm">{vi.shell.studioPlaceholder}</p>
          ) : (
            <ShellStudio key={selectedId} projectId={selectedId} />
          )}
        </main>
        <aside
          aria-label={vi.shell.regionDetail}
          className="flex min-h-0 flex-col gap-3 overflow-y-auto border-l p-4"
        >
          {selectedId === null ? (
            <>
              <h2 className="text-sm font-semibold">{vi.shell.detailTitle}</h2>
              <p className="text-muted-foreground text-sm">{vi.shell.detailPlaceholder}</p>
            </>
          ) : (
            <ProjectDetail key={selectedId} projectId={selectedId} />
          )}
        </aside>
      </div>
    </div>
  );
}

/** Studio của project đang chọn: đọc run mới nhất từ cùng query chi tiết project (cache dùng chung). */
function ShellStudio({ projectId }: { projectId: string }) {
  const detail = useProjectDetail(projectId);
  if (detail.isPending) {
    return <p className="text-muted-foreground text-sm">{vi.app.loading}</p>;
  }
  return (
    <Suspense fallback={<p className="text-muted-foreground text-sm">{vi.app.loading}</p>}>
      <StudioWorkspace runId={detail.data?.workflowRun?.id ?? null} />
    </Suspense>
  );
}
