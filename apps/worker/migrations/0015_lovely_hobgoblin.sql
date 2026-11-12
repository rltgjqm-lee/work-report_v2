CREATE TABLE `participant_annual_leave` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`participant_id` integer NOT NULL,
	`year` text NOT NULL,
	`total_days` integer DEFAULT 0 NOT NULL,
	`used_days` integer DEFAULT 0 NOT NULL,
	`remaining_days` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participant_annual_leave_participant_year_unique` ON `participant_annual_leave` (`participant_id`,`year`);--> statement-breakpoint
ALTER TABLE `participant_leaves` ADD `leave_type` text DEFAULT 'PAID' NOT NULL;--> statement-breakpoint
ALTER TABLE `participant_leaves` ADD `leave_days` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `participants` ADD `demand_site_id` integer REFERENCES demand_sites(id);