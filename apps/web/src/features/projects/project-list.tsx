import { projectCreateBodySchema } from "@studio/contracts";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { vi } from "@/i18n/vi";
import { cn } from "@/lib/utils";
import { useCreateProject, useProjects } from "./use-projects";

export function ProjectList({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (projectId: string) => void;
}) {
  const projects = useProjects();
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
        onSelect(project.id);
      },
    });
  };

  const errorText = localError ?? (create.isError ? vi.project.createError : null);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <h2 className="text-sm font-semibold">{vi.shell.projectsTitle}</h2>
      <form className="flex flex-col gap-2" onSubmit={onSubmit} noValidate>
        <Label htmlFor="new-project-title">{vi.project.titleLabel}</Label>
        <Input
          id="new-project-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={errorText !== null}
        />
        {errorText !== null ? (
          <p role="alert" className="text-destructive text-xs">
            {errorText}
          </p>
        ) : null}
        <Button type="submit" size="sm" variant="secondary" disabled={create.isPending}>
          {create.isPending ? vi.project.creating : vi.project.create}
        </Button>
      </form>
      {projects.isError ? (
        <p className="text-destructive text-sm">{vi.project.listError}</p>
      ) : projects.data !== undefined && projects.data.projects.length === 0 ? (
        <p className="text-muted-foreground text-sm">{vi.shell.projectsEmpty}</p>
      ) : (
        <ul className="flex min-h-0 flex-col gap-1 overflow-y-auto">
          {projects.data?.projects.map((project) => (
            <li key={project.id}>
              <button
                type="button"
                onClick={() => onSelect(project.id)}
                aria-current={project.id === selectedId ? "true" : undefined}
                className={cn(
                  "hover:bg-secondary w-full rounded-md px-2 py-1 text-left text-sm",
                  project.id === selectedId && "bg-secondary",
                )}
              >
                {project.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
