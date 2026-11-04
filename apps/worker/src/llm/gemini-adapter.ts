import { type GeminiEnvConfig, readGeminiEnv } from "@studio/config/gemini";
import { scriptV2ArtifactSchema } from "@studio/contracts";
import { createGeminiStructuredClient } from "./gemini-client.js";
import {
  buildScriptV2Prompt,
  decodeFlatScriptV2,
  scriptV2GenerationSchema,
  scriptV2SystemInstruction,
} from "./script-v2-prompt.js";
import type { StructuredGenerateClient } from "./structured-output.js";
import { generateWithSchemaRepair } from "./structured-output.js";
import type { ScriptV2GenerationResult, StructuredLlmAdapter } from "./types.js";

export type GeminiAdapterOptions = {
  config?: GeminiEnvConfig;
  client?: StructuredGenerateClient;
};

export function createGeminiAdapter(options: GeminiAdapterOptions = {}): StructuredLlmAdapter {
  const config = options.config ?? readGeminiEnv(process.env);
  const client = options.client ?? createGeminiStructuredClient(config);

  return {
    async generateScriptV2Variants(input, schemaOptions) {
      const result = await generateWithSchemaRepair(
        scriptV2ArtifactSchema(schemaOptions),
        client,
        {
          systemInstruction: scriptV2SystemInstruction(),
          userPrompt: buildScriptV2Prompt(input),
          responseJsonSchema: scriptV2GenerationSchema(input),
          model: config.modelScript,
          thinkingLevel: config.thinkingLevelScript,
        },
        {
          mapParsedJson: (raw) => decodeFlatScriptV2(raw, input.format),
          repairNotes:
            "Flat layout: lines and shots are arrays at variant level with sceneId; actors are actor1 and optional actor2, actor3 (actor3 only for wide or high shots). Use only ids from the enums.",
        },
      );
      return {
        variants: result.data.variants as ScriptV2GenerationResult["variants"],
        usage: result.usage,
        repairCount: result.repairCount,
      };
    },
  };
}

export { readGeminiEnv };
