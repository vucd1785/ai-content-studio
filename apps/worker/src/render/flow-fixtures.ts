import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type AlignResponse, parseScript, type Script } from "@studio/contracts";
import {
  agentRuns,
  artifacts,
  createProject,
  insertBrief,
  jobs,
  recordApproval,
  type StudioDb,
  workflowRuns,
} from "@studio/db";
import type { EduVerticalRenderProps } from "@studio/video/render-props/schema";
import type { SceneMediaArtifacts } from "../cli/build-render-props.js";
import { resolveRepoRoot } from "../cli/paths.js";
import { writeJsonArtifact } from "../jobs/job-support.js";
import type { Mp4Info, RenderBackend } from "./render-backend.js";

/** Dữ liệu dùng chung cho test tích hợp luồng sau duyệt script (P3-06, P3-08). Không gọi TTS, ffmpeg hay Remotion. */

export const SCENE_MS = 7000;

/** Một test dựng cả luồng mất vài giây trên DB thật; chạy cùng cả suite thì dễ vượt mặc định 5 giây. */
export const FLOW_TEST_OPTIONS = { timeout: 30_000 } as const;

export function loadScript(title: string): Script {
  const raw = JSON.parse(
    readFileSync(join(resolveRepoRoot(import.meta.url), "fixtures", "script.edu.json"), "utf8"),
  ) as Record<string, unknown>;
  return parseScript({ ...raw, title, sources: [{ id: "s", title: "Redis docs" }] });
}

function alignment(sceneId: string): AlignResponse {
  return {
    alignmentArtifactId: "a".repeat(32),
    audioArtifactId: "b".repeat(32),
    durationMs: SCENE_MS,
    transcript: sceneId,
    engine: "whisper",
    modelId: "fake",
    words: [
      { text: "Redis", startMs: 100, endMs: 900 },
      { text: "nhanh", startMs: 1000, endMs: 1800 },
    ],
    validation: {
      ok: true,
      errors: [],
      warnings: [],
      wordCount: 2,
      alignedWordCount: 2,
      missingWords: [],
      coverageStartMs: 100,
      coverageEndMs: 1800,
      durationDeltaMs: 200,
      nonMonotonicWordRatio: 0,
      timelineOrderRatio: 1,
    },
    gate: {
      alignedWordRatio: 1,
      durationDeltaMs: 200,
      coverageWithin250Ms: true,
      ratioAtLeast90Pct: true,
      validationOk: true,
      passesGate: true,
      gatePolicyVersion: "test",
      trailingSilenceVerified: false,
      trailingSilenceMs: null,
      coverageAcceptanceReason: "within_250ms",
    },
    processingMs: 1,
  };
}

/** Thay TTS + alignment: mỗi cảnh một WAV giả dài `SCENE_MS`. */
export const collectMedia = async (script: Script): Promise<SceneMediaArtifacts[]> =>
  script.scenes.map((scene, index) => ({
    sceneId: scene.id,
    wavArtifactId: `${index}`.padStart(32, "c"),
    measuredDurationMs: SCENE_MS,
    alignment: alignment(scene.id),
  }));

/** Backend giả: không ffmpeg, không Remotion. Ghi lại mọi lần render để kiểm preview/export dùng props nào. */
export function fakeBackend(
  mp4: Mp4Info = { width: 1080, height: 1920, hasVideo: true, hasAudio: true, durationMs: 37000 },
) {
  const renders: { purpose: string; props: EduVerticalRenderProps; audioSha: string }[] = [];
  const backend: RenderBackend = {
    async buildAudio(manifest) {
      return {
        audioStorageKey: "pipeline/edu-test.wav",
        audioSrc: "pipeline/edu-test.wav",
        audioContentSha256: "f".repeat(64),
        totalDurationMs: manifest.scenes.reduce((sum, scene) => sum + scene.measuredDurationMs + 400, 0),
      };
    },
    async render(purpose, props, audioSha) {
      renders.push({ purpose, props, audioSha });
      return {
        storageKey: `render/cache/EduVertical/${purpose}-${renders.length}.mp4`,
        contentHash: `h${renders.length}`,
        cacheHit: false,
      };
    },
    async probe() {
      return mp4;
    },
  };
  return { backend, renders };
}

/** Run ở `waiting_script_approval` với script hai phương án, rồi Director duyệt phương án 2 (tạo job visual + voice). */
export async function seedApprovedScript(db: StudioDb, dataDir: string, title: string) {
  const project = await createProject(db, title);
  const brief = await insertBrief(db, project.id, {
    topic: "Redis",
    audience: "Dev",
    goal: "TTL",
    durationSec: 60,
    language: "vi",
    tone: "friendly",
    visualStyle: "edu",
  });
  const [run] = await db
    .insert(workflowRuns)
    .values({ projectId: project.id, briefId: brief.id, status: "waiting_script_approval" })
    .returning();
  const runId = run?.id ?? "";
  await db.insert(agentRuns).values({ workflowRunId: runId, role: "script", status: "waiting_approval" });
  const key = `artifacts/${runId}/script-test.json`;
  const [script] = await db
    .insert(artifacts)
    .values({
      projectId: project.id,
      workflowRunId: runId,
      type: "script",
      version: 1,
      schemaVersion: "1",
      contentHash: await writeJsonArtifact(dataDir, key, { variants: [loadScript("Một"), loadScript("Hai")] }),
      storageKey: key,
    })
    .returning();
  await recordApproval(db, {
    workflowRunId: runId,
    gate: "script",
    decision: "approved",
    artifactId: script?.id ?? "",
    variantIndex: 2,
    note: null,
  });
  return { runId, projectId: project.id };
}

/** Job của run kèm role agent. */
export async function runJobs(db: StudioDb, runId: string) {
  const agents = (await db.select().from(agentRuns)).filter((row) => row.workflowRunId === runId);
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  return (await db.select().from(jobs))
    .filter((job) => byId.has(job.agentRunId))
    .map((job) => ({ ...job, role: byId.get(job.agentRunId)?.role }));
}

export const jobByKeyPrefix = async (db: StudioDb, runId: string, prefix: string) =>
  (await runJobs(db, runId)).find((job) => job.idempotencyKey.startsWith(prefix));

export const runArtifacts = async (db: StudioDb, runId: string) =>
  (await db.select().from(artifacts)).filter((row) => row.workflowRunId === runId);
