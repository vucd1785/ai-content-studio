import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Tạo DB test (nếu chưa có) rồi chạy mọi migration (P3-13). Chỉ nhận DB có tên kết thúc bằng `_test`,
 * nên lệnh này không bao giờ đụng DB `studio`. Không xóa hay làm rỗng gì.
 */
const testUrl = new URL(
  process.env.TEST_DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio_test",
);
const dbName = testUrl.pathname.slice(1);
if (!/^[a-z0-9_]+_test$/.test(dbName)) {
  throw new Error(
    "TEST_DATABASE_URL phải trỏ tới DB có tên kết thúc bằng _test (chữ thường, số, gạch dưới)",
  );
}

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle");

async function main(): Promise<void> {
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { max: 1 });
  const existing = await admin`select 1 from pg_database where datname = ${dbName}`;
  if (existing.length === 0) {
    // Tên DB đã qua regex ở trên nên đưa thẳng vào câu lệnh được.
    await admin.unsafe(`create database ${dbName}`);
  }
  await admin.end();

  const sql = postgres(testUrl.toString(), { max: 1 });
  await migrate(drizzle(sql), { migrationsFolder });
  await sql.end();
  console.log(
    JSON.stringify({ status: "ok", database: dbName, created: existing.length === 0 }, null, 2),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
