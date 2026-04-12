CREATE TABLE `document_thumbnails` (
  `document_id` text PRIMARY KEY NOT NULL REFERENCES `documents`(`id`) ON DELETE cascade,
  `storage_key` text NOT NULL,
  `content_type` text NOT NULL,
  `updated_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_thumbnails_storage_key_unique` ON `document_thumbnails` (`storage_key`);
