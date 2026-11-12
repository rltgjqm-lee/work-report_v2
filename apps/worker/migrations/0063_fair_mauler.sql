CREATE TABLE `sos_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`participant_id` integer NOT NULL,
	`program_id` integer NOT NULL,
	`demand_site_id` integer,
	`triggered_at` text DEFAULT (current_timestamp) NOT NULL,
	`lat` real,
	`lng` real,
	`escape_status_at_trigger` text NOT NULL,
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
CREATE INDEX `idx_sos_program_status` ON `sos_events` (`program_id`,`status`);