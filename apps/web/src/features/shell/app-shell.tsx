import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toast";
import { BrandPage } from "@/features/brand/brand-page";
import { HomePage } from "@/features/home/home-page";
import { LibraryPage } from "@/features/library/library-page";
import { ProjectDetail } from "@/features/projects/project-detail";
import { useProjects } from "@/features/projects/use-projects";
import { PublishGuidePage } from "@/features/publish/publish-guide-page";
import { runTone, TONE_DOT } from "@/features/run/run-status";
import { useLogout } from "@/features/session/use-session";
import { useApprovalAlerts } from "@/features/shell/use-approval-alerts";
import { UsagePage } from "@/features/usage/usage-page";
import { VideosPage } from "@/features/videos/videos-page";
import { vi } from "@/i18n/vi";
import { type Route, useHashRoute } from "@/lib/hash-route";
import { type LayoutMode, setUiPrefs, type Theme, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";
import { MonitorExpanded, MonitorPanel } from "./monitor-panel";
import { WorkerStatusPill } from "./worker-status";

const MODES: LayoutMode[] = ["work", "focus", "monitor"];
const THEMES: Theme[] = ["light", "dark"];

/**
 * Khung ứng dụng theo ui-kit (P7-04): thanh trên 64 px, điều hướng trái 208–224 px, vùng chính, panel giám sát
 * 288–336 px. Ba chế độ: Làm việc (ba vùng), Tập trung (ẩn panel giám sát), Giám sát (studio 3D cỡ lớn).
 * Vị trí lưu trên URL (hash), chế độ và theme lưu trên máy.
 */
export function AppShell() {
  const [route, navigate] = useHashRoute();
  useApprovalAlerts();
  const prefs = useUiPrefs();
  const projectId = route.page === "project" ? route.projectId : null;

  return (
    <div className="flex h-screen flex-col">
      <TopBar route={route} navigate={navigate} />
      <div className="flex min-h-0 flex-1">
        <SideNav route={route} navigate={navigate} />
        <main aria-label={vi.shell.regionWorkspace} className="min-w-0 flex-1 overflow-y-auto">
          {prefs.mode === "monitor" ? (
            <MonitorExpanded projectId={projectId} />
          ) : (
            <Page route={route} navigate={navigate} />
          )}
        </main>
        {prefs.mode === "work" ? <MonitorPanel projectId={projectId} /> : null}
      </div>
      <Toaster />
    </div>
  );
}

function Page({ route, navigate }: { route: Route; navigate: (route: Route) => void }) {
  switch (route.page) {
    case "project":
      return (
        <div className="px-7 py-6">
          <ProjectDetail
            key={route.projectId}
            projectId={route.projectId}
            tab={route.tab}
            onTab={(tab) => navigate({ page: "project", projectId: route.projectId, tab })}
          />
        </div>
      );
    case "usage":
      return <UsagePage />;
    case "library":
      return <LibraryPage />;
    case "videos":
      return (
        <VideosPage
          onOpenProject={(projectId) => navigate({ page: "project", projectId, tab: "final" })}
        />
      );
    case "brand":
      return <BrandPage />;
    case "publish-guide":
      return <PublishGuidePage />;
    default:
      return (
        <HomePage onSelect={(projectId) => navigate({ page: "project", projectId, tab: null })} />
      );
  }
}

function TopBar({ route, navigate }: { route: Route; navigate: (route: Route) => void }) {
  const logout = useLogout();
  const prefs = useUiPrefs();
  const projects = useProjects();
  const title =
    route.page === "project"
      ? projects.data?.projects.find((p) => p.id === route.projectId)?.title
      : undefined;
  return (
    <header className="bg-surface-raised flex h-16 shrink-0 items-center gap-3 border-b px-5">
      <button
        type="button"
        onClick={() => navigate({ page: "home" })}
        aria-label={vi.app.name}
        className="flex items-center gap-2.5 rounded-lg"
      >
        <img src="/assets/brand/logo_mark.svg" alt="" className="size-9" />
        <span className="hidden text-lg font-semibold lg:inline">{vi.app.name}</span>
      </button>
      {title === undefined ? null : (
        <span className="hidden min-w-0 items-center gap-3 xl:flex">
          <span className="text-muted-foreground" aria-hidden="true">
            /
          </span>
          <span className="text-muted-foreground truncate text-sm">{title}</span>
        </span>
      )}
      <div className="flex-1" />
      <WorkerStatusPill />
      <Segmented
        label={vi.shell.layoutLabel}
        options={MODES.map((mode) => ({ id: mode, label: vi.shell.modes[mode] }))}
        value={prefs.mode}
        onChange={(mode) => setUiPrefs({ mode })}
      />
      <Segmented
        label={vi.shell.themeLabel}
        options={THEMES.map((theme) => ({ id: theme, label: vi.shell.themes[theme] }))}
        value={prefs.theme}
        onChange={(theme) => setUiPrefs({ theme })}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
      >
        {logout.isPending ? vi.shell.loggingOut : vi.shell.logout}
      </Button>
    </header>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="bg-muted hidden items-center gap-0.5 rounded-lg p-0.5 md:flex">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={option.id === value}
          onClick={() => onChange(option.id)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-semibold",
            option.id === value
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}

const NAV: { page: Route["page"]; label: string }[] = [
  { page: "home", label: vi.shell.navOverview },
  { page: "usage", label: vi.shell.navUsage },
  { page: "videos", label: vi.shell.navVideos },
  { page: "library", label: vi.shell.navLibrary },
  { page: "brand", label: vi.shell.navBrand },
  { page: "publish-guide", label: vi.shell.navPublishGuide },
];

function SideNav({ route, navigate }: { route: Route; navigate: (route: Route) => void }) {
  const projects = useProjects();
  const selectedId = route.page === "project" ? route.projectId : null;
  return (
    <aside
      aria-label={vi.shell.regionProjects}
      className="bg-surface-raised flex w-52 shrink-0 flex-col gap-5 overflow-y-auto border-r p-3 min-[1400px]:w-56"
    >
      <nav aria-label={vi.shell.navLabel} className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = route.page === item.page;
          return (
            <button
              key={item.page}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => navigate({ page: item.page } as Route)}
              className={cn(
                "rounded-lg px-3 py-2.5 text-left text-sm",
                active
                  ? "bg-warning-bg text-foreground font-semibold"
                  : "hover:bg-secondary text-foreground",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
      <nav aria-label={vi.shell.recentProjects} className="flex flex-col gap-1">
        <span className="text-muted-foreground px-3 pb-1 text-xs font-semibold tracking-wide uppercase">
          {vi.shell.recentProjects}
        </span>
        {projects.data?.projects.slice(0, 12).map((project) => {
          const tone = runTone(project.latestRun?.status ?? null);
          return (
            <button
              key={project.id}
              type="button"
              onClick={() => navigate({ page: "project", projectId: project.id, tab: null })}
              aria-current={project.id === selectedId ? "true" : undefined}
              className={cn(
                "hover:bg-secondary flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm",
                project.id === selectedId && "bg-secondary font-semibold",
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
    </aside>
  );
}
