import { youtubeConnectionSchema, youtubeUploadListSchema } from "@studio/contracts";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

/** ADR-031: trạng thái kết nối kênh YouTube và các lần đăng của run. */

export const YOUTUBE_CONNECTION_KEY = ["youtube", "connection"] as const;
export const youtubeUploadsKey = (runId: string) => ["youtube", "uploads", runId] as const;

/** `waiting`: đang chờ Director đăng nhập Google ở tab khác thì đọc lại mỗi 3 giây. */
export function useYoutubeConnection(options: { waiting?: boolean } = {}) {
  return useQuery({
    queryKey: YOUTUBE_CONNECTION_KEY,
    queryFn: () => apiRequest("/api/youtube/connection", { schema: youtubeConnectionSchema }),
    refetchInterval: options.waiting === true ? 3000 : false,
  });
}

/** Đang có job đăng thì đọc lại mỗi 4 giây. */
export function useYoutubeUploads(runId: string) {
  return useQuery({
    queryKey: youtubeUploadsKey(runId),
    queryFn: () =>
      apiRequest(`/api/workflow-runs/${encodeURIComponent(runId)}/youtube-uploads`, {
        schema: youtubeUploadListSchema,
      }),
    refetchInterval: (query) => (query.state.data?.busy === true ? 4000 : false),
  });
}
