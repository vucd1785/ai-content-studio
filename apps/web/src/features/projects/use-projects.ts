import {
  type BriefWriteBody,
  briefSchema,
  projectDetailResponseSchema,
  projectListResponseSchema,
  projectSchema,
  referenceResponseSchema,
} from "@studio/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isWorkingStatus } from "@/features/run/run-status";
import { apiRequest } from "@/lib/api";

export const projectsQueryKey = ["projects"] as const;
export const projectDetailQueryKey = (projectId: string) => ["projects", projectId] as const;

export function useProjects() {
  return useQuery({
    queryKey: projectsQueryKey,
    queryFn: () => apiRequest("/api/projects", { schema: projectListResponseSchema }),
  });
}

/** Id rỗng (chưa mở dự án, panel giám sát ở trang tổng quan) thì không gọi API. */
export function useProjectDetail(projectId: string) {
  return useQuery({
    queryKey: projectDetailQueryKey(projectId),
    queryFn: () =>
      apiRequest(`/api/projects/${encodeURIComponent(projectId)}`, {
        schema: projectDetailResponseSchema,
      }),
    enabled: projectId !== "",
    // Run đang chạy: đọc lại để tiêu đề, tab mặc định và trạng thái đổi ngay khi bước xong.
    refetchInterval: (query) =>
      isWorkingStatus(query.state.data?.workflowRun?.status) ? 5_000 : false,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string) =>
      apiRequest("/api/projects", { method: "POST", body: { title }, schema: projectSchema }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsQueryKey }),
  });
}

export function useSaveBrief(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (brief: BriefWriteBody) =>
      apiRequest(`/api/projects/${encodeURIComponent(projectId)}/brief`, {
        method: "PUT",
        body: brief,
        schema: briefSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectDetailQueryKey(projectId) }),
  });
}

/** Thêm URL tham khảo (P7-05): body JSON `{ url }`, server kiểm lại http/https và độ dài. */
export function useAddReferenceUrl(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (url: string) =>
      apiRequest(`/api/projects/${encodeURIComponent(projectId)}/references`, {
        method: "POST",
        body: { url },
        schema: referenceResponseSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectDetailQueryKey(projectId) }),
  });
}

export function useUploadReference(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiRequest(`/api/projects/${encodeURIComponent(projectId)}/references`, {
        method: "POST",
        formData,
        schema: referenceResponseSchema,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectDetailQueryKey(projectId) }),
  });
}
