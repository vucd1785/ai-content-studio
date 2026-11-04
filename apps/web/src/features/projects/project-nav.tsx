import { useProjects } from "@/features/projects/use-projects";
import { runTone, TONE_DOT } from "@/features/run/run-status";
import { vi } from "@/i18n/vi";
import { cn } from "@/lib/utils";

/** Cột trái hẹp trong một dự án (06 mục Khung ứng dụng): về trang dự án và các dự án gần đây kèm chấm trạng thái. */
export function ProjectNav({
  selectedId,
  onSelect,
  onHome,
}: {
  selectedId: string;
  onSelect: (projectId: string) => void;
  onHome: () => void;
}) {
  const projects = useProjects();
  return (
    <nav aria-label={vi.shell.projectsTitle} className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onHome}
        className="text-muted-foreground hover:text-foreground px-2 py-2 text-left text-sm"
      >
        {vi.home.backToAll}
      </button>
      <span className="text-muted-foreground px-2 pt-2 pb-1 text-xs">{vi.home.recent}</span>
      {projects.data?.projects.map((project) => {
        const tone = runTone(project.latestRun?.status ?? null);
        return (
          <button
            key={project.id}
            type="button"
            onClick={() => onSelect(project.id)}
            aria-current={project.id === selectedId ? "true" : undefined}
            className={cn(
              "hover:bg-secondary flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm",
              project.id === selectedId && "bg-secondary font-medium",
            )}
          >
            <span
              className={cn("size-2 shrink-0 rounded-full", TONE_DOT[tone])}
              aria-hidden="true"
            />
            <span className="truncate">{project.title}</span>
          </button>
        );
      })}
    </nav>
  );
}
