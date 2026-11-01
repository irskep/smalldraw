CREATE TABLE `sharing_admission_receipts` (
	`key_hash` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`token_id` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`token_id`) REFERENCES `document_invitations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sharing_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `sharing_participants_document_idx` ON `sharing_participants` (`document_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sharing_participants_account_unique` ON `sharing_participants` (`document_id`,`user_id`);--> statement-breakpoint
ALTER TABLE `document_invitations` ADD `expires_at` integer;--> statement-breakpoint
ALTER TABLE `document_invitations` ADD `participant_id` text REFERENCES sharing_participants(id);--> statement-breakpoint
ALTER TABLE `documents` ADD `allow_new_joiners` integer DEFAULT true NOT NULL;
--> statement-breakpoint
UPDATE document_invitations SET expires_at = created_at + 604800 WHERE scope = 'share' AND expires_at IS NULL;
--> statement-breakpoint
INSERT OR IGNORE INTO sharing_participants (id, document_id, user_id) SELECT 'account:' || document_id || ':' || user_id, document_id, user_id FROM users_on_documents WHERE is_admin = 0;
--> statement-breakpoint
UPDATE document_invitations SET participant_id = (
    SELECT p.id FROM sharing_participants p WHERE p.document_id = document_invitations.document_id
    AND document_invitations.tag LIKE 'account:' || p.user_id || ':device:%'
  ) WHERE scope = 'device' AND participant_id IS NULL;
--> statement-breakpoint
INSERT OR IGNORE INTO sharing_participants (id, document_id, created_at)
    SELECT 'guest:' || document_id || ':' || COALESCE(tag, id), document_id, MIN(created_at)
    FROM document_invitations WHERE scope = 'device' AND participant_id IS NULL
    GROUP BY document_id, COALESCE(tag, id);
--> statement-breakpoint
UPDATE document_invitations SET participant_id = 'guest:' || document_id || ':' || COALESCE(tag, id) WHERE scope = 'device' AND participant_id IS NULL;
