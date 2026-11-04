import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi as vitest } from "vitest";
import { vi } from "@/i18n/vi";
import { apiError, installFakeApi, jsonResponse, NOW_ISO } from "@/test/fake-api";
import { UsagePanel } from "./usage-panel";
import { sumUsage } from "./usage-totals";

/** Source của màn usage (trừ test), đọc qua Vite `?raw` để quét tĩnh. */
const RAW_SOURCES = import.meta.glob<string>(["./*.ts", "./*.tsx", "!./*.test.tsx"], {
  query: "?raw",
  import: "default",
  eager: true,
});

const RUN_ID = "00000000-0000-4000-8000-0000000000b1";
const AGENT_ID = "00000000-0000-4000-8000-0000000000b2";
const USAGE_URL = `GET /api/workflow-runs/${RUN_ID}/usage`;

function record(id: string, overrides: Record<string, unknown>) {
  return {
    id,
    workflowRunId: RUN_ID,
    agentRunId: AGENT_ID,
    provider: "gemini",
    model: "model-da-luu",
    inputTokens: 0,
    outputTokens: 0,
    thinkingTokens: 0,
    estimatedCostUsd: "0.000000",
    createdAt: NOW_ISO,
    ...overrides,
  };
}

const TWO_RECORDS = [
  record("00000000-0000-4000-8000-0000000000c1", {
    inputTokens: 1200,
    outputTokens: 300,
    thinkingTokens: 40,
    estimatedCostUsd: "0.000120",
  }),
  record("00000000-0000-4000-8000-0000000000c2", {
    inputTokens: 800,
    outputTokens: 150,
    thinkingTokens: 10,
    estimatedCostUsd: "0.000035",
  }),
];

function renderPanel(runId: string | null) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <UsagePanel runId={runId} />
    </QueryClientProvider>,
  );
}

function stat(label: string) {
  return screen.getByTestId(`usage-${label}`).textContent;
}

afterEach(() => {
  cleanup();
  vitest.unstubAllGlobals();
});

describe("màn usage (P5-02)", () => {
  it("render với hai record: tổng token và tổng chi phí đã lưu", async () => {
    installFakeApi({ [USAGE_URL]: () => jsonResponse(200, { usageRecords: TWO_RECORDS }) });
    renderPanel(RUN_ID);
    await screen.findByText(vi.usage.estimateNote);
    expect(stat(vi.usage.calls)).toBe("2");
    expect(stat(vi.usage.inputTokens)).toBe(new Intl.NumberFormat("vi-VN").format(2000));
    expect(stat(vi.usage.outputTokens)).toBe("450");
    expect(stat(vi.usage.thinkingTokens)).toBe("50");
    expect(stat(vi.usage.estimatedCost)).toBe("0.000155");
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.getAllByText("model-da-luu")).toHaveLength(2);
  });

  it("đọc số đã lưu: chi phí không tính lại từ token", () => {
    const totals = sumUsage([
      record("00000000-0000-4000-8000-0000000000d1", {
        inputTokens: 1_000_000,
        estimatedCostUsd: "0.000000",
      }),
      record("00000000-0000-4000-8000-0000000000d2", {
        inputTokens: 5,
        estimatedCostUsd: "1.250001",
      }),
    ] as Parameters<typeof sumUsage>[0]);
    expect(totals.estimatedCostUsd).toBe("1.250001");
    expect(totals.inputTokens).toBe(1_000_005);
  });

  it("không hard-code đơn giá trong component", () => {
    expect(Object.keys(RAW_SOURCES).sort()).toEqual([
      "./usage-panel.tsx",
      "./usage-totals.ts",
      "./use-usage.ts",
    ]);
    for (const [file, source] of Object.entries(RAW_SOURCES)) {
      expect(source, file).not.toMatch(
        /price|pricing|perMillion|per_million|USD_PER|\bTokens\s*\*/i,
      );
    }
  });

  it("chưa có lượt chạy thì không gọi API", () => {
    const api = installFakeApi();
    renderPanel(null);
    expect(screen.getByText(vi.usage.noRun)).toBeTruthy();
    expect(api.callsTo(USAGE_URL)).toHaveLength(0);
  });

  it("lượt chạy chưa gọi LLM và lỗi API hiện tiếng Việt", async () => {
    installFakeApi({ [USAGE_URL]: () => jsonResponse(200, { usageRecords: [] }) });
    renderPanel(RUN_ID);
    expect(await screen.findByText(vi.usage.empty)).toBeTruthy();
    cleanup();
    installFakeApi({ [USAGE_URL]: () => apiError(500, "validation_error") });
    renderPanel(RUN_ID);
    expect(await screen.findByText(vi.usage.error)).toBeTruthy();
    expect(screen.queryByText("SERVER_RAW_MESSAGE")).toBeNull();
  });
});
