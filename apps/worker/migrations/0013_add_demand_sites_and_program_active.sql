CREATE TABLE `demand_site_schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`demand_site_id` integer NOT NULL,
	`group_id` integer NOT NULL,
	`shift_start` text NOT NULL,
	`shift_end` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`demand_site_id`) REFERENCES `demand_sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `demand_sites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` integer NOT NULL,
	`name` text NOT NULL,
	`base_lat` real NOT NULL,
	`base_lng` real NOT NULL,
	`allowed_radius` integer DEFAULT 1500 NOT NULL,
	`address` text,
	`contact_person` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `programs` ADD `is_active` integer DEFAULT true NOT NULL;