import type { AlignResponse, ScriptV2 } from "@studio/contracts";
import {
  agentRuns,
  artifacts,
  brandCharacters,
  brandProfiles,
  createProject,
  insertBrief,
  jobs,
  recordApproval,
  type StudioDb,
  workflowRuns,
} from "@studio/db";
import type { SceneMediaArtifacts } from "../cli/build-render-props.js";
import type { VoiceScene } from "../cli/media-stage.js";
import { writeJsonArtifact } from "../jobs/job-support.js";
import type { Mp4Info, RenderBackend } from "./render-backend.js";

/**
 * Dữ liệu dùng chung cho test tích hợp luồng sau duyệt script (P3-05, P3-06, P3-08). Kịch bản là script `2`
 * gói `story` (ADR-013 bổ sung (2)). Không gọi TTS, ffmpeg hay Remotion.
 */

/** Một từ giả dài chừng này: 6 câu của kịch bản mẫu cho khoảng 40 giây, trong khoảng 30–90 giây của QA. */
export const WORD_MS = 1100;

/** Một test dựng cả luồng mất vài giây trên DB thật; chạy cùng cả suite thì dễ vượt mặc định 5 giây. */
export const FLOW_TEST_OPTIONS = { timeout: 30_000 } as const;

const actor = (character: string, action: string, expression: string) => ({
  character,
  action,
  expression,
});

/**
 * Phương án script `2` gói `story` v1 hợp lệ với dàn nhân vật và kho tài sản `approved` của motion kit.
 * `dauSpeaks: false` cho kênh mặc định của DB test, nơi Đậu chưa có lời thoại.
 */
export function storyScript(title: string, opts: { dauSpeaks?: boolean } = {}): ScriptV2 {
  return {
    schemaVersion: 2,
    language: "vi",
    formatId: "story",
    formatVersion: 1,
    title,
    sources: [{ id: "src1", title: "Redis docs", url: "https://redis.io/docs/" }],
    scenes: [
      {
        id: "mo-dau",
        beat: "cold_open",
        sourceIds: [],
        lines: [
          { id: "l1", speaker: "ti", text: "Bit ơi, sao trang web chậm thế?" },
          { id: "l2", speaker: "bit", text: "Vì mỗi lần đều hỏi database." },
        ],
        shots: [
          {
            id: "s1",
            lineId: "l1",
            cutOnWord: "Bit",
            background: "bg_room",
            shotSize: "wide",
            camera: "cam_push_in",
            focus: "ti",
            actors: [
              actor("ti", "action_wave", "expr_happy"),
              actor("bit", "pose_stand", "expr_happy"),
            ],
          },
          {
            id: "s2",
            lineId: "l2",
            cutOnWord: "database",
            background: "bg_room",
            shotSize: "close",
            focus: "bit",
            actors: [actor("bit", "action_talk", "expr_doubt")],
          },
        ],
      },
      {
        id: "van-de",
        beat: "premise",
        sourceIds: [],
        lines: [{ id: "l3", speaker: "ti", text: "Vậy mình nhớ sẵn câu trả lời được không?" }],
        shots: [
          {
            id: "s3",
            lineId: "l3",
            cutOnWord: "nhớ",
            background: "bg_room",
            shotSize: "medium",
            focus: "ti",
            actors: [actor("ti", "action_point", "expr_smug")],
          },
        ],
      },
      {
        id: "dien-giai",
        beat: "play",
        sourceIds: [],
        lines: [
          { id: "l4", speaker: opts.dauSpeaks === false ? "ti" : "dau", text: "Nhớ hết luôn!" },
        ],
        shots: [
          {
            id: "s4",
            lineId: "l4",
            cutOnWord: "Nhớ",
            background: "bg_room",
            shotSize: "high",
            focus: "dau",
            actors: [
              actor("ti", "action_celebrate", "expr_happy"),
              actor("bit", "pose_stand", "expr_happy"),
              actor("dau", "action_celebrate", "expr_happy"),
            ],
          },
        ],
      },
      {
        id: "su-that",
        beat: "fact",
        sourceIds: ["src1"],
        lines: [
          { id: "l5", speaker: "bit", text: "Redis giữ dữ liệu trong RAM nên đọc rất nhanh." },
        ],
        shots: [
          {
            id: "s5",
            lineId: "l5",
            cutOnWord: "RAM",
            background: "bg_classroom",
            shotSize: "wide",
            focus: "bit",
            actors: [
              actor("bit", "action_point", "expr_doubt"),
              actor("ti", "pose_stand", "expr_surprised"),
            ],
          },
        ],
      },
      {
        id: "chot",
        beat: "payoff",
        sourceIds: [],
        lines: [{ id: "l6", speaker: "ti", text: "Thì ra trí nhớ của web là Redis." }],
        shots: [
          {
            id: "s6",
            lineId: "l6",
            cutOnWord: "Redis",
            background: "bg_classroom",
            shotSize: "close",
            focus: "ti",
            actors: [actor("ti", "action_walk", "expr_happy")],
          },
        ],
      },
    ],
  } as ScriptV2;
}

