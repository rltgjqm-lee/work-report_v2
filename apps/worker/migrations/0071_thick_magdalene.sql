CREATE TABLE `admin_password_reset_requests` (
	`email` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`window_start` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `admins` ADD `reset_token_hash` text;--> statement-breakpoint
ALTER TABLE `admins` ADD `reset_token_expires_at` text;