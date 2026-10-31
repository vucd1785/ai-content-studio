import { describe, expect, it } from "vitest";

describe("migrate journal", () => {
  it("có migration SQL ban đầu", async () => {
    const { readFileSync, existsSync } = await import("node:fs");
    const { join, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const journal = join(root, "drizzle", "meta", "_journal.json");
    expect(existsSync(journal)).toBe(true);
    const sqlFiles = await import("node:fs/promises").then((fs) =>
      fs.readdir(join(root, "drizzle")),
    );
    expect(sqlFiles.some((f) => f.endsWith(".sql"))).toBe(true);
    const journalRaw = JSON.parse(readFileSync(journal, "utf8")) as { entries: unknown[] };
    expect(journalRaw.entries.length).toBeGreaterThan(0);
  });
});
