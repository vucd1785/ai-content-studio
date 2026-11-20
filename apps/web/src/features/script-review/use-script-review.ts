import {
  type ApprovalBody,
  approvalCreatedResponseSchema,
  artifactDetailResponseSchema,
  type ScriptLineEditsBody,
  scriptLineEditsResponseSchema,
  workflowRunDetailResponseSchema,
} from "@studio/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import { isWorkingStatus } from "@/features/run/run-status";
import { vi } from "@/i18n/vi";
import { apiRequest } from "@/lib/api";

export const workflowRunQueryKey = (runId: string) => ["workflow-runs", runId] as const;
export const artifactQueryKey = (artifactId: string) => ["artifacts", artifactId] as const;

/**
 * Máy đang làm (P2-11): đọc lại run mỗi 5 s để thanh tiến trình theo kịp. Dùng chung danh sách với `runTone`,
 * nên bước mới (ví dụ `storyboarding`) không bị quên ở một chỗ.
 */
const POLL_MS = 5_000;

export function useWorkflowRun(runId: string | null) {
  return useQuery({
    queryKey: workflowRunQueryKey(runId ?? ""),
    enabled: runId !== null,
    refetchInterval: (query) =>
      isWorkingStatus(query.state.data?.workflowRun.status) ? POLL_MS : false,
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
    onSuccess: (result) => {
      toast(vi.toast.decision[result.approval.decision]);
      return queryClient.invalidateQueries({ queryKey: workflowRunQueryKey(runId) });
    },
  });
}

/** Sửa chữ trong câu tại Cổng 1 (ADR-020): server ghi phiên bản script mới, không gọi LLM, không duyệt. */
export function useScriptLineEdits(runId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ScriptLineEditsBody) =>
      apiRequest(`/api/workflow-runs/${encodeURIComponent(runId)}/script-edits`, {
        method: "POST",
        body,
        schema: scriptLineEditsResponseSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workflowRunQueryKey(runId) }),
  });
}
