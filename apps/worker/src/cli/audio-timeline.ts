import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SCENE_EDGE_PAD_MS } from "@studio/contracts";

const PAD_SECONDS = SCENE_EDGE_PAD_MS / 1000;

export type SceneWavInput = {
  sceneId: string;
  wavPath: string;
};

/**
 * Builds one timeline WAV: per scene 200 ms silence + narration + 200 ms silence.
 */
export function buildCombinedTimelineWav(
  scenes: SceneWavInput[],
  outputPath: string,
  sampleRate = 48_000,
): void {
  if (scenes.length === 0) {
    throw new Error("At least one scene WAV is required");
  }

  mkdirSync(dirname(outputPath), { recursive: true });

  const args: string[] = ["-hide_banner", "-loglevel", "error", "-y"];
  const filterParts: string[] = [];
  let inputIndex = 0;

  for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex += 1) {
    const scene = scenes[sceneIndex];
    if (!scene) {
      throw new Error(`Missing scene at index ${sceneIndex}`);
    }

    args.push(
      "-f",
      "lavfi",
      "-t",
      String(PAD_SECONDS),
      "-i",
      `anullsrc=channel_layout=mono:sample_rate=${sampleRate}`,
    );
    const leadIdx = inputIndex;
    inputIndex += 1;

    args.push("-i", scene.wavPath);
    const narrIdx = inputIndex;
    inputIndex += 1;

    args.push(
      "-f",
      "lavfi",
      "-t",
      String(PAD_SECONDS),
      "-i",
      `anullsrc=channel_layout=mono:sample_rate=${sampleRate}`,
    );
    const tailIdx = inputIndex;
    inputIndex += 1;

    filterParts.push(
      `[${leadIdx}:a]aformat=sample_rates=${sampleRate}:channel_layouts=mono[lead${sceneIndex}]`,
      `[${narrIdx}:a]aformat=sample_rates=${sampleRate}:channel_layouts=mono[narr${sceneIndex}]`,
      `[${tailIdx}:a]aformat=sample_rates=${sampleRate}:channel_layouts=mono[tail${sceneIndex}]`,
    );
  }

  const concatLabels = scenes
    .flatMap((_, sceneIndex) => [
      `[lead${sceneIndex}]`,
      `[narr${sceneIndex}]`,
      `[tail${sceneIndex}]`,
    ])
    .join("");
  filterParts.push(`${concatLabels}concat=n=${scenes.length * 3}:v=0:a=1[outa]`);

  args.push("-filter_complex", filterParts.join(";"), "-map", "[outa]", outputPath);

  execFileSync("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
}

export function resolvePublicAudioStorageKey(combinedSha256: string): string {
  return `pipeline/edu-${combinedSha256.slice(0, 16)}.wav`;
}
