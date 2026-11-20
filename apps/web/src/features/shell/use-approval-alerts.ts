import { projectListResponseSchema } from "@studio/contracts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/toast";
import { projectsQueryKey } from "@/features/projects/use-projects";
import { runStatusLabel, runTone } from "@/features/run/run-status";
import { vi } from "@/i18n/vi";
import { apiRequest } from "@/lib/api";

/** Chu kỳ đọc lại danh sách dự án để biết khi nào có việc chờ Director (ms). */
export const APPROVAL_POLL_MS = 15_000;

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Báo khi có việc cần Director (ADR-020): tiêu đề tab có số việc chờ, và khi một dự án mới chuyển sang chờ duyệt
 * thì hiện toast trong app và thông báo của trình duyệt (nếu Director đã cho phép). Chỉ đọc, không đổi workflow.
 */
export function useApprovalAlerts(): number {
  const projects = useQuery({
    queryKey: projectsQueryKey,
    queryFn: () => apiRequest("/api/projects", { schema: projectListResponseSchema }),
    refetchInterval: APPROVAL_POLL_MS,
  });
  const waiting = (projects.data?.projects ?? []).filter(
    (p) => runTone(p.latestRun?.status ?? null) === "waiting",
  );
  const known = useRef<Set<string> | null>(null);
  const key = waiting.map((p) => `${p.id}:${p.latestRun?.status ?? ""}`).join("|");

  useEffect(() => {
    const base = vi.app.name;
    document.title = waiting.length > 0 ? `(${waiting.length}) ${base}` : base;
  }, [waiting.length]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` gói đủ danh sách việc chờ.
  useEffect(() => {
    if (projects.data === undefined) {
      return;
    }
    const current = new Set(key === "" ? [] : key.split("|"));
    const previous = known.current;
    known.current = current;
    if (previous === null) {
      return;
    }
    for (const project of waiting) {
      const id = `${project.id}:${project.latestRun?.status ?? ""}`;
      if (previous.has(id)) {
        continue;
      }
      const body = `${project.title}: ${runStatusLabel(project.latestRun?.status ?? null)}`;
      toast(`${vi.shell.alertTitle} · ${body}`);
      if (notificationsSupported() && Notification.permission === "granted") {
        try {
          new Notification(vi.shell.alertTitle, { body, tag: id });
        } catch {
          // Một số trình duyệt chỉ cho thông báo qua service worker: đã có toast.
        }
      }
    }
  }, [key, projects.data]);

  return waiting.length;
}
