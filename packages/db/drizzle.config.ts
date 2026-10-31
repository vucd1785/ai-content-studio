import { defineConfig } from "drizzle-kit";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
