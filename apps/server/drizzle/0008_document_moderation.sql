CREATE TABLE `document_moderation` (
	`document_id` text PRIMARY KEY NOT NULL,
	`taken_down_at` integer DEFAULT (unixepoch()) NOT NULL,
	`administrator_id` text NOT NULL,
	`reason` text NOT NULL,
	`cleanup_state` text DEFAULT 'pending' NOT NULL,
	`cleanup_attempts` integer DEFAULT 0 NOT NULL,
	`last_attempt_at` integer,
	`last_error` text,
	`next_retry_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	`thumbnail_storage_key` text
);
--> statement-breakpoint
CREATE INDEX `document_moderation_taken_down_idx` ON `document_moderation` ("taken_down_at" desc,"document_id" desc);--> statement-breakpoint
CREATE INDEX `document_moderation_cleanup_idx` ON `document_moderation` (`cleanup_state`,`next_retry_at`);--> statement-breakpoint
ALTER TABLE `documents` ADD `content_updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `documents_content_updated_idx` ON `documents` ("content_updated_at" desc,"id" desc);
--> statement-breakpoint
UPDATE documents SET content_updated_at = updated_at WHERE content_updated_at = 0;
