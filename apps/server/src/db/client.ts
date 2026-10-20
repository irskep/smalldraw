import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema.js";

const serverRoot = path.resolve(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const rawDatabaseUrl = process.env.DATABASE_URL;
const isInMemory = rawDatabaseUrl === ":memory:";
const databasePath = isInMemory
  ? ":memory:"
  : path.isAbsolute(rawDatabaseUrl)
    ? rawDatabaseUrl
    : path.resolve(serverRoot, rawDatabaseUrl);

if (!isInMemory) {
  mkdirSync(path.dirname(databasePath), { recursive: true });
}

const sqlite = new Database(databasePath, { create: true });
sqlite.run("PRAGMA journal_mode=WAL");
sqlite.run("PRAGMA synchronous=FULL");
sqlite.run("PRAGMA busy_timeout=5000");

export const db = drizzle(sqlite, { schema });
export type DbClient = typeof db;
export { schema };
