/**
 * Client Claude Code (ADR-007, bổ sung 2026-11-02): `StructuredGenerateClient` chạy `claude -p` bằng gói
 * thuê bao của Director. Cùng interface với client Gemini nên research và script dùng chung prompt,
 * generation schema, Zod và một lần repair. Spike: docs/spikes/P6-14-claude-code-headless.md.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LlmError } from "./errors.js";
import type { StructuredGenerateClient, StructuredGenerateRequest } from "./structured-output.js";

/** Các trường của `claude -p --output-format json` mà client đọc. */
export type ClaudeCliResult = {
  subtype?: string;
  is_error?: boolean;
  result?: string;
  api_error_status?: number | null;
  structured_output?: unknown;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
    output_tokens_details?: { thinking_tokens?: number };
  };
  modelUsage?: Record<string, unknown>;
};

export type ClaudeCodeClientOptions = {
  bin: string;
  /** Tham số đặt trước cờ của client; test dùng để chạy CLI giả bằng `node <script>`. */
  binArgs?: string[];
  /** Alias cho `--model`; không đặt thì dùng model mặc định của tài khoản. */
  model?: string;
  timeoutMs: number;
  /**
   * ADR-032: chỉ lần gọi tìm ảnh trên web bật `WebSearch` (tìm kiếm chạy phía Anthropic, không đọc máy). Mặc định
   * không công cụ nào.
   */
  webSearch?: boolean;
};

/** Số lượt tối đa khi có tìm kiếm web: vài lần tìm rồi trả JSON. */
const WEB_SEARCH_MAX_TURNS = "8";

/**
 * Cờ khóa chặt: không nạp cấu hình người dùng, không công cụ, không MCP, không lưu phiên,
 * system prompt của app. Không dùng `--bare` vì `--bare` bỏ qua đăng nhập gói thuê bao.
 * `webSearch` (ADR-032) chỉ bật đúng công cụ `WebSearch`, không `WebFetch`, Bash hay file.
 */
export function claudeCodeArgs(
  request: StructuredGenerateRequest,
  model?: string,
  webSearch = false,
): string[] {
  return [
    "-p",
    "--output-format",
    "json",
    "--safe-mode",
    "--tools",
    webSearch ? "WebSearch" : "",
    ...(webSearch ? ["--allowedTools", "WebSearch"] : []),
    "--strict-mcp-config",
    "--permission-mode",
    "dontAsk",
    "--no-session-persistence",
    "--max-turns",
    webSearch ? WEB_SEARCH_MAX_TURNS : "3",
    "--system-prompt",
    request.systemInstruction,
    ...(request.responseJsonSchema
      ? ["--json-schema", JSON.stringify(request.responseJsonSchema)]
      : []),
    ...(model ? ["--model", model] : []),
  ];
}

const AUTH_HINT =
  /not logged in|\/login|auth login|authenticat|oauth|invalid api key|unauthorized/i;
const QUOTA_HINT = /usage limit|limit reached|rate limit|quota|too many requests/i;

/** Phân loại kết quả lỗi của CLI thành mã lỗi của app. */
export function classifyClaudeCliFailure(text: string, apiStatus?: number | null): LlmError {
  const detail = text.trim().slice(0, 400);
  if (apiStatus === 401 || apiStatus === 403 || AUTH_HINT.test(text)) {
    return new LlmError(
      "configuration_missing",
      `Claude Code chưa đăng nhập hoặc mất phiên đăng nhập; chạy \`claude auth login\`. ${detail}`,
    );
  }
  if (apiStatus === 429 || QUOTA_HINT.test(text)) {
    return new LlmError(
      "quota_exhausted",
      `Hết hạn mức gói Claude; tiếp tục sau khi hạn mức reset. ${detail}`,
    );
  }
  return new LlmError("provider_error", `claude -p lỗi: ${detail}`);
}

export function createClaudeCodeClient(options: ClaudeCodeClientOptions): StructuredGenerateClient {
  return {
    async generateStructured(request) {
      // Thư mục tạm trống: không có CLAUDE.md, .mcp.json hay file nào để đọc. Xóa sau mỗi lần gọi.
      const cwd = mkdtempSync(join(tmpdir(), "studio-claude-code-"));
      let stdout: string;
      try {
        stdout = await runCli(
          options,
          [
            ...(options.binArgs ?? []),
            ...claudeCodeArgs(request, options.model, options.webSearch === true),
          ],
          request.userPrompt,
          cwd,
        );
      } finally {
        removeTempDir(cwd);
      }
      let parsed: ClaudeCliResult;
      try {
        parsed = JSON.parse(stdout) as ClaudeCliResult;
      } catch {
        throw classifyClaudeCliFailure(stdout);
      }
      if (parsed.is_error || parsed.structured_output === undefined) {
        throw classifyClaudeCliFailure(
          `${parsed.subtype ?? "error"}: ${parsed.result ?? ""}`,
          parsed.api_error_status,
        );
      }
      const usage = parsed.usage ?? {};
      return {
        jsonText: JSON.stringify(parsed.structured_output),
        usage: {
          provider: "claude-code",
          // CLI có thể chuyển model khi bộ lọc an toàn chặn; model cuối danh sách là model đã trả kết quả.
          model: Object.keys(parsed.modelUsage ?? {}).at(-1) ?? options.model ?? "claude-code",
          inputTokens:
            (usage.input_tokens ?? 0) +
            (usage.cache_read_input_tokens ?? 0) +
            (usage.cache_creation_input_tokens ?? 0),
          outputTokens: usage.output_tokens ?? 0,
          thinkingTokens: usage.output_tokens_details?.thinking_tokens ?? 0,
        },
      };
    },
  };
}

/**
 * Xóa thư mục tạm, thử lại vài lần vì Windows còn khóa thư mục khi tiến trình con vừa thoát.
 * Không xóa được thì bỏ qua: lỗi dọn dẹp không được che lỗi thật của lần gọi.
 */
function removeTempDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch (error) {
    console.error(
      `claude-code: không xóa được thư mục tạm ${dir}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Sau khi dừng tiến trình vì quá giờ, chờ nó thoát tối đa chừng này trước khi báo lỗi. */
const KILL_GRACE_MS = 5_000;

function runCli(
  options: ClaudeCodeClientOptions,
  args: string[],
  stdin: string,
  cwd: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(options.bin, args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let out = "";
    let err = "";
    let settled = false;
    let timedOut = false;
    let graceTimer: NodeJS.Timeout | undefined;
    const timeoutError = () =>
      new LlmError("provider_error", `claude -p chạy quá ${options.timeoutMs} ms`);
    const finish = (action: () => void) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        clearTimeout(graceTimer);
        action();
      }
    };
    // Quá giờ: dừng hẳn tiến trình và chờ `close` để thư mục tạm không còn bị giữ khi xóa.
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
      graceTimer = setTimeout(() => finish(() => reject(timeoutError())), KILL_GRACE_MS);
    }, options.timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      err += chunk.toString("utf8");
    });
    child.on("error", (error) =>
      finish(() =>
        reject(
          new LlmError(
            "configuration_missing",
            `Không chạy được Claude Code CLI (${options.bin}): ${error.message}. Cài CLI hoặc đặt CLAUDE_BIN.`,
          ),
        ),
      ),
    );
    child.on("close", (code) =>
      finish(() => {
        if (timedOut) {
          reject(timeoutError());
          return;
        }
        if (out.trim() === "") {
          reject(classifyClaudeCliFailure(`exit ${code}: ${err}`));
          return;
        }
        resolve(out);
      }),
    );
    child.stdin.end(stdin, "utf8");
  });
}
