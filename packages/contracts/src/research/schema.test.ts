import { describe, expect, it } from "vitest";
import { type FetchLog, filterResearchFacts, type Research, researchSchema } from "./schema.js";

const HASH = "a".repeat(64);

const fetchLog: FetchLog = {
  schemaVersion: 1,
  requests: [
    {
      url: "https://docs.example.com/redis",
      finalUrl: "https://docs.example.com/redis/",
      status: 200,
      contentHash: HASH,
    },
    {
      url: "https://docs.example.com/slow",
      finalUrl: null,
      status: null,
      contentHash: null,
      error: "timeout",
    },
  ],
};

function research(overrides: Partial<Research> = {}): Research {
  return {
    schemaVersion: 1,
    summary: "Redis là kho key-value trong RAM.",
    sources: [
      {
        id: "url-1",
        title: "Redis docs",
        origin: "fetched_url",
        url: "https://docs.example.com/redis/",
      },
      {
        id: "url-2",
        title: "Trang chậm",
        origin: "fetched_url",
        url: "https://docs.example.com/slow",
      },
      {
        id: "url-3",
        title: "Trang không fetch",
        origin: "fetched_url",
        url: "https://evil.example.net/",
      },
      { id: "ref-1", title: "notes.md", origin: "user_reference" },
      { id: "ref-9", title: "không thuộc project", origin: "user_reference" },
    ],
    facts: [],
    ...overrides,
  };
}

const provenance = { fetchLog, userReferenceSourceIds: new Set(["ref-1"]) };

describe("researchSchema (P3-03)", () => {
  it("fact không có source bị từ chối", () => {
    const parsed = researchSchema.safeParse(
      research({ facts: [{ statement: "x", claimStatus: "assumption", sourceIds: [] }] }),
    );
    expect(parsed.success).toBe(false);
  });

  it("source fetched_url thiếu url và source id trùng bị từ chối", () => {
    expect(
      researchSchema.safeParse(
        research({ sources: [{ id: "url-1", title: "a", origin: "fetched_url" }] }),
      ).success,
    ).toBe(false);
    expect(
      researchSchema.safeParse(
        research({
          sources: [
            { id: "ref-1", title: "a", origin: "user_reference" },
            { id: "ref-1", title: "b", origin: "user_reference" },
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it("chỉ nhận url http/https", () => {
    expect(
      researchSchema.safeParse(
        research({
          sources: [{ id: "url-1", title: "a", origin: "fetched_url", url: "file:///etc/passwd" }],
        }),
      ).success,
    ).toBe(false);
  });
});

describe("filterResearchFacts (P3-03)", () => {
  it("giữ fact verified có nguồn fetch thành công (khớp finalUrl) hoặc reference của project", () => {
    const result = filterResearchFacts(
      research({
        facts: [
          { statement: "Redis lưu trong RAM.", claimStatus: "verified", sourceIds: ["url-1"] },
          {
            statement: "Director ghi chú TTL.",
            claimStatus: "verified",
            sourceIds: ["ref-1", "url-1"],
          },
        ],
      }),
      provenance,
    );
    expect(result.research.facts).toHaveLength(2);
    expect(result.rejected).toEqual([]);
  });

  it("citation lạ không thành verified: id không tồn tại bị loại", () => {
    const result = filterResearchFacts(
      research({ facts: [{ statement: "bịa", claimStatus: "verified", sourceIds: ["url-77"] }] }),
      provenance,
    );
    expect(result.research.facts).toEqual([]);
    expect(result.rejected).toEqual([{ statement: "bịa", reason: "unknown_source" }]);
  });

  it("verified trỏ tới URL không có trong fetch_log, fetch lỗi, hoặc reference ngoài project bị loại", () => {
    const result = filterResearchFacts(
      research({
        facts: [
          { statement: "a", claimStatus: "verified", sourceIds: ["url-3"] },
          { statement: "b", claimStatus: "verified", sourceIds: ["url-2"] },
          { statement: "c", claimStatus: "verified", sourceIds: ["ref-9"] },
          { statement: "d", claimStatus: "verified", sourceIds: ["url-1", "url-3"] },
        ],
      }),
      provenance,
    );
    expect(result.research.facts).toEqual([]);
    expect(result.rejected.map((r) => r.reason)).toEqual([
      "unverified_source",
      "unverified_source",
      "unverified_source",
      "unverified_source",
    ]);
  });

  it("assumption với source có thật được giữ dù nguồn chưa fetch được", () => {
    const result = filterResearchFacts(
      research({
        facts: [{ statement: "có thể", claimStatus: "assumption", sourceIds: ["url-2"] }],
      }),
      provenance,
    );
    expect(result.research.facts).toHaveLength(1);
  });
});
