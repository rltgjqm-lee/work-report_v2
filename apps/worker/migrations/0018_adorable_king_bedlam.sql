CREATE TABLE `escape_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`participant_id` integer NOT NULL,
	`program_id` integer NOT NULL,
	`demand_site_id` integer,
	`detected_at` text DEFAULT (current_timestamp) NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`distance_km` real NOT NULL,
	`alert_count` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`resolved_by` integer,
	`resolved_at` text,
	`memo` text,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`demand_site_id`) REFERENCES `demand_sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resolved_by`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `participant_escape_meta` (
	`participant_id` integer PRIMARY KEY NOT NULL,
	`alert_count` integer DEFAULT 0 NOT NULL,
	`outside_start` text,
	`last_lat` real,
	`last_lng` real,
	`last_location_at` text,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `push_subscriptions` ADD `participant_id` integer REFERENCES participants(id);