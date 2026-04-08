ALTER TABLE `document_invitations` ADD COLUMN `scope` text NOT NULL DEFAULT 'share';
--> statement-breakpoint
ALTER TABLE `document_invitations` ADD COLUMN `tag` text;
--> statement-breakpoint
ALTER TABLE `document_invitations` ADD COLUMN `revoked_at` integer;
--> statement-breakpoint
ALTER TABLE `document_invitations` ADD COLUMN `last_used_at` integer;
--> statement-breakpoint
UPDATE `document_invitations`
SET `last_used_at` = `created_at`
WHERE `last_used_at` IS NULL;
