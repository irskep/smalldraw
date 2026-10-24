DROP INDEX `document_moderation_taken_down_idx`;--> statement-breakpoint
CREATE INDEX `document_moderation_taken_down_idx` ON `document_moderation` (`taken_down_at`,`document_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT 'Untitled' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`content_updated_at` integer DEFAULT '0' NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_documents`("id", "name", "created_at", "updated_at", "content_updated_at", "deleted_at") SELECT "id", "name", "created_at", "updated_at", "content_updated_at", "deleted_at" FROM `documents`;--> statement-breakpoint
DROP TABLE `documents`;--> statement-breakpoint
ALTER TABLE `__new_documents` RENAME TO `documents`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `documents_content_updated_idx` ON `documents` (`content_updated_at`,`id`);