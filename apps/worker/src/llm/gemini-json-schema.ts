/** Strip / rewrite JSON Schema keywords unsupported by Gemini responseJsonSchema. */

const DROP_KEYS = new Set(["$schema", "pattern"]);

function rewriteNode(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(rewriteNode);
  }
  if (node === null || typeof node !== "object") {
    return node;
  }

  const input = node as Record<string, unknown>;
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (DROP_KEYS.has(key)) {
      continue;
    }
    if (key === "const") {
      output.enum = [value];
      continue;
    }
    if (key === "items" && value === false) {
      continue;
    }
    output[key] = rewriteNode(value);
  }

  if ("oneOf" in output && !("anyOf" in output)) {
    output.anyOf = output.oneOf;
    delete output.oneOf;
  }

  return output;
}

export function sanitizeJsonSchemaForGemini(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  return rewriteNode(schema) as Record<string, unknown>;
}

export type GeminiSchemaSummary = {
  serializedBytes: number;
  maxNestingDepth: number;
  propertyNodeCount: number;
  unionBranchCount: number;
  keywords: string[];
};

function maxDepth(value: unknown, depth = 0): number {
  if (value === null || typeof value !== "object") {
    return depth;
  }
  if (Array.isArray(value)) {
    return Math.max(depth, ...value.map((item) => maxDepth(item, depth + 1)));
  }
  return Math.max(depth, ...Object.values(value).map((item) => maxDepth(item, depth + 1)));
}

function countProperties(value: unknown): number {
  if (value === null || typeof value !== "object") {
    return 0;
  }
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + countProperties(item), 0);
  }
  let count = Object.keys(value).length;
  for (const item of Object.values(value)) {
    count += countProperties(item);
  }
  return count;
}

function collectKeywords(value: unknown, keywords = new Set<string>()): Set<string> {
  if (value === null || typeof value !== "object") {
    return keywords;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeywords(item, keywords);
    }
    return keywords;
  }
  for (const [key, item] of Object.entries(value)) {
    keywords.add(key);
    collectKeywords(item, keywords);
  }
  return keywords;
}

function countUnionBranches(value: unknown): number {
  if (value === null || typeof value !== "object") {
    return 0;
  }
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + countUnionBranches(item), 0);
  }
  let count = 0;
  if ("anyOf" in value && Array.isArray((value as { anyOf: unknown[] }).anyOf)) {
    count += (value as { anyOf: unknown[] }).anyOf.length;
  }
  if ("oneOf" in value && Array.isArray((value as { oneOf: unknown[] }).oneOf)) {
    count += (value as { oneOf: unknown[] }).oneOf.length;
  }
  for (const item of Object.values(value)) {
    count += countUnionBranches(item);
  }
  return count;
}

export function summarizeGeminiJsonSchema(schema: Record<string, unknown>): GeminiSchemaSummary {
  const json = JSON.stringify(schema);
  return {
    serializedBytes: json.length,
    maxNestingDepth: maxDepth(schema),
    propertyNodeCount: countProperties(schema),
    unionBranchCount: countUnionBranches(schema),
    keywords: [...collectKeywords(schema)].sort(),
  };
}

export function summarizeGenerationConfigForDebug(input: {
  model: string;
  thinkingLevel: string;
  responseJsonSchema?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    model: input.model,
    thinkingLevel: input.thinkingLevel,
    responseMimeType: "application/json",
    schemaSummary: input.responseJsonSchema
      ? summarizeGeminiJsonSchema(input.responseJsonSchema)
      : null,
  };
}
