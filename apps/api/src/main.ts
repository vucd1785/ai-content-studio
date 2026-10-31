import { loadDataDir } from "@studio/config/data-dir";
import { loadSessionEnv } from "@studio/config/session-env";
import { createDbConnection } from "@studio/db";
import { mkdir } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";

const LISTEN_HOST = "127.0.0.1";
const LISTEN_PORT = 3001;
/** DATA_DIR tương đối tính từ gốc repo (giống worker), không theo cwd của `pnpm --filter`. */
const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

async function main(): Promise<void> {
  let config: ReturnType<typeof loadSessionEnv>;
  let dataDir: string;
  try {
    config = loadSessionEnv();
    const rawDataDir = loadDataDir();
    dataDir = isAbsolute(rawDataDir) ? rawDataDir : resolve(REPO_ROOT, rawDataDir);
    await mkdir(dataDir, { recursive: true });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const databaseUrl =
    process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";
  const { db, close } = createDbConnection(databaseUrl);

  const app = await buildApp({
    password: config.password,
    sessionSecret: config.sessionSecret,
    enableProbe: false,
    projects: { db, dataDir },
  });

  app.addHook("onClose", async () => {
    await close();
  });

  try {
    await app.listen({ host: LISTEN_HOST, port: LISTEN_PORT });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

await main();
