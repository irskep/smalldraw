import { beforeAll, beforeEach } from "bun:test";
import path from "path";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "../db/client.js";
import {
  documentInvitations,
  documents,
  loginAttempts,
  sessions,
  users,
  usersOnDocuments,
} from "../db/schema.js";

const migrationsFolder = path.resolve(import.meta.dir, "../../drizzle");

beforeAll(() => {
  migrate(db, { migrationsFolder });
});

beforeEach(async () => {
  await db.delete(documentInvitations);
  await db.delete(usersOnDocuments);
  await db.delete(documents);
  await db.delete(loginAttempts);
  await db.delete(sessions);
  await db.delete(users);
});
