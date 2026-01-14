import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamp = (name: string) =>
  integer(name, { mode: "timestamp" }).notNull().default(sql`(unixepoch())`);

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  registrationRecord: text("registration_record").notNull(),
  createdAt: timestamp("created_at"),
});

export const sessions = sqliteTable("sessions", {
  sessionKey: text("session_key").primaryKey().notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at"),
});

export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: text("id")
      .primaryKey()
      .notNull()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serverLoginState: text("server_login_state").notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => ({
    userUnique: uniqueIndex("login_attempts_user_unique").on(table.userId),
  })
);

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull().default("Untitled"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const usersOnDocuments = sqliteTable(
  "users_on_documents",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.documentId] }),
  })
);

export const documentInvitations = sqliteTable("document_invitations", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$defaultFn(() => crypto.randomUUID()),
  documentId: text("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at"),
});

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type DocumentInvitation = typeof documentInvitations.$inferSelect;
export type LoginAttempt = typeof loginAttempts.$inferSelect;
