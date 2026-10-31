import { StudioScene } from "./studio-scene";
import { type StudioRunDeps, useStudioRun } from "./use-studio-run";

/** Canvas nối dữ liệu thật của một run (P4-02). `runId` null thì mọi vai trò `idle`. */
export function StudioLive({ runId, deps }: { runId: string | null; deps?: StudioRunDeps }) {
  const state = useStudioRun(runId, deps);
  return <StudioScene statuses={state.statuses} renderProgress={state.renderProgress} />;
}
