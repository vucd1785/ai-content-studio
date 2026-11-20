import { type GeminiEnvConfig, readGeminiEnv } from "@studio/config/gemini";
import { createGeminiStructuredClient } from "./gemini-client.js";
import {
  buildResearchPrompt,
  type ResearchDocument,
  type ResearchExtraction,
  researchExtractionSchema,
  researchGeminiGenerationSchema,
  researchSystemInstruction,
} from "./research-prompt.js";
import { generateWithSchemaRepair, type StructuredGenerateClient } from "./structured-output.js";
import type { BriefInput, LlmUsage } from "./types.js";

export type ResearchExtractionInput = { brief: BriefInput; documents: ResearchDocument[] };

export type ResearchExtractionResult = {
  extraction: ResearchExtraction;
  usage: LlmUsage[];
  repairCount: number;
};

/** Cổng LLM của job research. Job nhận interface này để test bằng LLM giả. */
export type ResearchLlm = {
  extractResearch(input: ResearchExtractionInput): Promise<ResearchExtractionResult>;
};

export type GeminiResearchAdapterOptions = {
  config?: GeminiEnvConfig;
  client?: StructuredGenerateClient;
};

/**
 * Research qua Gemini structured output. Không bật Google Search grounding hay tool nào
 * (docs/04-AGENT-ORCHESTRATION.md): request chỉ có system instruction, prompt và JSON schema.
 * Dùng chung model và mức thinking của script; chưa có biến env riêng cho research.
 */
export function createGeminiResearchAdapter(
  options: GeminiResearchAdapterOptions = {},
): ResearchLlm {
  const config = options.config ?? readGeminiEnv(process.env);
  const client = options.client ?? createGeminiStructuredClient(config);
  return {
    async extractResearch(input) {
      const result = await generateWithSchemaRepair(researchExtractionSchema, client, {
        systemInstruction: researchSystemInstruction(),
        userPrompt: buildResearchPrompt(input),
        responseJsonSchema: researchGeminiGenerationSchema(),
        model: config.modelScript,
        thinkingLevel: config.thinkingLevelScript,
      });
      return { extraction: result.data, usage: result.usage, repairCount: result.repairCount };
    },
  };
}
