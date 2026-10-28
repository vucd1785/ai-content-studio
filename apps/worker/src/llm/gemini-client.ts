import { GoogleGenAI } from "@google/genai";
import type { GeminiEnvConfig } from "@studio/config/gemini";
import { LlmError } from "./errors.js";
import type {
  StructuredGenerateClient,
  StructuredGenerateRequest,
  StructuredGenerateResponse,
} from "./structured-output.js";
import type { LlmUsage } from "./types.js";

function mapUsage(model: string, metadata: unknown): LlmUsage {
  const meta = metadata as {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
  return {
    provider: "gemini",
    model,
    inputTokens: meta.promptTokenCount ?? 0,
    outputTokens: meta.candidatesTokenCount ?? 0,
    thinkingTokens: meta.thoughtsTokenCount ?? 0,
  };
}

export function createGeminiStructuredClient(config: GeminiEnvConfig): StructuredGenerateClient {
  if (!config.apiKey) {
    throw new LlmError("configuration_missing", "GEMINI_API_KEY is not set");
  }

  const ai = new GoogleGenAI({ apiKey: config.apiKey });

  return {
    async generateStructured(
      request: StructuredGenerateRequest,
    ): Promise<StructuredGenerateResponse> {
      try {
        const thinkingConfig =
          request.thinkingBudget > 0
            ? { thinkingBudget: request.thinkingBudget }
            : { thinkingBudget: 0 };

        const response = await ai.models.generateContent({
          model: request.model,
          contents: request.userPrompt,
          config: {
            systemInstruction: request.systemInstruction,
            responseMimeType: "application/json",
            ...(request.responseJsonSchema ? { responseSchema: request.responseJsonSchema } : {}),
            thinkingConfig,
          },
        });

        const jsonText = response.text ?? "";
        if (!jsonText.trim()) {
          throw new LlmError("schema_invalid", "Gemini returned empty structured response");
        }

        return {
          jsonText,
          usage: mapUsage(request.model, response.usageMetadata),
        };
      } catch (cause) {
        if (cause instanceof LlmError) {
          throw cause;
        }
        const message = cause instanceof Error ? cause.message : String(cause);
        throw new LlmError("provider_error", message);
      }
    },
  };
}
