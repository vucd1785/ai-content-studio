import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle");

async function main(): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder });
  await sql.end();
  console.log(JSON.stringify({ status: "ok", migrationsFolder }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
