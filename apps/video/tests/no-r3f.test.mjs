import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const srcRoot = join(import.meta.dirname, "..", "src");
const forbidden = ["@react-three/fiber", "from \"three\"", "from 'three'"];

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (name.endsWith(".ts") || name.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

test("apps/video src không import three hoặc R3F", () => {
  const files = walk(srcRoot);
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const needle of forbidden) {
      assert.equal(
        text.includes(needle),
        false,
        `${file} chứa ${needle}`,
      );
    }
  }
});
