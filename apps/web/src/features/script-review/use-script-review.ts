import {
  type ApprovalBody,
  approvalCreatedResponseSchema,
  artifactDetailResponseSchema,
  workflowRunDetailResponseSchema,
} from "@studio/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export const workflowRunQueryKey = (runId: string) => ["workflow-runs", runId] as const;
export const artifactQueryKey = (artifactId: string) => ["artifacts", artifactId] as const;

/** Trạng thái máy đang làm: đọc lại run mỗi 5 s để thanh tiến trình theo kịp (P2-11). */
const WORKING_STATUSES = new Set([
  "idea_submitted",
  "researching",
  "research_ready",
  "scripting",
  "producing_assets",
  "preview_rendering",
  "qa",
  "exporting",
]);

export function useWorkflowRun(runId: string | null) {
  return useQuery({
    queryKey: workflowRunQueryKey(runId ?? ""),
    enabled: runId !== null,
    refetchInterval: (query) =>
      WORKING_STATUSES.has(query.state.data?.workflowRun.status ?? "") ? 5_000 : false,
    queryFn: () =>
      apiRequest(`/api/workflow-runs/${encodeURIComponent(runId ?? "")}`, {
        schema: workflowRunDetailResponseSchema,
      }),
  });
}

export function useArtifact(artifactId: string | null) {
  return useQuery({
    queryKey: artifactQueryKey(artifactId ?? ""),
    enabled: artifactId !== null,
    queryFn: () =>
      apiRequest(`/api/artifacts/${encodeURIComponent(artifactId ?? "")}`, {
        schema: artifactDetailResponseSchema,
      }),
  });
}

/** Gửi đúng một decision tường minh (ADR-004). Xong thì đọc lại run để thấy decision đã lưu. */
export function useRecordApproval(runId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ApprovalBody) =>
      apiRequest(`/api/workflow-runs/${encodeURIComponent(runId)}/approvals`, {
        method: "POST",
        body,
        schema: approvalCreatedResponseSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workflowRunQueryKey(runId) }),
  });
}
