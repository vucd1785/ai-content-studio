import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export type StudioDb = PostgresJsDatabase;

export type DbConnection = {
  db: StudioDb;
  close: () => Promise<void>;
};

export function createDbConnection(databaseUrl: string): DbConnection {
  const client = postgres(databaseUrl, { max: 10 });
  const db = drizzle(client);
  return {
    db,
    close: async () => {
      await client.end();
    },
  };
}
