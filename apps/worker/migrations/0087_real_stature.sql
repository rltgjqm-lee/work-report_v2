CREATE TABLE `admin_devices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`admin_id` integer NOT NULL,
	`fcm_token` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_devices_fcm_token_unique` ON `admin_devices` (`fcm_token`);--> statement-breakpoint
CREATE INDEX `idx_admin_devices_admin` ON `admin_devices` (`admin_id`);--> statement-breakpoint
CREATE TABLE `admin_refresh_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`admin_id` integer NOT NULL,
	`family_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`used_at` text,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_refresh_tokens_token_hash_unique` ON `admin_refresh_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_admin_refresh_tokens_admin` ON `admin_refresh_tokens` (`admin_id`);--> statement-breakpoint
CREATE INDEX `idx_admin_refresh_tokens_family` ON `admin_refresh_tokens` (`family_id`);