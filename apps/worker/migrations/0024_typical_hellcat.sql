CREATE TABLE `group_monthly_schedule` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`year_month` text NOT NULL,
	`work_dates` text DEFAULT '[]' NOT NULL,
	`max_monthly_minutes` integer DEFAULT 1800 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_monthly_schedule_group_month_unique` ON `group_monthly_schedule` (`group_id`,`year_month`);--> statement-breakpoint
CREATE TABLE `participant_monthly_schedule` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`participant_id` integer NOT NULL,
	`year_month` text NOT NULL,
	`work_dates` text DEFAULT '[]' NOT NULL,
	`max_monthly_minutes` integer,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participant_monthly_schedule_participant_month_unique` ON `participant_monthly_schedule` (`participant_id`,`year_month`);--> statement-breakpoint
ALTER TABLE `attendance_logs` ADD `signature_key` text;