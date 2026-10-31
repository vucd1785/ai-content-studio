import { type GeminiEnvConfig, readGeminiEnv } from "@studio/config/gemini";
import { createGeminiStructuredClient } from "./gemini-client.js";
import { mapGeminiScriptVariantsResponse } from "./gemini-diagram-transform.js";
import {
  buildScriptGenerationPrompt,
  scriptTaskSystemInstruction,
  scriptVariantsGeminiGenerationSchema,
} from "./script-prompt.js";
import { scriptVariantsPayloadSchema } from "./script-schema.js";
import type { StructuredGenerateClient } from "./structured-output.js";
import { generateWithSchemaRepair } from "./structured-output.js";
import type {
  ScriptGenerationInput,
  ScriptGenerationResult,
  StructuredLlmAdapter,
} from "./types.js";

export type GeminiAdapterOptions = {
  config?: GeminiEnvConfig;
  client?: StructuredGenerateClient;
};

export function createGeminiAdapter(options: GeminiAdapterOptions = {}): StructuredLlmAdapter {
  const config = options.config ?? readGeminiEnv(process.env);
  const client = options.client ?? createGeminiStructuredClient(config);

  return {
    async generateScriptVariants(input: ScriptGenerationInput): Promise<ScriptGenerationResult> {
      const userPrompt = buildScriptGenerationPrompt(input);
      const result = await generateWithSchemaRepair(scriptVariantsPayloadSchema, client, {
        systemInstruction: scriptTaskSystemInstruction(),
        userPrompt,
        responseJsonSchema: scriptVariantsGeminiGenerationSchema(),
        model: config.modelScript,
        thinkingLevel: config.thinkingLevelScript,
      }, {
        mapParsedJson: mapGeminiScriptVariantsResponse,
        repairNotes:
          "Diagram scenes use diagramJson: a JSON string (no markdown fences) encoding { nodes: [{id,label}], edges: [{from,to,label?}] }. Do not emit nested diagram objects.",
      });

      return {
        variants: result.data.variants,
        usage: result.usage,
        repairCount: result.repairCount,
      };
    },
  };
}

export { readGeminiEnv };
