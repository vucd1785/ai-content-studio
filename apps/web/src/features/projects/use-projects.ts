import {
  type BriefWriteBody,
  briefSchema,
  projectDetailResponseSchema,
  projectListResponseSchema,
  projectSchema,
  referenceResponseSchema,
} from "@studio/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export const projectsQueryKey = ["projects"] as const;
export const projectDetailQueryKey = (projectId: string) => ["projects", projectId] as const;

export function useProjects() {
  return useQuery({
    queryKey: projectsQueryKey,
    queryFn: () => apiRequest("/api/projects", { schema: projectListResponseSchema }),
  });
}

export function useProjectDetail(projectId: string) {
  return useQuery({
    queryKey: projectDetailQueryKey(projectId),
    queryFn: () =>
      apiRequest(`/api/projects/${encodeURIComponent(projectId)}`, {
        schema: projectDetailResponseSchema,
      }),
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
