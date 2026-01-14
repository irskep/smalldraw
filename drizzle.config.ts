import "dotenv/config";
import path from "path";
import { defineConfig } from "drizzle-kit";

const rawDatabaseUrl = process.env.DATABASE_URL ?? "./sqlite/dev.db";
const databaseFile = path.isAbsolute(rawDatabaseUrl)
  ? rawDatabaseUrl
  : path.resolve("apps/server", rawDatabaseUrl);

export default defineConfig({
  schema: "./apps/server/src/db/schema.ts",
  out: "./apps/server/drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: databaseFile,
  },
});
