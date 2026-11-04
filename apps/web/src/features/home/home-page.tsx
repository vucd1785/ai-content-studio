import {
  type ProjectListItem,
  projectCreateBodySchema,
  usageSummaryResponseSchema,
} from "@studio/contracts";
import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateProject, useProjects } from "@/features/projects/use-projects";
import { runStatusLabel, runTone, TONE_DOT, TONE_TEXT } from "@/features/run/run-status";
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{vi.home.heading}</h1>
          <p className="text-muted-foreground text-sm">{vi.home.subheading}</p>
        </div>
        <NewProjectForm onCreated={onSelect} />
      </div>

      <section aria-label={vi.home.statsLabel} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={vi.home.statWaiting} value={String(count("waiting"))} tone="text-warning" />
        <Stat label={vi.home.statWorking} value={String(count("working"))} tone="text-primary" />
        <Stat label={vi.home.statDone} value={String(count("done"))} tone="text-success" />
        <Stat
          label={vi.home.statTokens}
          value={totalTokens === null ? "–" : numberFormat.format(totalTokens)}
          tone="text-foreground"
        />
      </section>

      {waiting.length > 0 ? (
        <section aria-label={vi.home.needsYou} className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">{vi.home.needsYou}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {waiting.map((project) => (
              <button
                key={project.id}
                type="button"
                aria-label={`${project.title}: ${runStatusLabel(status(project))}`}
                onClick={() => onSelect(project.id)}
                className="border-warning/40 bg-warning/5 hover:bg-warning/10 flex gap-4 rounded-xl border p-4 text-left"
              >
                <span className="bg-secondary text-muted-foreground flex h-24 w-14 shrink-0 items-center justify-center rounded-md text-[11px]">
                  9:16
                </span>
                <span className="flex min-w-0 flex-col gap-2">
                  <span className="bg-warning/15 text-warning self-start rounded-full px-2.5 py-0.5 text-xs font-medium">
                    {runStatusLabel(status(project))}
                  </span>
                  <span className="truncate text-base font-semibold">{project.title}</span>
                  <span className="text-warning mt-auto text-sm">{vi.home.openToReview}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-label={vi.home.allProjects} className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{vi.home.allProjects}</h2>
        {projects.isError ? (
          <p className="text-destructive text-sm">{vi.project.listError}</p>
        ) : list.length === 0 ? (
          <p className="text-muted-foreground text-sm">{vi.shell.projectsEmpty}</p>
        ) : (
          <ul className="divide-border overflow-hidden rounded-xl border">
            {list.map((project) => {
              const tone = runTone(status(project));
              return (
                <li
                  key={project.id}
                  className="hover:bg-surface-raised flex items-center gap-4 px-4 py-3"
                >
                  <button
                    type="button"
                    onClick={() => onSelect(project.id)}
                    className="min-w-0 flex-1 truncate text-left text-sm font-medium"
                  >
                    {project.title}
                  </button>
                  <span className={cn("flex items-center gap-2 text-xs", TONE_TEXT[tone])}>
                    <span
                      className={cn("size-2 rounded-full", TONE_DOT[tone])}
                      aria-hidden="true"
                    />
                    {runStatusLabel(status(project))}
                  </span>
                  <span className="text-muted-foreground hidden w-32 text-right text-xs md:block">
                    {new Date(project.latestRun?.updatedAt ?? project.updatedAt).toLocaleString(
                      "vi-VN",
                      {
                        dateStyle: "short",
                        timeStyle: "short",
                      },
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="bg-card flex flex-col gap-1 rounded-xl border p-4">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={cn("text-2xl font-semibold", tone)}>{value}</span>
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
        />
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
