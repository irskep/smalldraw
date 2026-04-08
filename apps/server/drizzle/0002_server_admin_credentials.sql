ALTER TABLE `users` ADD `is_server_admin` integer DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE `server_admin_credentials` (
  `user_id` text PRIMARY KEY NOT NULL,
  `password_hash` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
