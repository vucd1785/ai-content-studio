import { ENV_KEYS } from "@studio/config/env";
import { readGeminiEnv } from "@studio/config/gemini";
import { createClient } from "redis";
import { createGeminiAdapter } from "./gemini-adapter.js";
import { briefInputSchema } from "./types.js";

const DEFAULT_BRIEF_KEY = "studio:llm:brief";

function parseArgv(argv: string[]): { redisKey: string } {
  const keyFlag = argv.indexOf("--redis-key");
  const redisKey = keyFlag >= 0 ? argv[keyFlag + 1] : DEFAULT_BRIEF_KEY;
  if (!redisKey || redisKey.startsWith("-")) {
    throw new Error("Missing value for --redis-key");
  }
  return { redisKey };
}

export async function runExternalScriptGeneration(argv: string[]): Promise<number> {
  const config = readGeminiEnv(process.env);
  if (!config.apiKey) {
    console.error(
      JSON.stringify({
        status: "blocked",
        reason: "Missing GEMINI_API_KEY",
      }),
    );
    return 2;
  }

  const redisUrl = process.env[ENV_KEYS.REDIS_URL]?.trim() || "redis://127.0.0.1:6379";
  const { redisKey } = parseArgv(argv);

  const client = createClient({ url: redisUrl });
  await client.connect();

  try {
    const raw = await client.get(redisKey);
    if (!raw) {
      console.error(
        JSON.stringify({
          status: "error",
          code: "brief_missing",
          message: `Redis key not found: ${redisKey}`,
        }),
      );
      return 1;
    }

    let briefJson: unknown;
    try {
      briefJson = JSON.parse(raw) as unknown;
    } catch {
      console.error(
        JSON.stringify({
          status: "error",
          code: "brief_invalid",
          message: "Brief value is not valid JSON",
        }),
      );
      return 1;
    }

    const briefParsed = briefInputSchema.safeParse(briefJson);
    if (!briefParsed.success) {
      console.error(
        JSON.stringify({
          status: "error",
          code: "brief_invalid",
          message: briefParsed.error.message,
        }),
      );
      return 1;
    }

    const adapter = createGeminiAdapter({ config });
    const result = await adapter.generateScriptVariants({ brief: briefParsed.data });

    console.log(
      JSON.stringify(
        {
          status: "pass",
          repairCount: result.repairCount,
          usage: result.usage,
          variants: result.variants,
        },
        null,
        2,
      ),
    );
    return 0;
  } finally {
    await client.quit();
  }
}
