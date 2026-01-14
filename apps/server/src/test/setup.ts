import { beforeEach } from "bun:test";
import { db } from "../db/client.js";
import {
  documentInvitations,
  documents,
  loginAttempts,
  sessions,
  users,
  usersOnDocuments,
} from "../db/schema.js";

beforeEach(async () => {
  await db.delete(documentInvitations);
  await db.delete(usersOnDocuments);
  await db.delete(documents);
  await db.delete(loginAttempts);
  await db.delete(sessions);
  await db.delete(users);
});
