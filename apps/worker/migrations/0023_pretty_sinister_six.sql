CREATE TABLE `admin_password_change_attempts` (
	`admin_id` integer PRIMARY KEY NOT NULL,
	`fail_count` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `admin_password_reset_attempts` (
	`actor_admin_id` integer PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`window_start` text NOT NULL,
	FOREIGN KEY (`actor_admin_id`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE no action
);
