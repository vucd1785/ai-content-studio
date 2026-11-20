import { useCallback, useSyncExternalStore } from "react";

/**
 * Điều hướng bằng hash (P7-04, kế hoạch 14 mục 1.3 L7): giữ được màn khi tải lại trang, không cần package router.
 * `#/`, `#/projects/<id>`, `#/projects/<id>/<tab>`, `#/usage`, `#/library`, `#/videos`, `#/brand`, `#/publish-guide`.
 */
export const PROJECT_TABS = ["brief", "running", "script", "preview", "final"] as const;
export type ProjectTab = (typeof PROJECT_TABS)[number];

export type Route =
  | { page: "home" }
  | { page: "project"; projectId: string; tab: ProjectTab | null }
  | { page: "usage" }
  | { page: "library" }
  | { page: "videos" }
  | { page: "brand" }
  | { page: "publish-guide" };

const UUIDISH = /^[0-9a-f-]{8,64}$/i;

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [head, id, tab] = parts;
  if (head === "projects" && id !== undefined && UUIDISH.test(id)) {
    return {
      page: "project",
      projectId: id,
      tab: (PROJECT_TABS as readonly string[]).includes(tab ?? "") ? (tab as ProjectTab) : null,
    };
  }
  if (
    head === "usage" ||
    head === "library" ||
    head === "videos" ||
    head === "brand" ||
    head === "publish-guide"
  ) {
    return { page: head };
  }
  return { page: "home" };
}

export function formatRoute(route: Route): string {
  switch (route.page) {
    case "project":
      return `#/projects/${route.projectId}${route.tab === null ? "" : `/${route.tab}`}`;
    case "home":
      return "#/";
    default:
      return `#/${route.page}`;
  }
}

const subscribe = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};

export function useHashRoute(): [Route, (route: Route) => void] {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => "",
  );
  const navigate = useCallback((route: Route) => {
    const next = formatRoute(route);
    if (window.location.hash !== next) {
      window.location.hash = next;
    }
  }, []);
  return [parseRoute(hash), navigate];
}
