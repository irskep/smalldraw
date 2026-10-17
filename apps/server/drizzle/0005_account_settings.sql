CREATE TABLE `account_settings` (
  `user_id` text PRIMARY KEY NOT NULL,
  `share_mode` text DEFAULT 'allowed' NOT NULL,
  `sync_new_drawings_by_default` integer DEFAULT false NOT NULL,
  `pin_hash` text,
  `pin_salt` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
