import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { buildRedisEduVerticalFixtureProps } from "../src/fixtures/redis-edu-props.ts";

const outDir = join(import.meta.dirname, "..", "fixtures");
mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, "edu-vertical-redis-props.json"),
  `${JSON.stringify(buildRedisEduVerticalFixtureProps(), null, 2)}\n`,
  "utf8",
);
