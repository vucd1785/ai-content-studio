import { workflowRunControlResponseSchema } from "@studio/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsQueryKey } from "@/features/projects/use-projects";
import { workflowRunQueryKey } from "@/features/script-review/use-script-review";
import { apiRequest } from "@/lib/api";

/**
 * Hủy và resume lượt chạy (P3-08 API). Xong thì đọc lại run để thấy trạng thái đã lưu.
 * Không mutation nào ở đây ghi approval.
 */
function useRunCommand(runId: string, command: "cancel" | "resume") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest(`/api/workflow-runs/${encodeURIComponent(runId)}/${command}`, {
        method: "POST",
        schema: workflowRunControlResponseSchema,
      }),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: workflowRunQueryKey(runId) });
      // Trang project đọc trạng thái run mới nhất (nút bắt đầu run mới sau khi hủy).
      await queryClient.invalidateQueries({ queryKey: projectsQueryKey });
    },
  });
}

export const useCancelRun = (runId: string) => useRunCommand(runId, "cancel");
export const useResumeRun = (runId: string) => useRunCommand(runId, "resume");