/** JSON hai phương án ở dạng `flat` mà LLM trả về (P6-01); adapter giải mã về `storyScript`. */
export function storyFlatJson(
  titles: [string, string] = ["Một", "Hai"],
  opts: { dauSpeaks?: boolean } = {},
) {
  const flat = (script: ScriptV2) => ({
    title: script.title,
    sources: script.sources,
    scenes: script.scenes.map((scene) => ({
      id: scene.id,
      beat: scene.beat,
      sourceIds: scene.sourceIds,
    })),
    lines: script.scenes.flatMap((scene) =>
      scene.lines.map((line) => ({ sceneId: scene.id, ...line })),
    ),
    shots: script.scenes.flatMap((scene) =>
      scene.shots.map(({ actors, ...shot }) => ({
        sceneId: scene.id,
        ...shot,
        actor1: actors[0],
        ...(actors[1] === undefined ? {} : { actor2: actors[1] }),
        ...(actors[2] === undefined ? {} : { actor3: actors[2] }),
      })),
    ),
  });
  return JSON.stringify({ variants: titles.map((title) => flat(storyScript(title, opts))) });
}

/** Kênh test riêng: Tí, Bit, Đậu đều có giọng; không đụng kênh mặc định. */
export async function seedVoicedBrand(db: StudioDb): Promise<string> {
  const [brand] = await db
    .insert(brandProfiles)
    .values({
      slug: `test-flow-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      displayName: "Kênh test luồng",
      palette: { accent: "#f26b3a", screen: "#8fe9ff", leaf: "#6cc04a" },
      fonts: { body: "system-ui" },
      toneRules: "",
      isDefault: false,
    })
    .returning();
  if (brand === undefined) {
    throw new Error("seed brand");
  }
  await db.insert(brandCharacters).values(
    [
      ["ti", "Tí", "protagonist", "Hải Đăng"],
      ["bit", "Bit", "explainer", "Trúc Ly"],
      ["dau", "Đậu", "companion", "Quỳnh Anh"],
    ].map(([characterKey, displayName, role, voiceId], index) => ({
      brandProfileId: brand.id,
      characterKey: characterKey as string,
      displayName: displayName as string,
      role: role as string,
      skinAssetId: `skin_${characterKey}`,
      personality: displayName as string,
      speaks: true,
      voiceId: voiceId as string,
      sortOrder: index + 1,
    })),
  );
  return brand.id;
}

function alignment(transcript: string, words: AlignResponse["words"], durationMs: number) {
  const end = words.at(-1)?.endMs ?? 0;
  return {
    alignmentArtifactId: "a".repeat(32),
    audioArtifactId: "b".repeat(32),
    durationMs,
    transcript,
    engine: "whisper",
    modelId: "fake",
    words,
    validation: {
      ok: true,
      errors: [],
      warnings: [],
      wordCount: words.length,
      alignedWordCount: words.length,
      missingWords: [],
      coverageStartMs: words[0]?.startMs ?? 0,
      coverageEndMs: end,
      durationDeltaMs: durationMs - end,
      nonMonotonicWordRatio: 0,
      timelineOrderRatio: 1,
    },
    gate: {
      alignedWordRatio: 1,
      durationDeltaMs: durationMs - end,
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
  } satisfies AlignResponse;
}

/**
 * Thay TTS + alignment theo câu (P6-08): mỗi từ dài `WORD_MS`, nghỉ 250 ms giữa hai câu. Ghi lại giọng của
 * từng câu để test kiểm người nói.
 */
export function fakeVoice() {
  const voices: string[] = [];
  const collectVoiceScenes = async (voiceScenes: VoiceScene[]): Promise<SceneMediaArtifacts[]> =>
    voiceScenes.map((scene, index) => {
      const words: AlignResponse["words"] = [];
      let t = 100;
      const lines = scene.lines.map((line, li) => {
        voices.push(line.voiceId);
        if (li > 0) {
          t += 250;
        }
        const startMs = t;
        for (const token of line.text.split(" ")) {
          words.push({ text: token, startMs: t, endMs: t + WORD_MS - 100 });
          t += WORD_MS;
        }
        return {
          lineId: line.lineId,
          speaker: line.speaker,
          voiceId: line.voiceId,
          text: line.text,
          wavArtifactId: "d".repeat(32),
          startMs,
          endMs: t,
        };
      });
      const durationMs = t + 100;
      return {
        sceneId: scene.sceneId,
        wavArtifactId: `${index}`.padStart(32, "c"),
        measuredDurationMs: durationMs,
        lines,
        alignmentMode: "scene" as const,
        alignment: alignment(scene.lines.map((l) => l.text).join(" "), words, durationMs),
      };
    });
  return { collectVoiceScenes, voices };
}

/** Bản không cần theo dõi giọng. */
export const collectVoiceScenes = fakeVoice().collectVoiceScenes;

/** Backend giả: không ffmpeg, không Remotion. Ghi lại mọi lần render để kiểm preview/export dùng props nào. */
export function fakeBackend(
  mp4: Mp4Info = { width: 1080, height: 1920, hasVideo: true, hasAudio: true, durationMs: 40000 },
) {
  const renders: {
    purpose: string;
    props: Parameters<RenderBackend["render"]>[1];
    audioSha: string;
  }[] = [];
  const backend: RenderBackend = {
    async buildAudio(manifest) {
      return {
        audioStorageKey: "pipeline/edu-test.wav",
        audioSrc: "pipeline/edu-test.wav",
        audioContentSha256: "f".repeat(64),
        totalDurationMs: manifest.scenes.reduce((sum, scene) => sum + scene.measuredDurationMs, 0),
      };
    },
    async render(purpose, props, audioSha) {
      renders.push({ purpose, props, audioSha });
      return {
        storageKey: `render/cache/${props.templateId}/${purpose}-${renders.length}.mp4`,
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

/**
 * Run ở `waiting_script_approval` với script `2` hai phương án (gói `story`, kênh có giọng), rồi Director duyệt
 * phương án 2 (tạo job visual + voice).
 */
export async function seedApprovedScript(db: StudioDb, dataDir: string, title: string) {
  const brandProfileId = await seedVoicedBrand(db);
  const project = await createProject(db, title, { brandProfileId });
  const brief = await insertBrief(db, project.id, {
    topic: "Redis",
    audience: "Dev",
    goal: "TTL",
    durationSec: 60,
    language: "vi",
    tone: "friendly",
    visualStyle: "hoạt hình",
  });
  const [run] = await db
    .insert(workflowRuns)
    .values({ projectId: project.id, briefId: brief.id, status: "waiting_script_approval" })
    .returning();
  const runId = run?.id ?? "";
  await db
    .insert(agentRuns)
    .values({ workflowRunId: runId, role: "script", status: "waiting_approval" });
  const key = `artifacts/${runId}/script-test.json`;
  const [script] = await db
    .insert(artifacts)
    .values({
      projectId: project.id,
      workflowRunId: runId,
      type: "script",
      version: 1,
      schemaVersion: "2",
      contentHash: await writeJsonArtifact(dataDir, key, {
        variants: [storyScript("Một"), storyScript("Hai")],
      }),
      storageKey: key,
      metadata: { formatId: "story", formatVersion: 1, creativeMode: "standard" },
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
  return { runId, projectId: project.id, scriptArtifactId: script?.id ?? "" };
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
