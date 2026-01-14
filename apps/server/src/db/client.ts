import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as schema from "./schema.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const serverRoot = path.resolve(__dirname, "..", "..");

const rawDatabaseUrl = process.env.DATABASE_URL ?? "./sqlite/dev.db";
const databasePath = path.isAbsolute(rawDatabaseUrl)
  ? rawDatabaseUrl
  : path.resolve(serverRoot, rawDatabaseUrl);

mkdirSync(path.dirname(databasePath), { recursive: true });

const sqlite = new Database(databasePath, { create: true });

export const db = drizzle(sqlite, { schema });
export type DbClient = typeof db;
export { schema };
