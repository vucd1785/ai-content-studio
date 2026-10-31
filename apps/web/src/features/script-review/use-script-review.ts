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

export function useWorkflowRun(runId: string | null) {
  return useQuery({
    queryKey: workflowRunQueryKey(runId ?? ""),
    enabled: runId !== null,
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
