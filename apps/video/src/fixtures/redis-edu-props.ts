import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type AlignmentWord,
  computeSceneTimingPlan,
  parseScript,
  type RemotionCaption,
  SCENE_EDGE_PAD_MS,
} from "@studio/contracts";
import {
  assertSceneSlotsMatchScript,
  EDU_VERTICAL_TEMPLATE_ID,
  EDU_VERTICAL_TEMPLATE_VERSION,
  type EduVerticalRenderProps,
  MVP_FPS,
  MVP_HEIGHT,
  MVP_WIDTH,
} from "../render-props/schema";

function findRepoRoot(startFile: string): string {
  let dir = dirname(startFile);
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = join(dir, "fixtures", "script.edu.json");
    if (existsSync(candidate)) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error("Could not locate fixtures/script.edu.json from repo root");
}

const repoRoot = findRepoRoot(fileURLToPath(import.meta.url));
const scriptEdu = JSON.parse(
  readFileSync(join(repoRoot, "fixtures", "script.edu.json"), "utf8"),
) as unknown;

/** Short measured durations for deterministic fixture render (no TTS). */
const FIXTURE_MEASURED_MS = [900, 1100, 1000, 1000, 900] as const;

function wordsFromNarration(narration: string): AlignmentWord[] {
  const parts = narration.split(/\s+/u).filter(Boolean);
  let cursor = 0;
  const words: AlignmentWord[] = [];
  for (const text of parts) {
    const duration = Math.max(120, Math.round(60000 / Math.max(parts.length, 8)));
    words.push({ text, startMs: cursor, endMs: cursor + duration });
    cursor += duration + 40;
  }
  return words;
}

function mapWordsToCaptions(
  words: AlignmentWord[],
  sceneFromMs: number,
  sceneDurationMs: number,
): RemotionCaption[] {
  const audioOffsetMs = sceneFromMs + SCENE_EDGE_PAD_MS;
  const sceneEndMs = sceneFromMs + sceneDurationMs;
  const captions: RemotionCaption[] = [];

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (!word) {
      continue;
    }
    const startMs = Math.min(Math.round(audioOffsetMs + word.startMs), sceneEndMs - 1);
    const endMs = Math.min(Math.round(audioOffsetMs + word.endMs), sceneEndMs);
    if (endMs <= startMs) {
      continue;
    }
    const text = index === 0 ? word.text.replace(/^\s+/, "") : ` ${word.text.replace(/^\s+/, "")}`;
    captions.push({
      text,
      startMs,
      endMs,
      timestampMs: startMs,
      confidence: null,
    });
  }

  return captions;
}

/**
 * Fixture render_props for Redis edu script — all five template slots, short timeline.
 */
export function buildRedisEduVerticalFixtureProps(
  audioStorageKey = "fixture/silence.wav",
): EduVerticalRenderProps {
  const script = parseScript(scriptEdu);
  const measured = script.scenes.map((scene, index) => ({
    sceneId: scene.id,
    measuredDurationMs: FIXTURE_MEASURED_MS[index] ?? 1000,
  }));
  const plan = computeSceneTimingPlan(measured, MVP_FPS);

  const scenes: EduVerticalRenderProps["scenes"] = script.scenes.map((scene, index) => {
    const timing = plan.scenes[index];
    if (!timing) {
      throw new Error(`Missing timing for scene index ${index}`);
    }
    const base = {
      sceneId: scene.id,
      fromMs: timing.fromMs,
      durationMs: timing.durationMs,
      onScreenText: scene.onScreenText,
      visualIntent: scene.visualIntent,
    };

    switch (scene.templateSlot) {
      case "title":
        return {
          ...base,
          templateSlot: "title",
          headline: script.title,
          hook: script.hook,
        };
      case "explain":
        return { ...base, templateSlot: "explain" };
      case "code":
        return {
          ...base,
          templateSlot: "code",
          codeSnippet: scene.codeSnippet,
        };
      case "diagram":
        return {
          ...base,
          templateSlot: "diagram",
          diagram: scene.diagram,
        };
      case "cta":
        return {
          ...base,
          templateSlot: "cta",
          ctaText: script.cta,
        };
      default:
        throw new Error("Unsupported slot");
    }
  });

  assertSceneSlotsMatchScript(scenes, script.scenes);

  const captions = script.scenes.flatMap((scene, index) => {
    const timing = plan.scenes[index];
    if (!timing) {
      return [];
    }
    return mapWordsToCaptions(
      wordsFromNarration(scene.narration),
      timing.fromMs,
      timing.durationMs,
    );
  });

  return {
    templateId: EDU_VERTICAL_TEMPLATE_ID,
    templateVersion: EDU_VERTICAL_TEMPLATE_VERSION,
    fps: MVP_FPS,
    width: MVP_WIDTH,
    height: MVP_HEIGHT,
    audio: {
      storageKey: audioStorageKey,
      durationMs: plan.totalDurationMs,
    },
    scenes,
    captions,
  };
}
