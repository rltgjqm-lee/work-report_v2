CREATE TABLE `admin_push_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`admin_id` integer NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_push_subscriptions_endpoint_unique` ON `admin_push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `idx_admin_push_subscriptions_admin` ON `admin_push_subscriptions` (`admin_id`);