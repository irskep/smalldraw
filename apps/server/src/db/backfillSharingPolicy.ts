import type { Database } from "bun:sqlite";

// Also applied by the SQL migration. Production uses drizzle-kit push, so data
// backfills must be idempotent and run after its additive schema update.
export const sharingBackfillSql = [
  "UPDATE document_invitations SET expires_at = created_at + 604800 WHERE scope = 'share' AND expires_at IS NULL",
  "INSERT OR IGNORE INTO sharing_participants (id, document_id, user_id) SELECT 'account:' || document_id || ':' || user_id, document_id, user_id FROM users_on_documents WHERE is_admin = 0",
  `UPDATE document_invitations SET participant_id = (
    SELECT p.id FROM sharing_participants p WHERE p.document_id = document_invitations.document_id
    AND document_invitations.tag LIKE 'account:' || p.user_id || ':device:%'
  ) WHERE scope = 'device' AND participant_id IS NULL`,
  `INSERT OR IGNORE INTO sharing_participants (id, document_id, created_at)
    SELECT 'guest:' || document_id || ':' || COALESCE(tag, id), document_id, MIN(created_at)
    FROM document_invitations WHERE scope = 'device' AND participant_id IS NULL
    GROUP BY document_id, COALESCE(tag, id)`,
  "UPDATE document_invitations SET participant_id = 'guest:' || document_id || ':' || COALESCE(tag, id) WHERE scope = 'device' AND participant_id IS NULL",
];
export function backfillSharingPolicy(sqlite: Database): void {
  if (
    !sqlite
      .query<{ name: string }, []>("PRAGMA table_info(document_invitations)")
      .all()
      .some((c) => c.name === "participant_id")
  )
    return;
  sqlite
    .transaction(() => {
      for (const statement of sharingBackfillSql) sqlite.run(statement);
    })
    .immediate();
}
