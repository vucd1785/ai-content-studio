import {
  type ProjectListItem,
  projectCreateBodySchema,
  usageSummaryResponseSchema,
} from "@studio/contracts";
import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { useCreateProject, useProjects } from "@/features/projects/use-projects";
import { runStatusLabel, runTone } from "@/features/run/run-status";
import { notificationsSupported } from "@/features/shell/use-approval-alerts";
import { vi } from "@/i18n/vi";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

const numberFormat = new Intl.NumberFormat("vi-VN");

/** Đầu và cuối tháng hiện tại theo giờ máy của Director (P5-04). */
export function currentMonthRange(now = new Date()): { from: string; to: string } {
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
  };
}

function useMonthTokens() {
  const { from, to } = currentMonthRange();
  return useQuery({
    queryKey: ["usage-summary", from] as const,
    queryFn: () =>
      apiRequest(
        `/api/usage/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        {
          schema: usageSummaryResponseSchema,
        },
      ),
  });
}

/**
 * Trang dự án (P2-11, 06 mục Khung ứng dụng): số liệu tóm tắt, việc cần Director lên đầu, rồi mọi dự án.
 * Bấm một dự án mở màn của bước hiện tại.
 */
export function HomePage({ onSelect }: { onSelect: (projectId: string) => void }) {
  const projects = useProjects();
  const tokens = useMonthTokens();
  const list = projects.data?.projects ?? [];
  const status = (project: ProjectListItem) => project.latestRun?.status ?? null;
  const waiting = list.filter((project) => runTone(status(project)) === "waiting");
  const count = (tone: ReturnType<typeof runTone>) =>
    list.filter((project) => runTone(status(project)) === tone).length;
  const totalTokens =
    tokens.data === undefined
      ? null
      : tokens.data.inputTokens + tokens.data.outputTokens + tokens.data.thinkingTokens;

  const failed = list.filter((project) => runTone(status(project)) === "failed");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-6">
      <section className="bg-card flex items-center gap-6 overflow-hidden rounded-2xl border px-6 py-5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-2xl font-semibold">{vi.home.heading}</h1>
          <p className="text-lg font-semibold">{vi.greeting.title}</p>
          <p className="text-muted-foreground text-sm">{vi.home.subheading}</p>
        </div>
        <img
          src="/assets/characters/trio_hero.svg"
          alt=""
          className="hidden h-28 w-auto shrink-0 md:block"
        />
      </section>

      <section aria-label={vi.home.statsLabel} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={vi.home.statWaiting} value={String(count("waiting"))} tone="text-warning" />
        <Stat label={vi.home.statWorking} value={String(count("working"))} tone="text-info" />
        <Stat label={vi.home.statDone} value={String(count("done"))} tone="text-success" />
        <Stat
          label={vi.home.statTokens}
          value={totalTokens === null ? "–" : numberFormat.format(totalTokens)}
          tone="text-foreground"
        />
      </section>

      {waiting.length > 0 ? (
        <section
          aria-label={vi.home.needsYou}
          className="bg-card flex flex-col gap-3 rounded-2xl border p-5"
        >
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{vi.home.needsYou}</h2>
            <span className="bg-warning-bg text-warning rounded-full px-2.5 py-0.5 text-xs font-semibold">
              {waiting.length}
            </span>
            <EnableNotifications />
          </div>
          <div className="divide-border flex flex-col divide-y">
            {waiting.map((project) => (
              <button
                key={project.id}
                type="button"
                aria-label={`${project.title}: ${runStatusLabel(status(project))}`}
                onClick={() => onSelect(project.id)}
                className="hover:bg-muted/60 flex flex-wrap items-center gap-3 rounded-lg px-2 py-3 text-left"
              >
                <span className="min-w-0 flex-1 truncate text-base font-semibold">
                  {project.title}
                </span>
                <StatusBadge status={status(project)} />
                <span className="border-input bg-card rounded-lg border px-3 py-1.5 text-sm font-semibold">
                  {vi.home.openToReview}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {failed.length > 0 ? (
        <section
          aria-label={vi.home.needsFix}
          className="bg-card flex flex-col gap-3 rounded-2xl border p-5"
        >
          <h2 className="text-lg font-semibold">{vi.home.needsFix}</h2>
          <ul className="flex flex-col gap-2">
            {failed.map((project) => (
              <li key={project.id} className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onSelect(project.id)}
                  className="min-w-0 flex-1 truncate text-left text-sm font-semibold underline-offset-4 hover:underline"
                >
                  {project.title}
                </button>
                <StatusBadge status={status(project)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        aria-label={vi.home.allProjects}
        className="bg-card flex flex-col gap-4 rounded-2xl border p-5"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-lg font-semibold">{vi.home.allProjects}</h2>
          <NewProjectForm onCreated={onSelect} />
        </div>
        {projects.isError ? (
          <p className="text-destructive text-sm">{vi.project.listError}</p>
        ) : list.length === 0 ? (
          <EmptyState illustration="empty_projects" title={vi.shell.projectsEmpty}>
            {vi.shell.workspacePlaceholder}
          </EmptyState>
        ) : (
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[55%]" />
              <col className="w-[27%]" />
              <col className="hidden w-[18%] md:table-column" />
            </colgroup>
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs font-semibold uppercase">
                <th className="py-2 pr-3">{vi.home.colProject}</th>
                <th className="py-2 pr-3">{vi.home.colStatus}</th>
                <th className="hidden py-2 text-right md:table-cell">{vi.home.colUpdated}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((project) => (
                <tr key={project.id} className="hover:bg-muted/50 border-b last:border-0">
                  <td className="max-w-0 py-2.5 pr-3">
                    <button
                      type="button"
                      onClick={() => onSelect(project.id)}
                      className="w-full truncate text-left font-semibold"
                    >
                      {project.title}
                    </button>
                  </td>
                  <td className="py-2.5 pr-3">
                    <StatusBadge status={status(project)} />
                  </td>
                  <td className="text-muted-foreground hidden py-2.5 text-right text-xs md:table-cell">
                    {new Date(project.latestRun?.updatedAt ?? project.updatedAt).toLocaleString(
                      "vi-VN",
                      { dateStyle: "short", timeStyle: "short" },
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="bg-card flex flex-col gap-1 rounded-2xl border p-4">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className={cn("text-3xl font-semibold", tone)}>{value}</span>
    </div>
  );
}

/** Tạo dự án ngay trên trang dự án; tạo xong mở luôn dự án đó. */
function NewProjectForm({ onCreated }: { onCreated: (projectId: string) => void }) {
  const create = useCreateProject();
  const [title, setTitle] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = projectCreateBodySchema.safeParse({ title: title.trim() });
    if (!parsed.success) {
      setLocalError(title.trim() === "" ? vi.project.titleRequired : vi.project.titleTooLong);
      return;
    }
    setLocalError(null);
    create.mutate(parsed.data.title, {
      onSuccess: (project) => {
        setTitle("");
        onCreated(project.id);
      },
    });
  };
  const errorText = localError ?? (create.isError ? vi.project.createError : null);
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-1">
        <Label htmlFor="new-project-title">{vi.project.titleLabel}</Label>
        <Input
          id="new-project-title"
          className="w-64"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={errorText !== null}
          list="topic-ideas"
        />
        {/* Gợi ý chủ đề (ADR-020): bấm vào ô là thấy, vẫn gõ tên tự do được. */}
        <datalist id="topic-ideas">
          {vi.home.topicIdeas.map((idea) => (
            <option key={idea} value={idea} />
          ))}
        </datalist>
      </div>
      <Button type="submit" disabled={create.isPending}>
        {create.isPending ? vi.project.creating : vi.project.create}
      </Button>
      {errorText !== null ? (
        <p role="alert" className="text-destructive w-full text-xs">
          {errorText}
        </p>
      ) : null}
    </form>
  );
}

/** Nút xin quyền thông báo của trình duyệt (ADR-020); ẩn khi đã cho phép, đã chặn hoặc không hỗ trợ. */
function EnableNotifications() {
  const [permission, setPermission] = useState(() =>
    notificationsSupported() ? Notification.permission : "denied",
  );
  if (permission !== "default") {
    return null;
  }
  return (
    <button
      type="button"
      className="text-primary ml-auto text-xs font-semibold underline"
      onClick={() => {
        void Notification.requestPermission().then(setPermission);
      }}
    >
      {vi.shell.alertEnable}
    </button>
  );
}
