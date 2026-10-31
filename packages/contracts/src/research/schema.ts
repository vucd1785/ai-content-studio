import { z } from "zod/v4";

/**
 * Artifact research và fetch log (docs/04-AGENT-ORCHESTRATION.md mục "Artifact nghiên cứu").
 * Validator bằng code ở `filterResearchFacts`: fact `verified` sai nguồn bị loại (docs/08-SECURITY.md).
 */

const sourceIdSchema = z.string().regex(/^[a-z0-9-]{1,40}$/);

export const claimStatusSchema = z.enum(["verified", "assumption", "user_provided"]);
export type ClaimStatus = z.infer<typeof claimStatusSchema>;

export const researchFactSchema = z
  .object({
    statement: z.string().min(1).max(500),
    claimStatus: claimStatusSchema,
    /** Fact không có source bị từ chối. */
    sourceIds: z.array(sourceIdSchema).min(1).max(5),
  })
  .strict();

export const researchSourceSchema = z
  .object({
    id: sourceIdSchema,
    title: z.string().min(1).max(200),
    origin: z.enum(["user_reference", "fetched_url"]),
    url: z.url({ protocol: /^https?$/ }).max(2048).optional(),
  })
  .strict();

export const researchSchema = z
  .object({
    schemaVersion: z.literal(1),
    summary: z.string().min(1).max(2000),
    facts: z.array(researchFactSchema).max(30),
    sources: z.array(researchSourceSchema).max(20),
  })
  .strict()
  .superRefine((data, ctx) => {
    const ids = new Set<string>();
    data.sources.forEach((source, index) => {
      if (ids.has(source.id)) {
        ctx.addIssue({ code: "custom", message: `source id trùng: ${source.id}`, path: ["sources", index, "id"] });
      }
      ids.add(source.id);
      if (source.origin === "fetched_url" && source.url === undefined) {
        ctx.addIssue({ code: "custom", message: "source fetched_url cần url", path: ["sources", index, "url"] });
      }
    });
  });

export type Research = z.infer<typeof researchSchema>;
export type ResearchFact = z.infer<typeof researchFactSchema>;
export type ResearchSource = z.infer<typeof researchSourceSchema>;

export const fetchErrorCodeSchema = z.enum([
  "invalid_url",
  "protocol_not_allowed",
  "host_not_allowed",
  "address_blocked",
  "dns_failed",
  "too_many_redirects",
  "timeout",
  "too_large",
  "http_error",
  "unsupported_content_type",
  "network_error",
]);
export type FetchErrorCode = z.infer<typeof fetchErrorCodeSchema>;

export const fetchLogRequestSchema = z
  .object({
    url: z.string().max(2048),
    finalUrl: z.string().max(2048).nullable(),
    status: z.number().int().nullable(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    error: fetchErrorCodeSchema.optional(),
  })
  .strict();

export const fetchLogSchema = z
  .object({
    schemaVersion: z.literal(1),
    requests: z.array(fetchLogRequestSchema),
  })
  .strict();

export type FetchLog = z.infer<typeof fetchLogSchema>;
export type FetchLogRequest = z.infer<typeof fetchLogRequestSchema>;

/** Dòng fetch thành công: có status 2xx và hash nội dung. */
export function isSuccessfulFetch(request: FetchLogRequest): boolean {
  return (
    request.error === undefined &&
    request.status !== null &&
    request.status >= 200 &&
    request.status < 300 &&
    request.contentHash !== null
  );
}

export type FactRejectionReason = "unknown_source" | "unverified_source";

export type FilterResearchFactsResult = {
  research: Research;
  rejected: { statement: string; reason: FactRejectionReason }[];
};

/**
 * Chặn ở code (docs/08-SECURITY.md mục Prompt injection):
 * - Fact trỏ tới source id không có trong `sources` bị loại.
 * - Fact `verified` bị loại nếu một source của nó không chứng minh được:
 *   `fetched_url` phải khớp `url` hoặc `finalUrl` của một dòng fetch thành công;
 *   `user_reference` phải nằm trong danh sách reference của project.
 */
export function filterResearchFacts(
  research: Research,
  provenance: { fetchLog: FetchLog; userReferenceSourceIds: ReadonlySet<string> },
): FilterResearchFactsResult {
  const fetchedUrls = new Set<string>();
  for (const request of provenance.fetchLog.requests) {
    if (isSuccessfulFetch(request)) {
      fetchedUrls.add(request.url);
      if (request.finalUrl !== null) {
        fetchedUrls.add(request.finalUrl);
      }
    }
  }
  const sourcesById = new Map(research.sources.map((source) => [source.id, source]));
  const isProven = (source: ResearchSource) =>
    source.origin === "fetched_url"
      ? source.url !== undefined && fetchedUrls.has(source.url)
      : provenance.userReferenceSourceIds.has(source.id);

  const facts: ResearchFact[] = [];
  const rejected: FilterResearchFactsResult["rejected"] = [];
  for (const fact of research.facts) {
    const sources = fact.sourceIds.map((id) => sourcesById.get(id));
    if (sources.some((source) => source === undefined)) {
      rejected.push({ statement: fact.statement, reason: "unknown_source" });
      continue;
    }
    if (fact.claimStatus === "verified" && !sources.every((source) => source !== undefined && isProven(source))) {
      rejected.push({ statement: fact.statement, reason: "unverified_source" });
      continue;
    }
    facts.push(fact);
  }
  return { research: { ...research, facts }, rejected };
}
