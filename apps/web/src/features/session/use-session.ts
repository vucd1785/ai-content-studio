import { type SessionStatusResponse, sessionStatusResponseSchema } from "@studio/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export const sessionQueryKey = ["session"] as const;

export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: () => apiRequest("/api/session", { schema: sessionStatusResponseSchema }),
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) =>
      apiRequest("/api/session/login", {
        method: "POST",
        body: { password },
        schema: sessionStatusResponseSchema,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData<SessionStatusResponse>(sessionQueryKey, data);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest("/api/session/logout", { method: "POST", schema: sessionStatusResponseSchema }),
    onSettled: () => {
      queryClient.setQueryData<SessionStatusResponse>(sessionQueryKey, { authenticated: false });
    },
  });
}
