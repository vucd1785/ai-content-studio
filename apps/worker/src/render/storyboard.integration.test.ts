import { existsSync, mkdirSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { AlignResponse } from "@studio/contracts";
import {
  agentRuns,
  approvals,
  artifacts,
  brandCharacters,
  brandProfiles,
  cancelWorkflowRun,
  createDbConnection,
  createProject,
  deleteProjectCascadeForTests,
  insertBrief,
  jobs,
  recordApproval,
  workflowRuns,
} from "@studio/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runVisualJob } from "../assets/visual-job.js";
import { runVoiceJob } from "../assets/voice-job.js";
import type { SceneMediaArtifacts } from "../cli/build-render-props.js";
import type { VoiceScene } from "../cli/media-stage.js";
import { writeJsonArtifact } from "../jobs/job-support.js";
import { createGeminiAdapter } from "../llm/gemini-adapter.js";
import type { CatalogEntry } from "../llm/script-v2-prompt.js";
import type {
  StructuredGenerateClient,
  StructuredGenerateRequest,
} from "../llm/structured-output.js";
import { failStuckJob } from "../queue/consumer.js";
import { runScriptJob } from "../script/script-job.js";
import { fakeBackend } from "./flow-fixtures.js";
import { runQaJob } from "./qa-job.js";
import { runRenderJob } from "./render-job.js";
import type { StoryboardRenderer } from "./storyboard-backend.js";
import { storyboardV2ArtifactSchema } from "./storyboard-checks.js";
import { runStoryboardJob } from "./storyboard-job.js";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";
type Db = ReturnType<typeof createDbConnection>["db"];

let db: Db;
let closeDb: () => Promise<void>;
let dataDir = "";
const projectIds: string[] = [];

/** Kho tài sản cố định (id của motion kit P6-05) để test không phụ thuộc trạng thái manifest. */
const CATALOG: CatalogEntry[] = [
  ...["expr_happy", "expr_surprised", "expr_panic", "expr_doubt", "expr_smug", "expr_sad"].map(
    (id) => ({ id, kind: "expression" as const, description: id, tags: [] }),
  ),
  ...["pose_stand", "pose_point"].map((id) => ({
    id,
    kind: "pose" as const,
    description: id,
    tags: [],
  })),
  ...["action_wave", "action_talk", "action_point", "action_celebrate", "action_walk"].map(
    (id) => ({
      id,
      kind: "action" as const,
      description: id,
      tags: [],
    }),
  ),
  { id: "bg_room", kind: "background", description: "phòng", tags: [] },
  { id: "bg_classroom", kind: "background", description: "lớp học", tags: [] },
  { id: "cam_static", kind: "camera", description: "tĩnh", tags: [] },
  { id: "cam_push_in", kind: "camera", description: "đẩy vào", tags: [] },
];

const a = (character: string, action: string, expression: string) => ({
  character,
  action,
  expression,
});

/** Một phương án `what_if` hợp lệ ở dạng `flat` mà LLM trả về (P6-01). */
function flatVariant(title: string, dauSpeaks = false) {
  return {
    title,
    sources: [{ id: "src1", title: "Nghiên cứu thiếu ngủ", url: "https://example.org/sleep" }],
    scenes: [
      { id: "mo-dau", beat: "cold_open", sourceIds: [] },
      { id: "gia-thuyet", beat: "premise", sourceIds: [] },
      { id: "vui", beat: "fun", sourceIds: [] },
      { id: "su-that", beat: "fact", sourceIds: ["src1"] },
      { id: "twist", beat: "twist", sourceIds: [] },
    ],
    lines: [
      { sceneId: "mo-dau", id: "l1", speaker: "ti", text: "Bit ơi, nếu mình không cần ngủ?" },
      {
        sceneId: "mo-dau",
        id: "l2",
        speaker: dauSpeaks ? "dau" : "bit",
        text: "Nghe hấp dẫn đấy.",
      },
      { sceneId: "gia-thuyet", id: "l3", speaker: "ti", text: "Thêm tám tiếng để chơi!" },
      { sceneId: "vui", id: "l4", speaker: "ti", text: "Đêm nào cũng là tiệc!" },
      {
        sceneId: "su-that",
        id: "l5",
        speaker: "bit",
        text: "Thức 24 giờ, phản xạ chậm như người say.",
      },
      { sceneId: "twist", id: "l6", speaker: "ti", text: "Thôi, mình đi ngủ đây." },
    ],
    shots: [
      {
        sceneId: "mo-dau",
        id: "s1",
        lineId: "l1",
        cutOnWord: "Bit",
        background: "bg_room",
        shotSize: "wide",
        camera: "cam_push_in",
        focus: "ti",
        actor1: a("ti", "action_wave", "expr_happy"),
        actor2: a("bit", "pose_stand", "expr_happy"),
        ambience: [],
      },
      {
        sceneId: "mo-dau",
        id: "s2",
        lineId: "l2",
        cutOnWord: "hấp",
        background: "bg_room",
        shotSize: "close",
        focus: "bit",
        actor1: a("bit", "action_talk", "expr_doubt"),
        ambience: [],
      },
      {
        sceneId: "gia-thuyet",
        id: "s3",
        lineId: "l3",
        cutOnWord: "tám",
        background: "bg_room",
        shotSize: "medium",
        focus: "ti",
        actor1: a("ti", "action_point", "expr_smug"),
        ambience: [],
      },
      {
        sceneId: "vui",
        id: "s4",
        lineId: "l4",
        cutOnWord: "tiệc",
        background: "bg_room",
        shotSize: "high",
        focus: "ti",
        actor1: a("ti", "action_celebrate", "expr_happy"),
        actor2: a("dau", "action_celebrate", "expr_happy"),
        ambience: ["dust"],
      },
      {
        sceneId: "su-that",
        id: "s5",
        lineId: "l5",
        cutOnWord: "24",
        background: "bg_classroom",
        shotSize: "wide",
        focus: "bit",
        actor1: a("bit", "action_point", "expr_doubt"),
        actor2: a("ti", "pose_stand", "expr_surprised"),
        ambience: [],
      },
      {
        sceneId: "twist",
        id: "s6",
        lineId: "l6",
        cutOnWord: "ngủ",
        background: "bg_classroom",
        shotSize: "close",
        focus: "ti",
        actor1: a("ti", "action_walk", "expr_sad"),
        ambience: [],
      },
    ],
  };
}

const flatJson = (opts: { dauSpeaks?: boolean } = {}) =>
  JSON.stringify({
    variants: [flatVariant("Phương án A", opts.dauSpeaks), flatVariant("Phương án B")],
  });

function fakeClient(outcomes: string[]) {
  const requests: StructuredGenerateRequest[] = [];
  const client: StructuredGenerateClient = {
    async generateStructured(request) {
      requests.push(request);
      const next = outcomes.shift();
      if (next === undefined) {
        throw new Error("fake LLM hết kịch bản");
      }
      return {
        jsonText: next,
        usage: {
          provider: "gemini",
          model: request.model,
          inputTokens: 30,
          outputTokens: 9,
          thinkingTokens: 0,
        },
      };
    },
  };
  return { client, requests };
}

const geminiConfig = {
  apiKey: "test-key-not-real",
  modelScript: "fake-model",
  thinkingLevelScript: "low" as const,
};

const scriptDeps = (client: StructuredGenerateClient) => ({
  client,
  dataDir,
  createLlm: (metered: StructuredGenerateClient) =>
    createGeminiAdapter({ config: geminiConfig, client: metered }),
  loadAssetCatalog: () => CATALOG,
});

/** Renderer giả: ghi một file PNG giả đúng đường dẫn; `failScene` ném lỗi cho một cảnh. */
function fakeRenderer(failScene?: string) {
  const calls: string[] = [];
  const renderer: StoryboardRenderer = {
    async renderStill(props, frame, outputPath) {
      calls.push(`${props.shots[0]?.background}@${frame}`);
      if (failScene !== undefined && outputPath.includes(failScene)) {
        throw new Error("Chrome không chạy");
      }
      mkdirSync(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, "png");
    },
  };
  return { renderer, calls };
}

/** Run `what_if` đứng ở `research_ready`, có research và job script `queued`. */
async function seedWhatIfRun(formatId = "what_if", brandProfileId?: string) {
  const project = await createProject(
    db,
    "P6-10 test",
    brandProfileId === undefined ? {} : { brandProfileId },
  );
  projectIds.push(project.id);
  const brief = await insertBrief(db, project.id, {
    topic: "Nếu như con người không cần ngủ?",
    audience: "Học sinh",
    goal: "Vui và biết một sự thật",
    durationSec: 45,
    language: "vi",
    tone: "hài",
    visualStyle: "hoạt hình",
    formatId,
    formatVersion: 1,
  });
  const [run] = await db
    .insert(workflowRuns)
    .values({ projectId: project.id, briefId: brief.id, status: "research_ready" })
    .returning();
  if (run === undefined) {
    throw new Error("seed run");
  }
  const key = `artifacts/${run.id}/research-seed.json`;
  const contentHash = await writeJsonArtifact(dataDir, key, {
    schemaVersion: 1,
    summary: "Thiếu ngủ làm phản xạ chậm.",
    facts: [
      {
        statement: "Thức 24 giờ làm phản xạ chậm như say rượu.",
        claimStatus: "user_provided",
        sourceIds: ["src1"],
      },
    ],
    sources: [
      {
        id: "src1",
        title: "Nghiên cứu thiếu ngủ",
        origin: "user_reference",
        url: "https://example.org/sleep",
      },
    ],
  });
  await db.insert(artifacts).values({
    projectId: project.id,
    workflowRunId: run.id,
    type: "research",
    version: 1,
    schemaVersion: "1",
    contentHash,
    storageKey: key,
    metadata: {},
  });
  const [agent] = await db
    .insert(agentRuns)
    .values({ workflowRunId: run.id, role: "script", status: "queued" })
    .returning();
  const [job] = await db
    .insert(jobs)
    .values({
      agentRunId: agent?.id ?? "",
      queue: "llm",
      idempotencyKey: `test-p6-10-${run.id}`,
      status: "queued",
    })
    .returning();
  if (job === undefined) {
    throw new Error("seed job");
  }
  return { runId: run.id, scriptJobId: job.id };
}

async function runStatus(runId: string) {
  return (await db.select().from(workflowRuns)).find((row) => row.id === runId);
}

async function storyboardJob(runId: string) {
  const agent = (await db.select().from(agentRuns)).find(
    (row) => row.workflowRunId === runId && row.role === "visual",
  );
  const job = (await db.select().from(jobs)).find((row) => row.agentRunId === agent?.id);
  return agent === undefined || job === undefined ? undefined : { agent, job };
}

async function runArtifacts(runId: string, type: string) {
  return (await db.select().from(artifacts)).filter(
    (row) => row.workflowRunId === runId && row.type === type,
  );
}

async function runApprovals(runId: string) {
  return (await db.select().from(approvals)).filter((row) => row.workflowRunId === runId);
}

beforeAll(async () => {
  ({ db, close: closeDb } = createDbConnection(DATABASE_URL));
  dataDir = await mkdtemp(join(tmpdir(), "p6-10-"));
});

afterAll(async () => {
  for (const id of projectIds) {
    await deleteProjectCascadeForTests(db, id);
  }
  await closeDb();
  await rm(dataDir, { recursive: true, force: true });
});

describe("script v2 có shot list (P6-10)", () => {
  it("một lần gọi; ghi script schema 2; run sang storyboarding và tạo job storyboard; không approval", async () => {
    const { runId, scriptJobId } = await seedWhatIfRun();
    const { client, requests } = fakeClient([flatJson()]);
    const result = await runScriptJob(db, scriptJobId, scriptDeps(client));
    expect(result.status).toBe("completed");
    expect(requests).toHaveLength(1);

    const prompt = requests[0]?.userPrompt ?? "";
    expect(prompt).toContain("what_if");
    expect(prompt).toContain("bg_classroom");
    expect(prompt).toContain('"Tí"');
    expect(prompt).toContain("never speaks");
    expect(prompt).not.toMatch(/onScreenText|board/);
    const schemaText = JSON.stringify(requests[0]?.responseJsonSchema);
    expect(schemaText).toContain('"actor1"');
    expect(schemaText).not.toContain("onScreenText");

    const run = await runStatus(runId);
    expect(run?.status).toBe("storyboarding");
    const [script] = await runArtifacts(runId, "script");
    expect(script?.schemaVersion).toBe("2");
    expect(script?.metadata).toMatchObject({
      formatId: "what_if",
      creativeMode: "standard",
      repairCount: 0,
    });
    const next = await storyboardJob(runId);
    expect(next?.job.queue).toBe("render");
    expect(next?.job.idempotencyKey).toBe(`storyboard:${runId}:script:${scriptJobId}`);
    expect(next?.job.status).toBe("queued");
    expect(await runApprovals(runId)).toEqual([]);
  });

  it("Zod sai (Đậu nói): repair đúng một lần rồi qua", async () => {
    const { runId, scriptJobId } = await seedWhatIfRun();
    const { client, requests } = fakeClient([flatJson({ dauSpeaks: true }), flatJson()]);
    const result = await runScriptJob(db, scriptJobId, scriptDeps(client));
    expect(result.status).toBe("completed");
    expect(requests).toHaveLength(2);
    expect(requests[1]?.userPrompt).toContain("Nhân vật dau không nói");
    expect((await runStatus(runId))?.status).toBe("storyboarding");
  });

  it("sai cả sau repair: failed schema_invalid, resume scripting, không gọi lần thứ ba", async () => {
    const { runId, scriptJobId } = await seedWhatIfRun();
    const bad = flatJson({ dauSpeaks: true });
    const { client, requests } = fakeClient([bad, bad, bad]);
    const result = await runScriptJob(db, scriptJobId, scriptDeps(client));
    expect(result).toEqual({ status: "failed", errorCode: "schema_invalid" });
    expect(requests).toHaveLength(2);
    const run = await runStatus(runId);
    expect(run?.status).toBe("failed");
    expect(run?.resumeFrom).toBe("scripting");
  });
});

describe("job storyboard (P6-10)", () => {
  async function toStoryboarding() {
    const seeded = await seedWhatIfRun();
    const { client } = fakeClient([flatJson()]);
    await runScriptJob(db, seeded.scriptJobId, scriptDeps(client));
    const job = await storyboardJob(seeded.runId);
    if (job === undefined) {
      throw new Error("no storyboard job");
    }
    return { ...seeded, storyboardJobId: job.job.id };
  }

  it("ảnh tĩnh mỗi cảnh của hai phương án, kiểm tự động, rồi waiting_script_approval; không approval", async () => {
    const { runId, storyboardJobId } = await toStoryboarding();
    const { renderer, calls } = fakeRenderer();
    const result = await runStoryboardJob(db, storyboardJobId, {
      dataDir,
      renderer,
      loadAssetCatalog: () => CATALOG,
    });
    expect(result.status).toBe("completed");
    expect(calls).toHaveLength(10);
    expect(calls[0]).toBe("bg_room@24");
    expect((await runStatus(runId))?.status).toBe("waiting_script_approval");
    const [row] = await runArtifacts(runId, "storyboard");
    expect(row?.schemaVersion).toBe("2");
    const { readFile } = await import("node:fs/promises");
    const board = storyboardV2ArtifactSchema.parse(
      JSON.parse(await readFile(join(dataDir, row?.storageKey ?? ""), "utf8")),
    );
    expect(board.errors).toEqual([]);
    expect(board.variants.map((v) => [v.variantIndex, v.scenes.length])).toEqual([
      [1, 5],
      [2, 5],
    ]);
    for (const scene of board.variants.flatMap((v) => v.scenes)) {
      expect(scene.stillKey).not.toBeNull();
      expect(existsSync(join(dataDir, scene.stillKey ?? ""))).toBe(true);
    }
    expect(await runApprovals(runId)).toEqual([]);
  });

  it("render một ảnh hỏng: lỗi vào errors[], không chặn cổng", async () => {
    const { runId, storyboardJobId } = await toStoryboarding();
    const { renderer } = fakeRenderer("v1-vui");
    const result = await runStoryboardJob(db, storyboardJobId, {
      dataDir,
      renderer,
      loadAssetCatalog: () => CATALOG,
    });
    expect(result).toMatchObject({ status: "completed", errorCount: 1 });
    expect((await runStatus(runId))?.status).toBe("waiting_script_approval");
  });

  it("worker chết, BullMQ hết lượt: vẫn mở cổng script với artifact chỉ có lỗi, không sang failed", async () => {
    const { runId, storyboardJobId } = await toStoryboarding();
    const handled = await failStuckJob(db, storyboardJobId, new Error("process killed"), dataDir);
    expect(handled).toBe(true);
    const run = await runStatus(runId);
    expect(run?.status).toBe("waiting_script_approval");
    expect(run?.resumeFrom).toBeNull();
  });

  it("run đã hủy: job storyboard bỏ qua, run giữ cancelled", async () => {
    const { runId, storyboardJobId } = await toStoryboarding();
    await cancelWorkflowRun(db, {
      workflowRunId: runId,
      transition: { from: "storyboarding", to: "cancelled" },
    });
    const { renderer, calls } = fakeRenderer();
    const result = await runStoryboardJob(db, storyboardJobId, {
      dataDir,
      renderer,
      loadAssetCatalog: () => CATALOG,
    });
    expect(result.status).toBe("skipped");
    expect(calls).toEqual([]);
    expect((await runStatus(runId))?.status).toBe("cancelled");
  });

  it("brief dùng gói đã xóa (explainer): failed configuration_missing, không gọi LLM (ADR-013 bổ sung (2))", async () => {
    const { runId, scriptJobId } = await seedWhatIfRun("explainer");
    const { client, requests } = fakeClient([]);
    expect(await runScriptJob(db, scriptJobId, scriptDeps(client))).toEqual({
      status: "failed",
      errorCode: "configuration_missing",
    });
    expect(requests).toEqual([]);
    expect(await storyboardJob(runId)).toBeUndefined();
    expect((await runStatus(runId))?.resumeFrom).toBe("scripting");
  });
});

/** Kênh thử riêng của test (không đụng kênh mặc định): Tí, Bit có giọng; Đậu không nói. */
async function seedVoicedBrand() {
  const [brand] = await db
    .insert(brandProfiles)
    .values({
      slug: `test-p617-${Date.now().toString(36)}`,
      displayName: "Kênh test P6-17",
      palette: { accent: "#f26b3a", screen: "#8fe9ff", leaf: "#6cc04a" },
      fonts: { body: "system-ui" },
      toneRules: "",
      isDefault: false,
    })
    .returning();
  if (brand === undefined) {
    throw new Error("seed brand");
  }
  const character = (
    characterKey: string,
    displayName: string,
    role: string,
    speaks: boolean,
    voiceId: string | null,
    sortOrder: number,
  ) => ({
    brandProfileId: brand.id,
    characterKey,
    displayName,
    role,
    skinAssetId: `skin_${characterKey}`,
    personality: displayName,
    speaks,
    voiceId,
    sortOrder,
  });
  await db
    .insert(brandCharacters)
    .values([
      character("ti", "Tí", "protagonist", true, "Hải Đăng", 1),
      character("bit", "Bit", "explainer", true, "Trúc Ly", 2),
      character("dau", "Đậu", "companion", false, null, 3),
    ]);
  return brand.id;
}

/**
 * TTS giả cho script `2`: mỗi từ 1 giây (để tổng video vào khoảng 30–90 s mà QA kiểm), nghỉ 250 ms
 * giữa hai câu; ghi lại giọng mỗi câu.
 */
function fakeVoiceScenes() {
  const voices: string[] = [];
  const collect = async (voiceScenes: VoiceScene[]): Promise<SceneMediaArtifacts[]> =>
    voiceScenes.map((scene, index) => {
      const words: AlignResponse["words"] = [];
      let t = 0;
      const lines = scene.lines.map((line, li) => {
        voices.push(line.voiceId);
        if (li > 0) {
          t += 250;
        }
        const startMs = t;
        for (const token of line.text.split(" ")) {
          words.push({ text: token, startMs: t, endMs: t + 950 });
          t += 1000;
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
        wavArtifactId: `${index}`.padStart(32, "e"),
        measuredDurationMs: durationMs,
        lines,
        alignmentMode: "scene" as const,
        alignment: {
          alignmentArtifactId: "e".repeat(32),
          audioArtifactId: "e".repeat(32),
          durationMs,
          transcript: scene.lines.map((l) => l.text).join(" "),
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
            coverageStartMs: 0,
            coverageEndMs: t,
            durationDeltaMs: 100,
            nonMonotonicWordRatio: 0,
            timelineOrderRatio: 1,
          },
          gate: {
            alignedWordRatio: 1,
            durationDeltaMs: 100,
            coverageWithin250Ms: true,
            ratioAtLeast90Pct: true,
            validationOk: true,
            passesGate: true,
            gatePolicyVersion: "test",
            trailingSilenceVerified: false,
            trailingSilenceMs: null,
            coverageAcceptanceReason: "within_250ms" as const,
          },
          processingMs: 1,
        },
      };
    });
  return { collect, voices };
}

async function jobsOf(runId: string, role: string) {
  const agents = (await db.select().from(agentRuns)).filter(
    (a) => a.workflowRunId === runId && a.role === role,
  );
  return (await db.select().from(jobs)).filter((j) => agents.some((a) => a.id === j.agentRunId));
}

describe("chạy trọn script v2 sau khi duyệt (P6-17)", () => {
  async function approvedRun(brandProfileId?: string) {
    const seeded = await seedWhatIfRun("what_if", brandProfileId);
    const { client } = fakeClient([flatJson()]);
    const script = await runScriptJob(db, seeded.scriptJobId, scriptDeps(client));
    if (script.status !== "completed") {
      throw new Error("script job");
    }
    const sb = await storyboardJob(seeded.runId);
    await runStoryboardJob(db, sb?.job.id ?? "", {
      dataDir,
      renderer: fakeRenderer().renderer,
      loadAssetCatalog: () => CATALOG,
    });
    await recordApproval(db, {
      workflowRunId: seeded.runId,
      gate: "script",
      decision: "approved",
      artifactId: script.scriptArtifactId,
      variantIndex: 1,
      note: null,
    });
    return seeded;
  }

  it("voice đọc từng câu bằng giọng nhân vật; render StickStory; QA tới cổng final; không approval mới", async () => {
    const brandId = await seedVoicedBrand();
    const { runId } = await approvedRun(brandId);
    expect((await runStatus(runId))?.status).toBe("producing_assets");

    const [visual] = (await jobsOf(runId, "visual")).filter(
      (j) => !j.idempotencyKey.startsWith("storyboard:"),
    );
    const [voice] = await jobsOf(runId, "voice");
    expect(await runVisualJob(db, visual?.id ?? "", { dataDir })).toMatchObject({
      status: "completed",
      artifactIds: [],
    });
    const tts = fakeVoiceScenes();
    expect(
      await runVoiceJob(db, voice?.id ?? "", { dataDir, collectVoiceScenes: tts.collect }),
    ).toMatchObject({ status: "completed" });
    // l1 Tí, l2 Bit, l3 Tí, l4 Tí, l5 Bit, l6 Tí
    expect(tts.voices).toEqual([
      "Hải Đăng",
      "Trúc Ly",
      "Hải Đăng",
      "Hải Đăng",
      "Trúc Ly",
      "Hải Đăng",
    ]);
    const [audio] = await runArtifacts(runId, "audio");
    expect((audio?.metadata as { lines?: unknown[] } | undefined)?.lines).toHaveLength(5);

    const [render] = await jobsOf(runId, "video");
    const { backend, renders } = fakeBackend();
    expect(await runRenderJob(db, render?.id ?? "", { dataDir, backend })).toMatchObject({
      status: "completed",
    });
    const props = renders[0]?.props;
    if (props?.templateId !== "StickStory") {
      throw new Error(`template ${props?.templateId}`);
    }
    expect(props.templateVersion).toBe(`1.1.0+kit.${props.motionKitVersion}`);
    // Từ giả dài 1 giây làm shot quá 3 giây: builder chia shot (`s1b`…) để đúng luật nhịp what_if.
    expect([...new Set(props.shots.map((s) => s.shotId.replace(/[a-z]$/, "")))]).toEqual([
      "s1",
      "s2",
      "s3",
      "s4",
      "s5",
      "s6",
    ]);
    expect(props.shots.some((s) => /[a-z]$/.test(s.shotId))).toBe(true);
    expect(new Set(props.captions.map((c) => c.speaker))).toEqual(new Set(["ti", "bit"]));
    expect(props.shots[0]?.actors.map((a) => [a.character, a.skin, a.slot])).toEqual([
      ["ti", "skin_ti", "left"],
      ["bit", "skin_bit", "right"],
    ]);
    const [propsRow] = await runArtifacts(runId, "render_props");
    expect(propsRow?.schemaVersion).toBe("2");
    expect(propsRow?.metadata).toMatchObject({ templateId: "StickStory" });
    expect((await runStatus(runId))?.status).toBe("qa");

    const [qa] = await jobsOf(runId, "qa");
    expect(await runQaJob(db, qa?.id ?? "", { dataDir, backend })).toMatchObject({
      status: "completed",
    });
    expect((await runStatus(runId))?.status).toBe("waiting_final_approval");
    const [report] = await runArtifacts(runId, "qa_report");
    expect(report?.metadata).toMatchObject({ passed: true });
    expect((await runApprovals(runId)).map((a) => a.decision)).toEqual(["approved"]);
  });

  it("nhân vật nói chưa có giọng trong kênh: voice failed configuration_missing, không đọc bằng giọng khác", async () => {
    const { runId } = await approvedRun();
    const [voice] = await jobsOf(runId, "voice");
    const tts = fakeVoiceScenes();
    const result = await runVoiceJob(db, voice?.id ?? "", {
      dataDir,
      collectVoiceScenes: tts.collect,
    });
    expect(result).toEqual({ status: "failed", errorCode: "configuration_missing" });
    expect(tts.voices).toEqual([]);
    const run = await runStatus(runId);
    expect(run?.status).toBe("failed");
    expect(run?.resumeFrom).toBe("producing_assets");
  });
});
