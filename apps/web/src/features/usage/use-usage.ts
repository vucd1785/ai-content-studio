import { usageListResponseSchema } from "@studio/contracts";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export const usageQueryKey = (runId: string) => ["workflow-runs", runId, "usage"] as const;

export function useRunUsage(runId: string | null) {
  return useQuery({
    queryKey: usageQueryKey(runId ?? ""),
    enabled: runId !== null,
    queryFn: () =>
      apiRequest(`/api/workflow-runs/${encodeURIComponent(runId ?? "")}/usage`, {
        schema: usageListResponseSchema,
      }),
  });
}
