import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  classifyClaudeCliFailure,
  claudeCodeArgs,
  createClaudeCodeClient,
} from "./claude-code-client.js";
import { LlmError } from "./errors.js";
import type { StructuredGenerateRequest } from "./structured-output.js";

/** CLI giả: đọc chế độ từ tham số đầu, in JSON giống `claude -p --output-format json`. */
const FAKE_CLI = `
const mode = process.argv[2];
const args = process.argv.slice(3);
let stdin = "";
process.stdin.on("data", (d) => (stdin += d));
process.stdin.on("end", () => {
  const echo = { args, stdin, cwd: process.cwd() };
  if (mode === "ok") {
    console.log(JSON.stringify({
      subtype: "success", is_error: false, result: "",
      structured_output: { echo },
      usage: { input_tokens: 2, cache_creation_input_tokens: 100, cache_read_input_tokens: 50, output_tokens: 300, output_tokens_details: { thinking_tokens: 7 } },
      modelUsage: { "claude-opus-5-5": {}, "claude-opus-4-8": {} },
    }));
  } else if (mode === "auth") {
    console.log(JSON.stringify({ subtype: "success", is_error: true, api_error_status: 401, result: "Invalid API key · Please run /login" }));
  } else if (mode === "quota") {
    console.log(JSON.stringify({ subtype: "success", is_error: true, api_error_status: 429, result: "Claude AI usage limit reached" }));
  } else if (mode === "refuse") {
    console.log(JSON.stringify({ subtype: "success", is_error: false, result: "I cannot help with that." }));
  } else if (mode === "crash") {
    console.error("Error: Not logged in");
    process.exit(1);
  } else if (mode === "slow") {
    setTimeout(() => {}, 60000);
  }
});
`;

const request: StructuredGenerateRequest = {
  systemInstruction: "Viết kịch bản.",
  userPrompt: "brief: Redis cache",
  responseJsonSchema: { type: "object", properties: { variants: { type: "array" } } },
  model: "claude-code",
  thinkingLevel: "low",
};

let dir: string;
let script: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "fake-claude-"));
  script = join(dir, "fake-claude.cjs");
  writeFileSync(script, FAKE_CLI);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const client = (mode: string, timeoutMs = 20_000, model?: string) =>
  createClaudeCodeClient({
    bin: process.execPath,
    binArgs: [script, mode],
    timeoutMs,
    ...(model ? { model } : {}),
  });

describe("claudeCodeArgs (P6-15)", () => {
  it("có đủ cờ khóa chặt, system prompt và schema của app; model chỉ khi có alias", () => {
    const args = claudeCodeArgs(request);
    for (const flag of ["-p", "--safe-mode", "--strict-mcp-config", "--no-session-persistence"]) {
      expect(args).toContain(flag);
    }
    expect(args[args.indexOf("--tools") + 1]).toBe("");
    expect(args[args.indexOf("--permission-mode") + 1]).toBe("dontAsk");
    expect(args[args.indexOf("--output-format") + 1]).toBe("json");
    expect(args[args.indexOf("--system-prompt") + 1]).toBe("Viết kịch bản.");
    expect(JSON.parse(args[args.indexOf("--json-schema") + 1] ?? "")).toEqual(
      request.responseJsonSchema,
    );
    expect(args).not.toContain("--bare");
    expect(args).not.toContain("--model");
    expect(claudeCodeArgs(request, "sonnet").slice(-2)).toEqual(["--model", "sonnet"]);
  });
});

describe("createClaudeCodeClient với CLI giả", () => {
  it("prompt đi qua stdin, trả structured_output, usage claude-code chi phí theo token, xóa thư mục tạm", async () => {
    const res = await client("ok", 20_000, "sonnet").generateStructured(request);
    const echo = (
      JSON.parse(res.jsonText) as { echo: { args: string[]; stdin: string; cwd: string } }
    ).echo;
    expect(echo.stdin).toBe("brief: Redis cache");
    expect(echo.args).toContain("--safe-mode");
    expect(echo.args.slice(-2)).toEqual(["--model", "sonnet"]);
    expect(echo.cwd).toMatch(/studio-claude-code-/);
    expect(existsSync(echo.cwd)).toBe(false);
    expect(res.usage).toEqual({
      provider: "claude-code",
      model: "claude-opus-4-8",
      inputTokens: 152,
      outputTokens: 300,
      thinkingTokens: 7,
    });
  });

  it.each([
    ["auth", "configuration_missing"],
    ["quota", "quota_exhausted"],
    ["refuse", "provider_error"],
    ["crash", "configuration_missing"],
  ])("chế độ %s → %s", async (mode, code) => {
    await expect(client(mode).generateStructured(request)).rejects.toMatchObject({ code });
  });

  it("quá thời gian thì dừng tiến trình và báo provider_error", async () => {
    await expect(client("slow", 500).generateStructured(request)).rejects.toMatchObject({
      code: "provider_error",
    });
  });

  it("không tìm thấy CLI → configuration_missing", async () => {
    const missing = createClaudeCodeClient({
      bin: join(dir, "khong-co-claude.exe"),
      timeoutMs: 5_000,
    });
    await expect(missing.generateStructured(request)).rejects.toMatchObject({
      code: "configuration_missing",
    });
  });
});

describe("classifyClaudeCliFailure", () => {
  it("phân loại theo mã HTTP và thông điệp", () => {
    expect(classifyClaudeCliFailure("x", 403).code).toBe("configuration_missing");
    expect(classifyClaudeCliFailure("You've hit your usage limit").code).toBe("quota_exhausted");
    expect(classifyClaudeCliFailure("overloaded").code).toBe("provider_error");
    expect(classifyClaudeCliFailure("overloaded")).toBeInstanceOf(LlmError);
  });
});
