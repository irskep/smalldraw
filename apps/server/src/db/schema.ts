import { desc, sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamp = (name: string) =>
  integer(name, { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  registrationRecord: text("registration_record").notNull(),
  isServerAdmin: integer("is_server_admin", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: timestamp("created_at"),
});

export const serverAdminCredentials = sqliteTable("server_admin_credentials", {
  userId: text("user_id")
    .primaryKey()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
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
  }),
);

export const accountSettings = sqliteTable("account_settings", {
  userId: text("user_id")
    .primaryKey()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  shareMode: text("share_mode").notNull().default("allowed"),
  pinHash: text("pin_hash"),
  pinSalt: text("pin_salt"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey().notNull(),
    name: text("name").notNull().default("Untitled"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
    // A constant SQL default permits an additive SQLite migration. Existing rows
    // are backfilled from updated_at; creation paths supply the current time.
    contentUpdatedAt: integer("content_updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`0`),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
  },
  (table) => ({
    contentUpdatedIndex: index("documents_content_updated_idx").on(
      desc(table.contentUpdatedAt),
      desc(table.id),
    ),
  }),
);

// Deliberately independent of documents/users: removing either must never erase
// the block or its audit record and allow an offline client to recreate content.
export const documentModeration = sqliteTable(
  "document_moderation",
  {
    documentId: text("document_id").primaryKey().notNull(),
    takenDownAt: timestamp("taken_down_at"),
    administratorId: text("administrator_id").notNull(),
    reason: text("reason").notNull(),
    cleanupState: text("cleanup_state", { enum: ["pending", "complete"] })
      .notNull()
      .default("pending"),
    cleanupAttempts: integer("cleanup_attempts").notNull().default(0),
    lastAttemptAt: integer("last_attempt_at", { mode: "timestamp" }),
    lastError: text("last_error"),
    nextRetryAt: timestamp("next_retry_at"),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    thumbnailStorageKey: text("thumbnail_storage_key"),
    legacyThumbnailStorageKey: text("legacy_thumbnail_storage_key"),
  },
  (table) => ({
    takenDownIndex: index("document_moderation_taken_down_idx").on(
      desc(table.takenDownAt),
      desc(table.documentId),
    ),
    cleanupIndex: index("document_moderation_cleanup_idx").on(
      table.cleanupState,
      table.nextRetryAt,
    ),
  }),
);

export const documentThumbnails = sqliteTable("document_thumbnails", {
  documentId: text("document_id")
    .primaryKey()
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull().unique(),
  legacyStorageKey: text("legacy_storage_key"),
  contentType: text("content_type").notNull(),
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
    documentIndex: index("users_on_documents_document_idx").on(
      table.documentId,
    ),
  }),
);

export const documentInvitations = sqliteTable(
  "document_invitations",
  {
    id: text("id")
      .primaryKey()
      .notNull()
      .$defaultFn(() => crypto.randomUUID()),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    scope: text("scope").notNull().default("share"),
    tag: text("tag"),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
    createdAt: timestamp("created_at"),
  },
  (table) => ({
    documentScopeIndex: index("document_invitations_document_scope_idx").on(
      table.documentId,
      table.scope,
    ),
  }),
);

export const documentTokenScopes = ["share", "owner", "device"] as const;
export type DocumentTokenScope = (typeof documentTokenScopes)[number];
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type AccountSettingsRecord = typeof accountSettings.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type DocumentModeration = typeof documentModeration.$inferSelect;
export type DocumentThumbnail = typeof documentThumbnails.$inferSelect;
export type DocumentInvitation = typeof documentInvitations.$inferSelect;
export type LoginAttempt = typeof loginAttempts.$inferSelect;
