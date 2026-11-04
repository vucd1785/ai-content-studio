import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HomePage } from "@/features/home/home-page";
import { ProjectDetail } from "@/features/projects/project-detail";
import { ProjectNav } from "@/features/projects/project-nav";
import { useProjects } from "@/features/projects/use-projects";
import { useLogout } from "@/features/session/use-session";
import { vi } from "@/i18n/vi";
import { WorkerStatusPill } from "./worker-status";

/**
 * Khung ứng dụng theo 06-3D-UI-DESIGN (P2-11): thanh trên (logo, đường dẫn, trạng thái worker, đăng xuất);
 * chưa chọn dự án thì là trang dự án; trong một dự án thì cột trái hẹp cộng màn của bước hiện tại.
 * Studio 3D nằm trong màn "Đang chạy", không còn cột phải cố định.
 */
export function AppShell() {
  const logout = useLogout();
  const projects = useProjects();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedTitle = projects.data?.projects.find((project) => project.id === selectedId)?.title;

  return (
    <div className="flex h-screen flex-col">
      <header className="bg-surface-raised flex h-14 shrink-0 items-center gap-3 border-b px-5">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="flex items-center gap-2.5"
        >
          <span className="bg-primary size-7 rounded-lg" aria-hidden="true" />
          <span className="text-[15px] font-semibold">{vi.app.name}</span>
        </button>
        {selectedTitle === undefined ? null : (
          <>
            <span className="text-muted-foreground" aria-hidden="true">
              /
            </span>
            <span className="text-muted-foreground truncate text-sm">{selectedTitle}</span>
          </>
        )}
        <div className="flex-1" />
        <WorkerStatusPill />
        <Button
          variant="outline"
          size="sm"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          {logout.isPending ? vi.shell.loggingOut : vi.shell.logout}
        </Button>
      </header>
      {selectedId === null ? (
        <main aria-label={vi.shell.regionWorkspace} className="min-h-0 flex-1 overflow-y-auto">
          <HomePage onSelect={setSelectedId} />
        </main>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[14rem_minmax(0,1fr)]">
          <aside
            aria-label={vi.shell.regionProjects}
            className="bg-surface-raised min-h-0 overflow-y-auto border-r p-3"
          >
            <ProjectNav
              selectedId={selectedId}
              onSelect={setSelectedId}
              onHome={() => setSelectedId(null)}
            />
          </aside>
          <main aria-label={vi.shell.regionWorkspace} className="min-h-0 overflow-y-auto px-7 py-6">
            <ProjectDetail key={selectedId} projectId={selectedId} />
          </main>
        </div>
      )}
    </div>
  );
}
