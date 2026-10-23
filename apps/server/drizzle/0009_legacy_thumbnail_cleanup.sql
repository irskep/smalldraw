ALTER TABLE `document_moderation` ADD `legacy_thumbnail_storage_key` text;--> statement-breakpoint
ALTER TABLE `document_thumbnails` ADD `legacy_storage_key` text;
--> statement-breakpoint
UPDATE document_thumbnails SET legacy_storage_key = storage_key WHERE legacy_storage_key IS NULL AND storage_key LIKE '%/thumbnail.png';
